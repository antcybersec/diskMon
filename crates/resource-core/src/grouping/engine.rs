use std::collections::HashMap;
use crate::model::{GroupCategory, Pid, ProcessMetrics, ProcessSnapshot, WorkloadGroup};

/// A known workload: matched when any needle appears in the lowercased process
/// name or executable path.
struct KnownWorkload {
    key: &'static str,
    name: &'static str,
    category: GroupCategory,
    name_needles: &'static [&'static str],
    path_needles: &'static [&'static str],
}

/// Checked in order, so more specific entries (Xcode) come before generic ones (code).
const KNOWN: &[KnownWorkload] = &[
    KnownWorkload { key: "brave", name: "Brave Browser", category: GroupCategory::Browser, name_needles: &["brave"], path_needles: &["brave"] },
    KnownWorkload { key: "chrome", name: "Google Chrome", category: GroupCategory::Browser, name_needles: &["chrome"], path_needles: &["chrome"] },
    KnownWorkload { key: "firefox", name: "Mozilla Firefox", category: GroupCategory::Browser, name_needles: &["firefox"], path_needles: &["firefox"] },
    KnownWorkload { key: "edge", name: "Microsoft Edge", category: GroupCategory::Browser, name_needles: &["msedge"], path_needles: &["microsoft edge"] },
    KnownWorkload { key: "arc", name: "Arc", category: GroupCategory::Browser, name_needles: &[], path_needles: &["/arc.app/"] },
    KnownWorkload { key: "safari", name: "Safari & WebKit", category: GroupCategory::Browser, name_needles: &["safari", "com.apple.webkit"], path_needles: &["/safari.app/"] },
    KnownWorkload { key: "antigravity", name: "Antigravity IDE", category: GroupCategory::Ide, name_needles: &["antigravity"], path_needles: &["antigravity"] },
    KnownWorkload { key: "cursor", name: "Cursor", category: GroupCategory::Ide, name_needles: &[], path_needles: &["/cursor.app/", "\\cursor\\"] },
    KnownWorkload { key: "zed", name: "Zed", category: GroupCategory::Ide, name_needles: &[], path_needles: &["/zed.app/"] },
    KnownWorkload { key: "xcode", name: "Xcode", category: GroupCategory::Ide, name_needles: &["xcode"], path_needles: &["/xcode.app/"] },
    KnownWorkload { key: "jetbrains", name: "JetBrains IDE", category: GroupCategory::Ide, name_needles: &["idea", "pycharm", "webstorm", "goland", "rustrover", "clion"], path_needles: &["jetbrains"] },
    KnownWorkload { key: "vscode", name: "VS Code IDE", category: GroupCategory::Ide, name_needles: &["code"], path_needles: &["vscode", "visual studio code"] },
    KnownWorkload { key: "gopls", name: "Go Language Server (gopls)", category: GroupCategory::LanguageServer, name_needles: &["gopls"], path_needles: &["gopls"] },
    KnownWorkload { key: "rust_analyzer", name: "Rust Analyzer", category: GroupCategory::LanguageServer, name_needles: &["rust-analyzer"], path_needles: &["rust-analyzer"] },
    KnownWorkload { key: "tsserver", name: "TypeScript Language Server", category: GroupCategory::LanguageServer, name_needles: &["tsserver", "typescript-language-server"], path_needles: &["tsserver"] },
    KnownWorkload { key: "pyright", name: "Pyright", category: GroupCategory::LanguageServer, name_needles: &["pyright"], path_needles: &["pyright"] },
    KnownWorkload { key: "clangd", name: "clangd", category: GroupCategory::LanguageServer, name_needles: &["clangd"], path_needles: &[] },
    KnownWorkload { key: "sourcekit", name: "SourceKit LSP", category: GroupCategory::LanguageServer, name_needles: &["sourcekit"], path_needles: &[] },
    KnownWorkload { key: "docker", name: "Docker Container Runtime", category: GroupCategory::ContainerRuntime, name_needles: &["docker", "containerd", "com.docker"], path_needles: &["docker"] },
    KnownWorkload { key: "orbstack", name: "OrbStack", category: GroupCategory::ContainerRuntime, name_needles: &["orbstack"], path_needles: &["orbstack"] },
    KnownWorkload { key: "ollama", name: "Ollama Local LLM", category: GroupCategory::LocalLlm, name_needles: &["ollama"], path_needles: &["ollama"] },
    KnownWorkload { key: "lmstudio", name: "LM Studio", category: GroupCategory::LocalLlm, name_needles: &["lm studio", "lmstudio"], path_needles: &["lm studio"] },
    KnownWorkload { key: "llamacpp", name: "llama.cpp", category: GroupCategory::LocalLlm, name_needles: &["llama-server", "llama-cli"], path_needles: &[] },
    KnownWorkload { key: "postgres", name: "PostgreSQL", category: GroupCategory::Database, name_needles: &["postgres"], path_needles: &[] },
    KnownWorkload { key: "mysql", name: "MySQL", category: GroupCategory::Database, name_needles: &["mysqld"], path_needles: &[] },
    KnownWorkload { key: "redis", name: "Redis", category: GroupCategory::Database, name_needles: &["redis-server"], path_needles: &[] },
    KnownWorkload { key: "mongodb", name: "MongoDB", category: GroupCategory::Database, name_needles: &["mongod"], path_needles: &[] },
    KnownWorkload { key: "rust_build", name: "Rust Builds (cargo/rustc)", category: GroupCategory::BuildSystem, name_needles: &["cargo", "rustc"], path_needles: &[] },
    KnownWorkload { key: "clang", name: "C/C++ Compilers", category: GroupCategory::BuildSystem, name_needles: &["clang", "cc1plus", "cl.exe"], path_needles: &[] },
    KnownWorkload { key: "swift_build", name: "Swift Compiler", category: GroupCategory::BuildSystem, name_needles: &["swift-frontend", "swift-build"], path_needles: &[] },
    KnownWorkload { key: "gradle", name: "Gradle", category: GroupCategory::BuildSystem, name_needles: &["gradle"], path_needles: &["gradle"] },
];

