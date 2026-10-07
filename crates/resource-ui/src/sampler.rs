use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};

use resource_core::{
    DiagnosticAlert, DiagnosticEngine, GroupingEngine, HistoryStore, ResourceDelta, SystemSnapshot,
};
use resource_platform::{NativeCollector, SystemCollector};

/// How often a new snapshot is taken.
pub const REFRESH_INTERVAL: Duration = Duration::from_secs(2);

/// Snapshots kept for growth detection: 150 × 2 s = a 5-minute window.
const HISTORY_CAPACITY: usize = 150;

/// Latest telemetry shared between the sampler thread and the UI.
#[derive(Default)]
pub struct Telemetry {
    pub snapshot: Option<SystemSnapshot>,
    pub alerts: Vec<DiagnosticAlert>,
    pub delta: Option<ResourceDelta>,
    pub updated_at: Option<Instant>,
    pub error: Option<String>,
}

/// Spawns a background thread that samples the system forever and asks the UI to repaint.
pub fn spawn(shared: Arc<Mutex<Telemetry>>, repaint: impl Fn() + Send + 'static) {
    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .expect("failed to start sampler runtime");

        runtime.block_on(async move {
            let collector = NativeCollector::new();
            let grouping = GroupingEngine::new();
            let diagnostics = DiagnosticEngine::new();
            let mut history = HistoryStore::new(HISTORY_CAPACITY);

            loop {
                let result = async {
                    let system_metrics = collector.collect_system_metrics().await?;
                    let processes = collector.collect_processes().await?;
                    Ok::<_, resource_platform::TelemetryError>((system_metrics, processes))
                }
                .await;

                {
                    let mut t = shared.lock().unwrap();
                    match result {
                        Ok((system_metrics, processes)) => {
                            let workloads = grouping.classify(&processes);
                            let snapshot = SystemSnapshot {
                                timestamp: SystemTime::now(),
                                system_metrics,
                                processes,
                                workloads,
                            };
                            history.push(snapshot.clone());
                            t.alerts = diagnostics.analyze(&history);
                            t.delta = history.calculate_delta();
                            t.snapshot = Some(snapshot);
                            t.updated_at = Some(Instant::now());
                            t.error = None;
                        }
                        Err(e) => t.error = Some(e.to_string()),
                    }
                }
                repaint();
                tokio::time::sleep(REFRESH_INTERVAL).await;
            }
        });
    });
}
