use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ProcessMetrics {
    /// Physical RAM footprint in bytes (ri_phys_footprint on macOS / PSS on Linux)
    pub phys_footprint: u64,
    /// Resident Set Size in bytes (RSS)
    pub rss: u64,
    /// Total virtual memory size in bytes
    pub virtual_size: u64,
    /// Compressed RAM owned by process in bytes (macOS VM compressor)
    pub compressed: u64,
    /// CPU usage percentage (0.0 to 100.0 * num_cores)
    pub cpu_usage_pct: f32,
    /// Cumulative CPU user time in nanoseconds
    pub user_time_ns: u64,
    /// Cumulative CPU system time in nanoseconds
    pub system_time_ns: u64,
    /// Cumulative disk read bytes
    pub disk_read_bytes: u64,
    /// Cumulative disk write bytes
    pub disk_write_bytes: u64,
    /// Number of active threads
    pub thread_count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct SystemMetrics {
    pub total_memory: u64,
    pub free_memory: u64,
    pub active_memory: u64,
    pub inactive_memory: u64,
    pub wired_memory: u64,
    pub compressed_memory: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    /// Global memory pressure percentage (0.0 to 100.0)
    pub memory_pressure_pct: f32,
    /// Global CPU utilization percentage (0.0 to 100.0)
    pub global_cpu_pct: f32,
}
