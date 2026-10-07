use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, UNIX_EPOCH};

use async_trait::async_trait;
use resource_core::{Pid, ProcessInfo, ProcessMetrics, ProcessSnapshot, SystemMetrics};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use crate::traits::{SystemCollector, TelemetryError};

/// Windows telemetry backed by the `sysinfo` crate.
///
/// The `System` handle is kept between refreshes so CPU usage can be computed
/// from the delta since the previous sample.
pub struct WindowsCollector {
    system: Mutex<System>,
}

impl WindowsCollector {
    pub fn new() -> Self {
        Self {
            system: Mutex::new(System::new()),
        }
    }

    fn refresh_kind() -> ProcessRefreshKind {
        ProcessRefreshKind::nothing()
            .with_memory()
            .with_cpu()
            .with_disk_usage()
            .with_exe(UpdateKind::OnlyIfNotSet)
            .with_cmd(UpdateKind::OnlyIfNotSet)
    }
}

impl Default for WindowsCollector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SystemCollector for WindowsCollector {
    async fn collect_system_metrics(&self) -> Result<SystemMetrics, TelemetryError> {
        let mut sys = self
            .system
            .lock()
            .map_err(|_| TelemetryError::OsError("system handle poisoned".into()))?;
        sys.refresh_memory();
        sys.refresh_cpu_usage();

        let total = sys.total_memory();
        let used = sys.used_memory();

        Ok(SystemMetrics {
            total_memory: total,
            free_memory: sys.free_memory(),
            active_memory: used,
            inactive_memory: 0,
            wired_memory: 0,
            compressed_memory: 0,
            swap_used: sys.used_swap(),
            swap_total: sys.total_swap(),
            // Windows reports "memory load" as the share of physical memory in use.
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
            .map(|(pid, p)| {
                let pid = pid.as_u32();
                let name = p.name().to_string_lossy().trim().to_string();
                let disk = p.disk_usage();
                // accumulated_cpu_time is in milliseconds; Windows doesn't split user/system here.
                let cpu_ns = p.accumulated_cpu_time().saturating_mul(1_000_000);

                let info = ProcessInfo {
                    pid,
                    ppid: p.parent().map(|pp| pp.as_u32()).unwrap_or(0),
                    name: if name.is_empty() { format!("PID {}", pid) } else { name },
                    executable_path: p.exe().map(|e| e.to_path_buf()),
                    command_line: p.cmd().iter().map(|a| a.to_string_lossy().into_owned()).collect(),
                    working_directory: None,
                    user_id: 0,
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
                    thread_count: 0,
                };

                (pid, ProcessSnapshot { info, metrics })
            })
            .collect();

        Ok(map)
    }
}