pub struct GroupingEngine;

impl Default for GroupingEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl GroupingEngine {
    pub fn new() -> Self {
        Self
    }

    /// Group raw process snapshots into logical workload groups based on executable signatures,
    /// app bundle membership, and well-known process names.
    pub fn classify(&self, processes: &HashMap<Pid, ProcessSnapshot>) -> Vec<WorkloadGroup> {
        let mut groups: HashMap<String, WorkloadGroup> = HashMap::new();

        for (pid, proc_snap) in processes {
            let (key, name, category) = self.identify(proc_snap);

            let entry = groups.entry(key.clone()).or_insert_with(|| WorkloadGroup {
                id: key,
                name,
                category,
                root_pid: *pid,
                member_pids: Vec::new(),
                aggregated_metrics: ProcessMetrics::default(),
            });

            entry.member_pids.push(*pid);
            // The lowest PID is usually the parent process of the group.
            entry.root_pid = entry.root_pid.min(*pid);

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
        result.sort_by_key(|w| std::cmp::Reverse(w.aggregated_metrics.phys_footprint));
        result
    }

    /// Returns the (group key, display name, category) for one process.
    fn identify(&self, proc_snap: &ProcessSnapshot) -> (String, String, GroupCategory) {
        let name_lower = proc_snap.info.name.to_lowercase();
        let path_lower = proc_snap
            .info
            .executable_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        for known in KNOWN {
            let by_name = known.name_needles.iter().any(|n| name_lower.contains(n));
            let by_path = known.path_needles.iter().any(|n| path_lower.contains(n));
            if by_name || by_path {
                return (known.key.to_string(), known.name.to_string(), known.category.clone());
            }
        }

        let is_system = is_system_process(proc_snap, &path_lower);

        // Helpers live inside their app's bundle, so group by the outermost `.app`,
        // or by the Snap / `/opt` package directory on Linux.
        if !is_system {
            if let Some(path) = proc_snap.info.executable_path.as_deref() {
                if let Some(app) = outermost_app_bundle(path).or_else(|| linux_package_dir(path)) {
                    return (format!("app:{}", app.to_lowercase()), app, GroupCategory::UserApplication);
                }
            }
        }

        if is_system {
            let name = if cfg!(windows) {
                "Windows System Processes"
            } else if cfg!(target_os = "linux") {
                "Linux System Services"
            } else {
                "macOS System Daemons"
            };
            return ("system_daemons".to_string(), name.to_string(), GroupCategory::SystemDaemon);
        }

        let raw = proc_snap.info.name.trim().to_string();
        (raw.clone(), raw, GroupCategory::UserApplication)
    }
}

/// OS-owned processes: system paths, and on Linux root daemons and kernel threads,
/// whose executable path a normal user often can't read.
fn is_system_process(proc_snap: &ProcessSnapshot, path_lower: &str) -> bool {
    const MACOS: &[&str] = &["/system/library", "/usr/libexec", "/usr/sbin", "/usr/bin", "/sbin", "/library/apple"];
    // On Linux, /usr/bin is where ordinary apps live, so it doesn't count as "system".
    const LINUX: &[&str] = &["/usr/lib/systemd", "/lib/systemd", "/usr/libexec", "/usr/sbin", "/sbin", "/usr/lib/polkit"];
    const WINDOWS: &[&str] = &["c:\\windows\\"];

    let prefixes = if cfg!(windows) {
        WINDOWS
    } else if cfg!(target_os = "linux") {
        LINUX
    } else {
        MACOS
    };
    if prefixes.iter().any(|p| path_lower.starts_with(p)) {
        return true;
    }

    // Linux kernel threads are children of kthreadd (PID 2); root daemons often hide their path.
    cfg!(target_os = "linux")
        && proc_snap.info.executable_path.is_none()
        && (proc_snap.info.pid == 2 || proc_snap.info.ppid == 2 || proc_snap.info.user_id == 0)
}

/// `/snap/spotify/123/usr/bin/spotify` → `spotify`; `/opt/zoom/zoom` → `zoom`.
fn linux_package_dir(path: &std::path::Path) -> Option<String> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    let mut parts = path.components().map(|c| c.as_os_str().to_string_lossy().into_owned());
    parts.next(); // root
    match parts.next()?.as_str() {
        "snap" | "opt" => parts.next().filter(|n| !n.is_empty()),
        _ => None,
    }
}

