use std::path::PathBuf;
use std::time::SystemTime;
use serde::{Deserialize, Serialize};

pub type Pid = u32;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: Pid,
    pub ppid: Pid,
    pub name: String,
    pub executable_path: Option<PathBuf>,
    pub command_line: Vec<String>,
    pub working_directory: Option<PathBuf>,
    pub user_id: u32,
    pub start_time: Option<SystemTime>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProcessSnapshot {
    pub info: ProcessInfo,
    pub metrics: super::metrics::ProcessMetrics,
}
