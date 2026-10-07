use std::collections::HashMap;
use crate::model::{GroupCategory, Pid, ProcessMetrics, ProcessSnapshot, WorkloadGroup};

pub struct GroupingEngine;

impl GroupingEngine {
    pub fn new() -> Self {
        Self
    }

    /// Group raw process snapshots into logical workload groups based on executable signatures,
    /// parent-child relationships, and command-line arguments.
    pub fn classify(&self, processes: &HashMap<Pid, ProcessSnapshot>) -> Vec<WorkloadGroup> {
        let mut groups: HashMap<String, WorkloadGroup> = HashMap::new();

        for (pid, proc_snap) in processes {
            let name = &proc_snap.info.name;
            let group_key = self.derive_group_key(proc_snap);
            let category = self.derive_category(&group_key, name);

            let entry = groups.entry(group_key.clone()).or_insert_with(|| WorkloadGroup {
                id: group_key.clone(),
                name: self.format_group_name(&group_key, name),
                category,
                root_pid: *pid,
                member_pids: Vec::new(),
                aggregated_metrics: ProcessMetrics::default(),
            });

            entry.member_pids.push(*pid);

            // Aggregate metrics across member processes
            let m = &proc_snap.metrics;
            entry.aggregated_metrics.phys_footprint += m.phys_footprint;
            entry.aggregated_metrics.rss += m.rss;
            entry.aggregated_metrics.virtual_size += m.virtual_size;
            entry.aggregated_metrics.compressed += m.compressed;
            entry.aggregated_metrics.cpu_usage_pct += m.cpu_usage_pct;
            entry.aggregated_metrics.user_time_ns += m.user_time_ns;
            entry.aggregated_metrics.system_time_ns += m.system_time_ns;
            entry.aggregated_metrics.disk_read_bytes += m.disk_read_bytes;
            entry.aggregated_metrics.disk_write_bytes += m.disk_write_bytes;
            entry.aggregated_metrics.thread_count += m.thread_count;
        }

        let mut result: Vec<WorkloadGroup> = groups.into_values().collect();
        // Sort by physical memory footprint descending
        result.sort_by(|a, b| b.aggregated_metrics.phys_footprint.cmp(&a.aggregated_metrics.phys_footprint));
        result
    }

    fn derive_group_key(&self, proc_snap: &ProcessSnapshot) -> String {
        let name_lower = proc_snap.info.name.to_lowercase();
        let path_lower = proc_snap
            .info
            .executable_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        if name_lower.contains("brave") || path_lower.contains("brave") {
            "brave".to_string()
        } else if name_lower.contains("chrome") || path_lower.contains("chrome") {
            "chrome".to_string()
        } else if name_lower.contains("firefox") || path_lower.contains("firefox") {
            "firefox".to_string()
        } else if name_lower.contains("antigravity") || path_lower.contains("antigravity") {
            "antigravity".to_string()
        } else if name_lower.contains("code") || path_lower.contains("vscode") {
            "vscode".to_string()
        } else if name_lower.contains("gopls") || path_lower.contains("gopls") {
            "gopls".to_string()
        } else if name_lower.contains("rust-analyzer") || path_lower.contains("rust-analyzer") {
            "rust_analyzer".to_string()
        } else if name_lower.contains("tsserver") || path_lower.contains("tsserver") {
            "tsserver".to_string()
        } else if name_lower.contains("docker") || path_lower.contains("docker") || name_lower.contains("containerd") {
            "docker".to_string()
        } else if name_lower.contains("ollama") || path_lower.contains("ollama") {
            "ollama".to_string()
        } else if path_lower.starts_with("/system")
            || path_lower.starts_with("/usr/libexec")
            || path_lower.starts_with("/usr/sbin")
            || path_lower.starts_with("c:\\windows\\")
        {
            "system_daemons".to_string()
        } else {
            proc_snap.info.name.trim().to_string()
        }
    }

    fn format_group_name(&self, key: &str, raw_name: &str) -> String {
        match key {
            "brave" => "Brave Browser".to_string(),
            "chrome" => "Google Chrome".to_string(),
            "firefox" => "Mozilla Firefox".to_string(),
            "antigravity" => "Antigravity IDE".to_string(),
            "vscode" => "VS Code IDE".to_string(),
            "gopls" => "Go Language Server (gopls)".to_string(),
            "rust_analyzer" => "Rust Analyzer".to_string(),
            "tsserver" => "TypeScript Language Server".to_string(),
            "docker" => "Docker Container Runtime".to_string(),
            "ollama" => "Ollama Local LLM".to_string(),
            "system_daemons" if cfg!(windows) => "Windows System Processes".to_string(),
            "system_daemons" => "macOS System Daemons".to_string(),
            _ => raw_name.trim().to_string(),
        }
    }

    fn derive_category(&self, key: &str, _raw_name: &str) -> GroupCategory {
        match key {
            "brave" | "chrome" | "firefox" => GroupCategory::Browser,
            "antigravity" | "vscode" => GroupCategory::Ide,
            "gopls" | "rust_analyzer" | "tsserver" => GroupCategory::LanguageServer,
            "docker" => GroupCategory::ContainerRuntime,
            "ollama" => GroupCategory::LocalLlm,
            "system_daemons" => GroupCategory::SystemDaemon,
            _ => GroupCategory::UserApplication,
        }
    }
}
