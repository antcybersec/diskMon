use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, UNIX_EPOCH};

use async_trait::async_trait;
use resource_core::{Pid, ProcessInfo, ProcessMetrics, ProcessSnapshot, SystemMetrics};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use crate::traits::{SystemCollector, TelemetryError};

/// Windows and Linux telemetry backed by the `sysinfo` crate.
///
/// The `System` handle is kept between refreshes so CPU usage can be computed
/// from the delta since the previous sample.
pub struct SysinfoCollector {
    system: Mutex<System>,
}

impl SysinfoCollector {
    pub fn new() -> Self {
        Self {
            system: Mutex::new(System::new()),
        }
    }

    fn refresh_kind() -> ProcessRefreshKind {
        let kind = ProcessRefreshKind::nothing()
            .with_memory()
            .with_cpu()
            .with_disk_usage()
            .with_exe(UpdateKind::OnlyIfNotSet)
            .with_cmd(UpdateKind::OnlyIfNotSet);
        // Linux exposes each thread as a task, which gives us a thread count.
        if cfg!(target_os = "linux") {
            kind.with_tasks().with_user(UpdateKind::OnlyIfNotSet)
        } else {
            kind
        }
    }
}

impl Default for SysinfoCollector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SystemCollector for SysinfoCollector {
    async fn collect_system_metrics(&self) -> Result<SystemMetrics, TelemetryError> {
        let mut sys = self
            .system
            .lock()
            .map_err(|_| TelemetryError::OsError("system handle poisoned".into()))?;
        sys.refresh_memory();
        sys.refresh_cpu_usage();

        let total = sys.total_memory();
        let used = sys.used_memory();
        let free = sys.free_memory();

        Ok(SystemMetrics {
            total_memory: total,
            free_memory: free,
            active_memory: used,
            // Memory the OS can hand back on demand (page cache on Linux, standby on Windows).
            inactive_memory: sys.available_memory().saturating_sub(free),
            wired_memory: 0,
            compressed_memory: 0,
            swap_used: sys.used_swap(),
            swap_total: sys.total_swap(),
            // Share of physical memory in use (Windows calls this "memory load").
            memory_pressure_pct: if total > 0 {
                (used as f64 / total as f64 * 100.0) as f32
            } else {
                0.0
            },
            global_cpu_pct: sys.global_cpu_usage(),
        })
    }

    async fn collect_processes(&self) -> Result<HashMap<Pid, ProcessSnapshot>, TelemetryError> {
        let mut sys = self
            .system
            .lock()
            .map_err(|_| TelemetryError::OsError("system handle poisoned".into()))?;
        sys.refresh_processes_specifics(ProcessesToUpdate::All, true, Self::refresh_kind());

        let map = sys
            .processes()
            .iter()
            // On Linux, sysinfo also lists each thread as a "process"; keep real processes only.
            .filter(|(_, p)| p.thread_kind().is_none_or(|k| k == sysinfo::ThreadKind::Kernel))
            .map(|(pid, p)| {
                let pid = pid.as_u32();
                let name = p.name().to_string_lossy().trim().to_string();
                let disk = p.disk_usage();
                // accumulated_cpu_time is in milliseconds and isn't split into user/system time.
                let cpu_ns = p.accumulated_cpu_time().saturating_mul(1_000_000);

                let info = ProcessInfo {
                    pid,
                    ppid: p.parent().map(|pp| pp.as_u32()).unwrap_or(0),
                    name: if name.is_empty() { format!("PID {}", pid) } else { name },
                    executable_path: p.exe().map(|e| e.to_path_buf()),
                    command_line: p.cmd().iter().map(|a| a.to_string_lossy().into_owned()).collect(),
                    working_directory: None,
                    user_id: user_id(p),
                    start_time: Some(UNIX_EPOCH + Duration::from_secs(p.start_time())),
                };

                let metrics = ProcessMetrics {
                    phys_footprint: p.memory(),
                    rss: p.memory(),
                    virtual_size: p.virtual_memory(),
                    compressed: 0,
                    cpu_usage_pct: p.cpu_usage(),
                    user_time_ns: cpu_ns,
                    system_time_ns: 0,
                    disk_read_bytes: disk.total_read_bytes,
                    disk_write_bytes: disk.total_written_bytes,
                    thread_count: p.tasks().map(|t| t.len() as u32).unwrap_or(0),
                };

                (pid, ProcessSnapshot { info, metrics })
            })
            .collect();

        Ok(map)
    }
}

/// Numeric owner of the process on Linux; Windows SIDs don't map to a number, so 0 there.
#[cfg(target_os = "linux")]
fn user_id(p: &sysinfo::Process) -> u32 {
    p.user_id().map(|uid| **uid).unwrap_or(u32::MAX)
}

#[cfg(not(target_os = "linux"))]
fn user_id(_p: &sysinfo::Process) -> u32 {
    0
}
