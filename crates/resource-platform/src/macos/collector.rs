use std::collections::HashMap;
use std::ffi::CStr;
use std::mem;
use std::path::PathBuf;

use async_trait::async_trait;
use libc::{c_int, c_void, pid_t};
use resource_core::{Pid, ProcessInfo, ProcessMetrics, ProcessSnapshot, SystemMetrics};

use crate::traits::{SystemCollector, TelemetryError};
use super::ffi::*;

pub struct MacOsCollector {
    /// Mach absolute-time units → nanoseconds (125/3 on Apple Silicon, 1/1 on Intel).
    timebase: (u64, u64),
}

impl Default for MacOsCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl MacOsCollector {
    pub fn new() -> Self {
        let mut info = mach2::mach_time::mach_timebase_info { numer: 1, denom: 1 };
        let ok = unsafe { mach2::mach_time::mach_timebase_info(&mut info) } == 0 && info.denom != 0;
        let timebase = if ok { (info.numer as u64, info.denom as u64) } else { (1, 1) };
        Self { timebase }
    }

    /// CPU times from libproc are in Mach absolute-time units, not nanoseconds.
    fn ticks_to_ns(&self, ticks: u64) -> u64 {
        (ticks as u128 * self.timebase.0 as u128 / self.timebase.1 as u128) as u64
    }

    fn list_pids(&self) -> Result<Vec<Pid>, TelemetryError> {
        let mut pids: Vec<pid_t> = vec![0; 4096];
        let bytes_returned = unsafe {
            proc_listpids(
                PROC_ALL_PIDS,
                0,
                pids.as_mut_ptr() as *mut c_void,
                (pids.len() * mem::size_of::<pid_t>()) as c_int,
            )
        };

        if bytes_returned <= 0 {
            return Err(TelemetryError::OsError(format!(
                "proc_listpids returned {}",
                bytes_returned
            )));
        }

        let count = (bytes_returned as usize) / mem::size_of::<pid_t>();
        pids.truncate(count);
        Ok(pids.into_iter().filter(|&p| p > 0).map(|p| p as Pid).collect())
    }

    fn fetch_process_snapshot(&self, pid: Pid) -> Option<ProcessSnapshot> {
        let pid_i32 = pid as pid_t;

        // 1. Fetch proc_bsdinfo
        let mut bsd_info: proc_bsdinfo = unsafe { mem::zeroed() };
        let bsd_res = unsafe {
            proc_pidinfo(
                pid_i32,
                PROC_PIDTBSDINFO,
                0,
                &mut bsd_info as *mut _ as *mut c_void,
                mem::size_of::<proc_bsdinfo>() as c_int,
            )
        };

        if bsd_res <= 0 {
            return None;
        }

        // Parse BSD Process Name
        let name_str = {
            let nul_pos = bsd_info.pbi_name.iter().position(|&c| c == 0).unwrap_or(bsd_info.pbi_name.len());
            let raw_str = String::from_utf8_lossy(&bsd_info.pbi_name[..nul_pos]).trim().to_string();
            if raw_str.is_empty() {
                let comm_nul = bsd_info.pbi_comm.iter().position(|&c| c == 0).unwrap_or(bsd_info.pbi_comm.len());
                let comm_str = String::from_utf8_lossy(&bsd_info.pbi_comm[..comm_nul]).trim().to_string();
                if comm_str.is_empty() {
                    format!("PID {}", pid)
                } else {
                    comm_str
                }
            } else {
                raw_str
            }
        };

        // 2. Fetch proc_taskinfo
        let mut task_info: proc_taskinfo = unsafe { mem::zeroed() };
        let _task_res = unsafe {
            proc_pidinfo(
                pid_i32,
                PROC_PIDTASKINFO,
                0,
                &mut task_info as *mut _ as *mut c_void,
                mem::size_of::<proc_taskinfo>() as c_int,
            )
        };

        // 3. Fetch executable path via proc_pidpath
        let mut path_buf = [0u8; 1024];
        let path_res = unsafe {
            proc_pidpath(
                pid_i32,
                path_buf.as_mut_ptr() as *mut c_void,
                path_buf.len() as u32,
            )
        };

        let exec_path = if path_res > 0 {
            CStr::from_bytes_until_nul(&path_buf)
                .ok()
                .map(|cs| PathBuf::from(cs.to_string_lossy().into_owned()))
        } else {
            None
        };

        // 4. Fetch rusage_info_v4 for physical memory footprint & I/O
        let mut rusage: rusage_info_v4 = unsafe { mem::zeroed() };
        let rusage_res = unsafe { proc_pid_rusage(pid_i32, RUSAGE_INFO_V4, &mut rusage) };

        let (phys_footprint, user_time_ns, system_time_ns, disk_read, disk_write) = if rusage_res == 0 {
            (
                rusage.ri_phys_footprint,
                self.ticks_to_ns(rusage.ri_user_time),
                self.ticks_to_ns(rusage.ri_system_time),
                rusage.ri_diskio_bytesread,
                rusage.ri_diskio_byteswritten,
            )
        } else {
            (
                task_info.pti_resident_size,
                self.ticks_to_ns(task_info.pti_total_user),
                self.ticks_to_ns(task_info.pti_total_system),
                0,
                0,
            )
        };

        let info = ProcessInfo {
            pid,
            ppid: bsd_info.pbi_ppid as Pid,
            name: name_str,
            executable_path: exec_path,
            command_line: Vec::new(),
            working_directory: None,
            user_id: bsd_info.pbi_uid,
            start_time: None,
        };

        let metrics = ProcessMetrics {
            phys_footprint,
            rss: task_info.pti_resident_size,
            virtual_size: task_info.pti_virtual_size,
            compressed: 0,
            cpu_usage_pct: 0.0,
            user_time_ns,
            system_time_ns,
            disk_read_bytes: disk_read,
            disk_write_bytes: disk_write,
            thread_count: task_info.pti_threadnum as u32,
        };

        Some(ProcessSnapshot { info, metrics })
    }
}