/// `/Applications/WhatsApp.app/Contents/Frameworks/Helper.app/...` → `WhatsApp`.
fn outermost_app_bundle(path: &std::path::Path) -> Option<String> {
    path.components().find_map(|c| {
        let s = c.as_os_str().to_string_lossy();
        s.strip_suffix(".app").filter(|n| !n.is_empty()).map(str::to_string)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{ProcessInfo, ProcessSnapshot};
    use std::path::PathBuf;

    fn proc(pid: Pid, name: &str, path: &str, footprint: u64) -> (Pid, ProcessSnapshot) {
        let info = ProcessInfo {
            pid,
            ppid: 1,
            name: name.to_string(),
            executable_path: Some(PathBuf::from(path)),
            command_line: Vec::new(),
            working_directory: None,
            user_id: 501,
            start_time: None,
        };
        let metrics = ProcessMetrics { phys_footprint: footprint, ..Default::default() };
        (pid, ProcessSnapshot { info, metrics })
    }

    #[test]
    fn helpers_join_their_app_bundle() {
        let processes = HashMap::from([
            proc(10, "WhatsApp", "/Applications/WhatsApp.app/Contents/MacOS/WhatsApp", 100),
            proc(11, "WhatsApp Helper", "/Applications/WhatsApp.app/Contents/Frameworks/WhatsApp Helper.app/Contents/MacOS/WhatsApp Helper", 50),
        ]);
        let groups = GroupingEngine::new().classify(&processes);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].name, "WhatsApp");
        assert_eq!(groups[0].member_pids.len(), 2);
        assert_eq!(groups[0].aggregated_metrics.phys_footprint, 150);
        assert_eq!(groups[0].root_pid, 10);
    }

    #[test]
    fn known_apps_win_over_bundle_names_and_sort_by_footprint() {
        let processes = HashMap::from([
            proc(20, "Xcode", "/Applications/Xcode.app/Contents/MacOS/Xcode", 10),
            proc(21, "Brave Browser Helper (Renderer)", "/Applications/Brave Browser.app/Contents/Frameworks/x", 500),
            proc(22, "launchd", "/sbin/launchd", 5),
        ]);
        let groups = GroupingEngine::new().classify(&processes);
        let names: Vec<&str> = groups.iter().map(|g| g.name.as_str()).collect();
        assert_eq!(names[0], "Brave Browser");
        assert!(names.contains(&"Xcode"), "Xcode must not be matched as VS Code: {names:?}");
        assert!(groups.iter().any(|g| g.category == GroupCategory::SystemDaemon));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_kernel_threads_root_daemons_and_snaps() {
        let mut kworker = proc(300, "kworker/0:1", "/", 0);
        kworker.1.info.executable_path = None;
        kworker.1.info.ppid = 2;
        let mut daemon = proc(301, "systemd-journald", "/", 40);
        daemon.1.info.executable_path = None;
        daemon.1.info.user_id = 0;
        let processes = HashMap::from([
            kworker,
            daemon,
            proc(302, "spotify", "/snap/spotify/80/usr/share/spotify/spotify", 300),
            proc(303, "htop", "/usr/bin/htop", 5),
        ]);
        let groups = GroupingEngine::new().classify(&processes);
        let find = |name: &str| groups.iter().find(|g| g.name == name);
        assert_eq!(find("Linux System Services").map(|g| g.member_pids.len()), Some(2));
        assert!(find("spotify").is_some());
        assert_eq!(find("htop").map(|g| g.category.clone()), Some(GroupCategory::UserApplication));
    }

    #[test]
    fn outermost_bundle_is_used() {
        let p = std::path::Path::new("/Applications/Foo.app/Contents/Frameworks/Bar.app/Contents/MacOS/Bar");
        assert_eq!(outermost_app_bundle(p).as_deref(), Some("Foo"));
        assert_eq!(outermost_app_bundle(std::path::Path::new("/usr/local/bin/node")), None);
    }
}
