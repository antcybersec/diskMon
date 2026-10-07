use serde::{Deserialize, Serialize};
use crate::history::HistoryStore;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticAlert {
    pub severity: DiagnosticSeverity,
    pub title: String,
    pub explanation: String,
    pub target_workload_id: Option<String>,
    pub evidence: Vec<String>,
}

pub struct DiagnosticEngine;

impl DiagnosticEngine {
    pub fn new() -> Self {
        Self
    }

    /// Run rule-based evaluation against current history store and latest snapshot
    pub fn analyze(&self, history: &HistoryStore) -> Vec<DiagnosticAlert> {
        let mut alerts = Vec::new();
        let latest = match history.latest() {
            Some(s) => s,
            None => return alerts,
        };

        let total_ram = latest.system_metrics.total_memory;

        // Rule 1: High Single Workload Footprint (> 25% of Total Machine RAM)
        if total_ram > 0 {
            for workload in &latest.workloads {
                let footprint = workload.aggregated_metrics.phys_footprint;
                let pct = (footprint as f64 / total_ram as f64) * 100.0;
                if pct >= 25.0 {
                    let gb = (footprint as f64) / (1024.0 * 1024.0 * 1024.0);
                    alerts.push(DiagnosticAlert {
                        severity: if pct >= 40.0 {
                            DiagnosticSeverity::Critical
                        } else {
                            DiagnosticSeverity::Warning
                        },
                        title: format!("High Memory Share: {}", workload.name),
                        explanation: format!(
                            "Workload '{}' is consuming {:.1}% of total machine RAM ({:.2} GB across {} member processes).",
                            workload.name, pct, gb, workload.member_pids.len()
                        ),
                        target_workload_id: Some(workload.id.clone()),
                        evidence: vec![
                            format!("Physical Footprint: {:.2} GB", gb),
                            format!("Member Processes: {}", workload.member_pids.len()),
                            format!("Share of Machine RAM: {:.1}%", pct),
                        ],
                    });
                }
            }
        }

        // Rule 2: Sustained Memory Growth (Delta Analysis)
        if let Some(delta) = history.calculate_delta() {
            if delta.duration_secs >= 5.0 {
                for w_delta in &delta.workload_deltas {
                    if w_delta.byte_change > 100 * 1024 * 1024 {
                        // Growth > 100 MB
                        let mb_growth = (w_delta.byte_change as f64) / (1024.0 * 1024.0);
                        alerts.push(DiagnosticAlert {
                            severity: DiagnosticSeverity::Warning,
                            title: format!("Sustained Memory Growth: {}", w_delta.workload_name),
                            explanation: format!(
                                "Workload '{}' grew by +{:.1} MB over the last {:.0} seconds.",
                                w_delta.workload_name, mb_growth, delta.duration_secs
                            ),
                            target_workload_id: Some(w_delta.workload_id.clone()),
                            evidence: vec![
                                format!("Growth Delta: +{:.1} MB", mb_growth),
                                format!("Time Window: {:.0} seconds", delta.duration_secs),
                                format!("Initial Footprint: {:.1} MB", (w_delta.initial_bytes as f64) / (1024.0 * 1024.0)),
                                format!("Final Footprint: {:.1} MB", (w_delta.final_bytes as f64) / (1024.0 * 1024.0)),
                            ],
                        });
                    }
                }
            }
        }

        // Rule 3: Elevated Global Memory Pressure
        if latest.system_metrics.memory_pressure_pct >= 75.0 {
            alerts.push(DiagnosticAlert {
                severity: DiagnosticSeverity::Critical,
                title: "Elevated Global Memory Pressure".to_string(),
                explanation: format!(
                    "System memory pressure is currently at {:.1}%. OS VM subsystem may begin swapping RAM pages to disk.",
                    latest.system_metrics.memory_pressure_pct
                ),
                target_workload_id: None,
                evidence: vec![
                    format!("Memory Pressure: {:.1}%", latest.system_metrics.memory_pressure_pct),
                    format!("Total Swap Used: {:.1} MB", (latest.system_metrics.swap_used as f64) / (1024.0 * 1024.0)),
                ],
            });
        }

        alerts
    }
}
