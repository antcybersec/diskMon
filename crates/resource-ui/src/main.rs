use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use resource_core::{
    DiagnosticAlert, DiagnosticEngine, GroupingEngine, HistoryStore, Rect,
    ResourceDelta, SquarifiedTreemap, SystemSnapshot, TreemapNode,
};
use resource_platform::{NativeCollector, SystemCollector};

pub struct AppState {
    pub current_snapshot: Option<SystemSnapshot>,
    pub treemap_nodes: Vec<TreemapNode>,
    pub alerts: Vec<DiagnosticAlert>,
    pub selected_workload_id: Option<String>,
    pub active_view_mode: ViewMode,
    pub history_len: usize,
    pub latest_delta: Option<ResourceDelta>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ViewMode {
    PhysicalMemory,
    CpuUtilization,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== diskMon: Visual System Resource Diagnosis Desktop App Engine ===");

    let collector = Arc::new(NativeCollector::new());
    let grouping_engine = Arc::new(GroupingEngine::new());
    let diagnostic_engine = Arc::new(DiagnosticEngine::new());
    let history_store = Arc::new(Mutex::new(HistoryStore::new(3600)));

    let state = Arc::new(Mutex::new(AppState {
        current_snapshot: None,
        treemap_nodes: Vec::new(),
        alerts: Vec::new(),
        selected_workload_id: None,
        active_view_mode: ViewMode::PhysicalMemory,
        history_len: 0,
        latest_delta: None,
    }));

    let state_clone = Arc::clone(&state);
    let collector_clone = Arc::clone(&collector);
    let grouping_clone = Arc::clone(&grouping_engine);
    let diag_clone = Arc::clone(&diagnostic_engine);
    let history_clone = Arc::clone(&history_store);

    // Initial Telemetry Refresh Cycle
    let sys_metrics = collector_clone.collect_system_metrics().await?;
    let processes = collector_clone.collect_processes().await?;
    let workloads = grouping_clone.classify(&processes);

    let snapshot = SystemSnapshot {
        timestamp: SystemTime::now(),
        system_metrics: sys_metrics,
        processes: processes.clone(),
        workloads: workloads.clone(),
    };

    let bounds = Rect {
        x: 0.0,
        y: 0.0,
        w: 1200.0,
        h: 800.0,
    };

    let treemap_items: Vec<(String, String, u64)> = workloads
        .iter()
        .map(|w| (w.id.clone(), w.name.clone(), w.aggregated_metrics.phys_footprint))
        .collect();

    let treemap_nodes = SquarifiedTreemap::layout(&treemap_items, bounds);

    {
        let mut hist = history_clone.lock().unwrap();
        hist.push(snapshot.clone());
        let alerts = diag_clone.analyze(&hist);
        let delta = hist.calculate_delta();
        let h_len = hist.len();

        let mut app_state = state_clone.lock().unwrap();
        app_state.current_snapshot = Some(snapshot);
        app_state.treemap_nodes = treemap_nodes;
        app_state.alerts = alerts;
        app_state.history_len = h_len;
        app_state.latest_delta = delta;
    }

    let final_state = state.lock().unwrap();
    println!("Physical RAM: {:.2} GB", (final_state.current_snapshot.as_ref().unwrap().system_metrics.total_memory as f64) / (1024.0 * 1024.0 * 1024.0));
    println!("Active PIDs: {}", final_state.current_snapshot.as_ref().unwrap().processes.len());
    println!("Treemap Nodes Solved: {}", final_state.treemap_nodes.len());
    println!("Diagnostic Alerts Evaluated: {}", final_state.alerts.len());
    println!("diskMon desktop UI state engine initialized cleanly.");

    Ok(())
}
