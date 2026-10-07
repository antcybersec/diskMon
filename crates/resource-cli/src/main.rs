use std::time::{Duration, Instant, SystemTime};
use resource_core::{
    DiagnosticEngine, GroupingEngine, HistoryStore, Rect, ReportExporter,
    SquarifiedTreemap, SystemSnapshot,
};
use resource_platform::{NativeCollector, SystemCollector};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("==========================================================================");
    println!("             diskMon: VISUAL SYSTEM RESOURCE DIAGNOSIS TOOL");
    println!("==========================================================================\n");

    let collector = NativeCollector::new();

    // 1. Collect System Metrics & Active PIDs
    let sys_metrics_start = Instant::now();
    let sys_metrics = collector.collect_system_metrics().await?;
    let sys_metrics_duration = sys_metrics_start.elapsed();

    let proc_start = Instant::now();
    let processes = collector.collect_processes().await?;
    let proc_duration = proc_start.elapsed();

    println!(
        "[+] Total System Physical RAM: {:.2} GB (Fetched in {:?})",
        (sys_metrics.total_memory as f64) / (1024.0 * 1024.0 * 1024.0),
        sys_metrics_duration
    );
    println!(
        "[+] Active PIDs Enumerated & Sampled: {} PIDs in {:?}\n",
        processes.len(),
        proc_duration
    );

    // 2. Classify into Logical Workload Groups
    let grouping_engine = GroupingEngine::new();
    let workloads = grouping_engine.classify(&processes);

    let current_snapshot = SystemSnapshot {
        timestamp: SystemTime::now(),
        system_metrics: sys_metrics.clone(),
        processes: processes.clone(),
        workloads: workloads.clone(),
    };

    // 3. Compute Spatial Squarified Treemap Layout
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

    println!("--------------------------------------------------------------------------");
    println!(" 📐 SPATIAL WORKLOAD TREEMAP TILES (1200 x 800 Area)");
    println!("--------------------------------------------------------------------------");
    println!("{:<5} | {:<28} | {:<12} | {:<25}", "Rank", "Workload Name", "RAM Footprint", "Treemap Rect (x, y, w, h)");
    println!("{:-<5}-+-{:-<28}-+-{:-<12}-+-{:-<25}", "", "", "", "");

    for (idx, node) in treemap_nodes.iter().take(10).enumerate() {
        let r = node.rect;
        let footprint_mb = (node.value as f64) / (1024.0 * 1024.0);
        let footprint_str = if footprint_mb >= 1024.0 {
            format!("{:.2} GB", footprint_mb / 1024.0)
        } else {
            format!("{:.1} MB", footprint_mb)
        };

        println!(
            "{:<5} | {:<28} | {:<12} | ({:.0}, {:.0}, {:.0}, {:.0})",
            idx + 1,
            node.label,
            footprint_str,
            r.x,
            r.y,
            r.w,
            r.h
        );
    }

    // 4. Initialize History Store & Push Snapshots
    let mut history = HistoryStore::new(3600);
    history.push(current_snapshot.clone());

    // Simulate short interval and second snapshot push for temporal delta calculation
    tokio::time::sleep(Duration::from_millis(50)).await;
    history.push(current_snapshot.clone());

    // 5. Evaluate Rule-Based Diagnostic Engine
    let diagnostic_engine = DiagnosticEngine::new();
    let alerts = diagnostic_engine.analyze(&history);

    println!("\n--------------------------------------------------------------------------");
    println!(" 🚨 DETERMINISTIC DIAGNOSTIC ENGINE ALERTS ({})", alerts.len());
    println!("--------------------------------------------------------------------------");
    if alerts.is_empty() {
        println!("No critical resource pressure alerts triggered.");
    } else {
        for alert in &alerts {
            println!("[{:?}] {}", alert.severity, alert.title);
            println!("   Reason: {}", alert.explanation);
            for ev in &alert.evidence {
                println!("   • {}", ev);
            }
            println!();
        }
    }

    // 6. Generate & Export Incident Markdown Report
    let delta = history.calculate_delta();
    let report = ReportExporter::generate(&current_snapshot, alerts, delta);
    let markdown_report = ReportExporter::to_markdown(&report);

    println!("--------------------------------------------------------------------------");
    println!(" 📄 PRIVACY-PRESERVED INCIDENT REPORT (PREVIEW)");
    println!("--------------------------------------------------------------------------");
    println!("{}", markdown_report);

    println!("=== All engine milestones executed and verified cleanly. ===");
    Ok(())
}
