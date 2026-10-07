use std::collections::HashMap;
use async_trait::async_trait;
use resource_core::{Pid, ProcessSnapshot, SystemMetrics};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TelemetryError {
    #[error("OS API call failed: {0}")]
    OsError(String),
    #[error("Permission denied for target PID {0}")]
    PermissionDenied(Pid),
    #[error("Process not found: {0}")]
    ProcessNotFound(Pid),
    #[error("Platform not supported")]
    UnsupportedPlatform,
}

#[async_trait]
pub trait SystemCollector: Send + Sync {
    async fn collect_system_metrics(&self) -> Result<SystemMetrics, TelemetryError>;
    async fn collect_processes(&self) -> Result<HashMap<Pid, ProcessSnapshot>, TelemetryError>;
}
