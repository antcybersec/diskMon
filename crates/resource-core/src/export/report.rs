use std::path::Path;
use serde::{Deserialize, Serialize};
use crate::diagnostics::DiagnosticAlert;
use crate::history::ResourceDelta;
use crate::model::SystemSnapshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub report_id: String,
    pub generated_at: String,
    pub system_ram_gb: f64,
    pub active_pid_count: usize,
    pub workloads_summary: Vec<WorkloadSummaryExport>,
    pub alerts: Vec<DiagnosticAlert>,
    pub recent_delta: Option<ResourceDelta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadSummaryExport {
    pub name: String,
    pub category: String,
    pub physical_footprint_mb: f64,
    pub pid_count: usize,
}

pub struct ReportExporter;

impl ReportExporter {
    pub fn generate(
        snapshot: &SystemSnapshot,
        alerts: Vec<DiagnosticAlert>,
        recent_delta: Option<ResourceDelta>,
    ) -> DiagnosticReport {
        let now = chrono::Local::now().to_rfc3339();
        let report_id = format!("incident-{}", chrono::Local::now().format("%Y%m%d-%H%M%S"));

        let workloads_summary = snapshot
            .workloads
            .iter()
            .map(|w| WorkloadSummaryExport {
                name: Self::redact_sensitive_text(&w.name),
                category: format!("{:?}", w.category),
                physical_footprint_mb: (w.aggregated_metrics.phys_footprint as f64) / (1024.0 * 1024.0),
                pid_count: w.member_pids.len(),
            })
            .collect();

        DiagnosticReport {
            report_id,
            generated_at: now,
            system_ram_gb: (snapshot.system_metrics.total_memory as f64) / (1024.0 * 1024.0 * 1024.0),
            active_pid_count: snapshot.processes.len(),
            workloads_summary,
            alerts,
            recent_delta,
        }
    }

    pub fn to_markdown(report: &DiagnosticReport) -> String {
        let mut md = String::new();
        md.push_str(&format!("# Diagnostic Incident Report: {}\n", report.report_id));
        md.push_str(&format!("**Generated At**: {}\n", report.generated_at));
        md.push_str(&format!("**System Physical RAM**: {:.2} GB\n", report.system_ram_gb));
        md.push_str(&format!("**Active PIDs Sampled**: {}\n\n", report.active_pid_count));

        md.push_str("## 🚨 Diagnostic Alerts\n");
        if report.alerts.is_empty() {
            md.push_str("No critical resource pressure alerts observed.\n\n");
        } else {
            for alert in &report.alerts {
                md.push_str(&format!("### [{:?}] {}\n", alert.severity, alert.title));
                md.push_str(&format!("{}\n", alert.explanation));
                md.push_str("**Evidence**:\n");
                for ev in &alert.evidence {
                    md.push_str(&format!("- {}\n", ev));
                }
                md.push('\n');
            }
        }

        md.push_str("## 📊 Workload Resource Footprint Treemap\n");
        md.push_str("| Workload Name | Category | Physical RAM (MB) | Active PIDs |\n");
        md.push_str("| :--- | :--- | :--- | :--- |\n");
        for w in &report.workloads_summary {
            md.push_str(&format!(
                "| {} | {} | {:.1} MB | {} |\n",
                w.name, w.category, w.physical_footprint_mb, w.pid_count
            ));
        }

        md
    }

    fn redact_sensitive_text(input: &str) -> String {
        // Redact home directory paths e.g. /Users/anantkumar -> /Users/[REDACTED]
        if let Some(user_dir) = dirs::home_dir() {
            let user_str = user_dir.to_string_lossy();
            if !user_str.is_empty() && input.contains(user_str.as_ref()) {
                let redacted_path = Path::new(user_str.as_ref())
                    .parent()
                    .map(|p| p.join("[REDACTED]"))
                    .unwrap_or_else(|| Path::new("/Users/[REDACTED]").to_path_buf());
                return input.replace(user_str.as_ref(), &redacted_path.to_string_lossy());
            }
        }
        input.to_string()
    }
}
