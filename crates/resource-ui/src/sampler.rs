use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};

use resource_core::{
    DiagnosticAlert, DiagnosticEngine, GroupingEngine, HistoryStore, Pid, ProcessSnapshot,
    ResourceDelta, SystemSnapshot,
};
use resource_platform::{NativeCollector, SystemCollector};

/// How often a new snapshot is taken.
pub const REFRESH_INTERVAL: Duration = Duration::from_secs(2);

/// Snapshots kept for growth detection and sparklines: 150 × 2 s = a 5-minute window.
pub const HISTORY_CAPACITY: usize = 150;

/// Per-process rates derived from the change between two samples.
#[derive(Debug, Clone, Copy, Default)]
pub struct Rates {
    /// 100% = one CPU core fully busy.
    pub cpu_pct: f32,
    pub read_bps: f64,
    pub write_bps: f64,
}

/// Latest telemetry shared between the sampler thread and the UI.
#[derive(Default)]
pub struct Telemetry {
    pub snapshot: Option<SystemSnapshot>,
    pub alerts: Vec<DiagnosticAlert>,
    pub delta: Option<ResourceDelta>,
    pub updated_at: Option<Instant>,
    pub sample_time: Duration,
    pub error: Option<String>,
    pub rates: HashMap<Pid, Rates>,
    /// Workload id → rates summed over its member processes.
    pub workload_rates: HashMap<String, Rates>,
    /// Workload id → physical footprint per sample, oldest first.
    pub workload_series: HashMap<String, VecDeque<u64>>,
    /// Summed footprint of all workloads per sample, oldest first.
    pub total_series: VecDeque<u64>,
}

/// Spawns a background thread that samples the system until the app exits.
/// Sampling is skipped while `paused` is set.
pub fn spawn(shared: Arc<Mutex<Telemetry>>, paused: Arc<AtomicBool>, repaint: impl Fn() + Send + 'static) {
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
            let mut previous: Option<(Instant, HashMap<Pid, ProcessSnapshot>)> = None;

            loop {
                if paused.load(Ordering::Relaxed) {
                    tokio::time::sleep(Duration::from_millis(250)).await;
                    continue;
                }

                let started = Instant::now();
                let result = async {
                    let system_metrics = collector.collect_system_metrics().await?;
                    let processes = collector.collect_processes().await?;
                    Ok::<_, resource_platform::TelemetryError>((system_metrics, processes))
                }
                .await;
                let sample_time = started.elapsed();

                match result {
                    Ok((system_metrics, mut processes)) => {
                        let rates = previous
                            .as_ref()
                            .map(|(at, prev)| compute_rates(prev, &processes, started.duration_since(*at)))
                            .unwrap_or_default();
                        for (pid, r) in &rates {
                            if let Some(p) = processes.get_mut(pid) {
                                p.metrics.cpu_usage_pct = r.cpu_pct;
                            }
                        }

                        let workloads = grouping.classify(&processes);
                        let workload_rates: HashMap<String, Rates> = workloads
                            .iter()
                            .map(|w| {
                                let sum = w.member_pids.iter().filter_map(|p| rates.get(p)).fold(
                                    Rates::default(),
                                    |acc, r| Rates {
                                        cpu_pct: acc.cpu_pct + r.cpu_pct,
                                        read_bps: acc.read_bps + r.read_bps,
                                        write_bps: acc.write_bps + r.write_bps,
                                    },
                                );
                                (w.id.clone(), sum)
                            })
                            .collect();

                        let snapshot = SystemSnapshot {
                            timestamp: SystemTime::now(),
                            system_metrics,
                            processes: processes.clone(),
                            workloads,
                        };
                        history.push(snapshot.clone());
                        previous = Some((started, processes));

                        let mut t = shared.lock().unwrap();
                        record_series(&mut t, &snapshot);
                        // diskMon's own memory grows while its 5-minute history fills; don't flag itself.
                        let own = std::process::id();
                        let own_workload = snapshot.workloads.iter().find(|w| w.member_pids.contains(&own)).map(|w| w.id.clone());
                        t.alerts = diagnostics
                            .analyze(&history)
                            .into_iter()
                            .filter(|a| a.target_workload_id.is_none() || a.target_workload_id != own_workload)
                            .collect();
                        t.delta = history.calculate_delta();
                        t.snapshot = Some(snapshot);
                        t.rates = rates;
                        t.workload_rates = workload_rates;
                        t.updated_at = Some(Instant::now());
                        t.sample_time = sample_time;
                        t.error = None;
                    }
                    Err(e) => shared.lock().unwrap().error = Some(e.to_string()),
                }
                repaint();
                tokio::time::sleep(REFRESH_INTERVAL).await;
            }
        });
    });
}

/// CPU % and disk throughput from cumulative counters, for processes seen in both samples.
fn compute_rates(
    prev: &HashMap<Pid, ProcessSnapshot>,
    curr: &HashMap<Pid, ProcessSnapshot>,
    elapsed: Duration,
) -> HashMap<Pid, Rates> {
    let secs = elapsed.as_secs_f64();
    if secs <= 0.0 {
        return HashMap::new();
    }
    curr.iter()
        .filter_map(|(pid, now)| {
            let before = prev.get(pid)?;
            let (a, b) = (&before.metrics, &now.metrics);
            let cpu_ns = (b.user_time_ns + b.system_time_ns).saturating_sub(a.user_time_ns + a.system_time_ns);
            Some((
                *pid,
                Rates {
                    cpu_pct: (cpu_ns as f64 / 1e9 / secs * 100.0) as f32,
                    read_bps: b.disk_read_bytes.saturating_sub(a.disk_read_bytes) as f64 / secs,
                    write_bps: b.disk_write_bytes.saturating_sub(a.disk_write_bytes) as f64 / secs,
                },
            ))
        })
        .collect()
}

fn record_series(t: &mut Telemetry, snapshot: &SystemSnapshot) {
    let push = |series: &mut VecDeque<u64>, value: u64| {
        if series.len() >= HISTORY_CAPACITY {
            series.pop_front();
        }
        series.push_back(value);
    };

    let total = snapshot.workloads.iter().map(|w| w.aggregated_metrics.phys_footprint).sum();
    push(&mut t.total_series, total);

    for w in &snapshot.workloads {
        push(t.workload_series.entry(w.id.clone()).or_default(), w.aggregated_metrics.phys_footprint);
    }
    // Forget workloads that have exited.
    t.workload_series.retain(|id, _| snapshot.workloads.iter().any(|w| &w.id == id));
}