#[async_trait]
impl SystemCollector for MacOsCollector {
    async fn collect_system_metrics(&self) -> Result<SystemMetrics, TelemetryError> {
        let total_memory: u64 = sysctl_value(c"hw.memsize").unwrap_or(0);
        let page_size: u64 = sysctl_value::<u64>(c"hw.pagesize").unwrap_or(16384);

        let mut vm: libc::vm_statistics64 = unsafe { mem::zeroed() };
        let mut count = libc::HOST_VM_INFO64_COUNT;
        #[allow(deprecated)]
        let kr = unsafe {
            libc::host_statistics64(
                libc::mach_host_self(),
                libc::HOST_VM_INFO64,
                &mut vm as *mut _ as libc::host_info64_t,
                &mut count,
            )
        };
        if kr != libc::KERN_SUCCESS {
            return Err(TelemetryError::OsError(format!("host_statistics64 returned {kr}")));
        }

        let swap: libc::xsw_usage = sysctl_value(c"vm.swapusage").unwrap_or(unsafe { mem::zeroed() });
        // kern.memorystatus_level is the share of memory still available to the system (0-100).
        let available_level: u32 = sysctl_value(c"kern.memorystatus_level").unwrap_or(100);

        let pages = |n: u64| n * page_size;
        Ok(SystemMetrics {
            total_memory,
            free_memory: pages(vm.free_count as u64),
            active_memory: pages(vm.active_count as u64),
            inactive_memory: pages(vm.inactive_count as u64),
            wired_memory: pages(vm.wire_count as u64),
            compressed_memory: pages(vm.compressor_page_count as u64),
            swap_used: swap.xsu_used,
            swap_total: swap.xsu_total,
            memory_pressure_pct: 100.0 - available_level.min(100) as f32,
            global_cpu_pct: 0.0,
        })
    }

    async fn collect_processes(&self) -> Result<HashMap<Pid, ProcessSnapshot>, TelemetryError> {
        let pids = self.list_pids()?;
        let mut map = HashMap::new();

        for pid in pids {
            if let Some(snap) = self.fetch_process_snapshot(pid) {
                map.insert(pid, snap);
            }
        }

        Ok(map)
    }
}

/// Reads a fixed-size value via `sysctlbyname`, or `None` if the call fails.
fn sysctl_value<T: Copy>(name: &std::ffi::CStr) -> Option<T> {
    let mut value: T = unsafe { mem::zeroed() };
    let mut size = mem::size_of::<T>();
    let rc = unsafe {
        libc::sysctlbyname(
            name.as_ptr(),
            &mut value as *mut T as *mut c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    (rc == 0 && size == mem::size_of::<T>()).then_some(value)
}
