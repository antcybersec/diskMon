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

impl Default for DiagnosticEngine {
    fn default() -> Self {
        Self::new()
    }
}

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

        // Rule 4: Sustained High CPU (every recent sample at or above one full core's worth)
        let recent: Vec<_> = history.snapshots().rev().take(CPU_WINDOW_SAMPLES).collect();
        if recent.len() == CPU_WINDOW_SAMPLES {
            let window_secs = recent[0]
                .timestamp
                .duration_since(recent[recent.len() - 1].timestamp)
                .unwrap_or_default()
                .as_secs_f64();
            for workload in &latest.workloads {
                let samples: Vec<f32> = recent
                    .iter()
                    .filter_map(|s| s.workloads.iter().find(|w| w.id == workload.id))
                    .map(|w| w.aggregated_metrics.cpu_usage_pct)
                    .collect();
                if samples.len() == CPU_WINDOW_SAMPLES && samples.iter().all(|&c| c >= SUSTAINED_CPU_PCT) {
                    let avg = samples.iter().sum::<f32>() / samples.len() as f32;
                    alerts.push(DiagnosticAlert {
                        severity: DiagnosticSeverity::Warning,
                        title: format!("Sustained High CPU: {}", workload.name),
                        explanation: format!(
                            "Workload '{}' has used at least {:.0}% CPU for the last {:.0} seconds (average {:.0}%).",
                            workload.name, SUSTAINED_CPU_PCT, window_secs, avg
                        ),
                        target_workload_id: Some(workload.id.clone()),
                        evidence: vec![
                            format!("Average CPU: {:.0}%", avg),
                            format!("Time Window: {:.0} seconds", window_secs),
                            format!("Member Processes: {}", workload.member_pids.len()),
                        ],
                    });
                }
            }
        }

        // Rule 5: Process Storm (many new processes in a short window)
        if let Some(earlier) = history.snapshots().rev().nth(STORM_LOOKBACK_SAMPLES) {
            let mut spawned_by_workload: Vec<(&str, &str, usize)> = latest
                .workloads
                .iter()
                .map(|w| {
                    let fresh = w
                        .member_pids
                        .iter()
                        .filter(|pid| !earlier.processes.contains_key(pid))
                        .count();
                    (w.id.as_str(), w.name.as_str(), fresh)
                })
                .filter(|(_, _, fresh)| *fresh > 0)
                .collect();
            let total: usize = spawned_by_workload.iter().map(|(_, _, n)| n).sum();
            if total >= STORM_MIN_PROCESSES {
                spawned_by_workload.sort_by_key(|(_, _, n)| std::cmp::Reverse(*n));
                let window_secs = latest
                    .timestamp
                    .duration_since(earlier.timestamp)
                    .unwrap_or_default()
                    .as_secs_f64();
                let (top_id, top_name, top_count) = spawned_by_workload[0];
                alerts.push(DiagnosticAlert {
                    severity: DiagnosticSeverity::Warning,
                    title: format!("Process Storm: {} new processes", total),
                    explanation: format!(
                        "{} processes started in the last {:.0} seconds; the most came from '{}' ({}).",
                        total, window_secs, top_name, top_count
                    ),
                    target_workload_id: Some(top_id.to_string()),
                    evidence: spawned_by_workload
                        .iter()
                        .take(3)
                        .map(|(_, name, n)| format!("{}: +{} processes", name, n))
                        .collect(),
                });
            }
        }

        alerts
    }
}

/// Consecutive samples a workload must stay above [`SUSTAINED_CPU_PCT`] (≈30 s at a 2 s refresh).
const CPU_WINDOW_SAMPLES: usize = 15;
/// 100% = one CPU core fully busy.
const SUSTAINED_CPU_PCT: f32 = 100.0;
/// How far back to look for newly started processes (≈20 s at a 2 s refresh).
const STORM_LOOKBACK_SAMPLES: usize = 10;
const STORM_MIN_PROCESSES: usize = 30;
