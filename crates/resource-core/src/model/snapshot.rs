use std::collections::HashMap;
use std::time::SystemTime;
use serde::{Deserialize, Serialize};
use super::metrics::SystemMetrics;
use super::process::{Pid, ProcessSnapshot};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GroupCategory {
    Browser,
    Ide,
    LanguageServer,
    ContainerRuntime,
    Database,
    LocalLlm,
    BuildSystem,
    SystemDaemon,
    UserApplication,
    Unclassified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadGroup {
    pub id: String,
    pub name: String,
    pub category: GroupCategory,
    pub root_pid: Pid,
    pub member_pids: Vec<Pid>,
    pub aggregated_metrics: super::metrics::ProcessMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub timestamp: SystemTime,
    pub system_metrics: SystemMetrics,
    pub processes: HashMap<Pid, ProcessSnapshot>,
    pub workloads: Vec<WorkloadGroup>,
}
