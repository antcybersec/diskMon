use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use eframe::egui::{self, Align, Color32, CornerRadius, Key, Layout, RichText, Sense, Shape, Stroke, Vec2};
use resource_core::{DiagnosticSeverity, ReportExporter, SystemMetrics, WorkloadGroup};

use crate::sampler::{Rates, Telemetry};
use crate::theme::{self, ACCENT, BG, BORDER, CORAL, MUTED, PANEL, SUCCESS, TEXT};
use crate::treemap::{self, Metric, Selection};

pub struct DiskMonApp {
    telemetry: Arc<Mutex<Telemetry>>,
    paused: Arc<AtomicBool>,
    metric: Metric,
    /// Workload the treemap is zoomed into.
    focus: Option<String>,
    selection: Selection,
    filter: String,
    status: Option<String>,
}

impl DiskMonApp {
    pub fn new(cc: &eframe::CreationContext<'_>, telemetry: Arc<Mutex<Telemetry>>, paused: Arc<AtomicBool>) -> Self {
        let mut visuals = egui::Visuals::dark();
        visuals.panel_fill = PANEL;
        visuals.window_fill = PANEL;
        visuals.extreme_bg_color = BG;
        visuals.override_text_color = Some(TEXT);
        visuals.selection.bg_fill = ACCENT.linear_multiply(0.35);
        visuals.selection.stroke = Stroke::new(1.0, ACCENT);
        visuals.hyperlink_color = ACCENT;
        visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0, BORDER);
        cc.egui_ctx.set_visuals(visuals);

        Self {
            telemetry,
            paused,
            metric: Metric::Memory,
            focus: None,
            selection: Selection::None,
            filter: String::new(),
            status: None,
        }
    }

    fn filter_id() -> egui::Id {
        egui::Id::new("treemap_filter")
    }

    fn handle_keys(&mut self, ui: &egui::Ui, t: &Telemetry) {
        let ctx = ui.ctx();
        let typing = ctx.egui_wants_keyboard_input();
        let pressed = |k: Key| ui.input(|i| i.key_pressed(k));

        if typing {
            if pressed(Key::Escape) || pressed(Key::Enter) {
                ctx.memory_mut(|m| m.surrender_focus(Self::filter_id()));
            }
            return;
        }
        if pressed(Key::Slash) {
            ctx.memory_mut(|m| m.request_focus(Self::filter_id()));
        }
        if pressed(Key::Escape) {
            if !self.filter.is_empty() {
                self.filter.clear();
            } else if self.selection != Selection::None {
                self.selection = Selection::None;
            } else {
                self.focus = None;
            }
        }
        if pressed(Key::Backspace) {
            self.focus = None;
        }
        if pressed(Key::Enter) {
            if let Some(id) = self.selected_workload(t).map(|w| w.id.clone()) {
                self.focus = Some(id);
            }
        }
        if pressed(Key::Num1) {
            self.metric = Metric::Memory;
        }
        if pressed(Key::Num2) {
            self.metric = Metric::Cpu;
        }
        if pressed(Key::Num3) {
            self.metric = Metric::Disk;
        }
        if pressed(Key::P) {
            self.toggle_pause();
        }
        if pressed(Key::E) {
            self.export_report(t);
        }
    }

    fn toggle_pause(&self) {
        self.paused.fetch_xor(true, Ordering::Relaxed);
    }

    /// The selected workload, or the workload that owns the selected process.
    fn selected_workload<'a>(&self, t: &'a Telemetry) -> Option<&'a WorkloadGroup> {
        let workloads = &t.snapshot.as_ref()?.workloads;
        match &self.selection {
            Selection::Workload(id) => workloads.iter().find(|w| &w.id == id),
            Selection::Process(pid) => workloads.iter().find(|w| w.member_pids.contains(pid)),
            Selection::None => None,
        }
    }

    fn export_report(&mut self, t: &Telemetry) {
        let Some(snapshot) = &t.snapshot else { return };
        let report = ReportExporter::generate(snapshot, t.alerts.clone(), t.delta.clone());
        let markdown = ReportExporter::to_markdown(&report);

        let dir = dirs::download_dir().or_else(dirs::home_dir).unwrap_or_else(|| PathBuf::from("."));
        let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or_default();
        let path = dir.join(format!("diskmon-report-{secs}.md"));

        self.status = Some(match std::fs::write(&path, markdown) {
            Ok(()) => format!("Report saved to {}", path.display()),
            Err(e) => format!("Couldn't save report: {e}"),
        });
    }
}

impl eframe::App for DiskMonApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        // Keep the "updated Xs ago" label ticking between samples.
        ui.ctx().request_repaint_after(Duration::from_secs(1));

        let shared = Arc::clone(&self.telemetry);
        let t = shared.lock().unwrap();
        self.handle_keys(ui, &t);

        // Drop a zoom or selection whose workload has exited.
        if let Some(s) = &t.snapshot {
            if let Some(focus) = &self.focus {
                if !s.workloads.iter().any(|w| &w.id == focus) {
                    self.focus = None;
                }
            }
            let stale = match &self.selection {
                Selection::Workload(id) => !s.workloads.iter().any(|w| &w.id == id),
                Selection::Process(pid) => !s.processes.contains_key(pid),
                Selection::None => false,
            };
            if stale {
                self.selection = Selection::None;
            }
        }

        egui::Panel::top("header")
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin::symmetric(16, 10)))
            .show(ui, |ui| self.header(ui, &t));
        egui::Panel::top("legend")
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin { left: 16, right: 16, top: 0, bottom: 8 }))
            .show(ui, |ui| legend(ui, &t));
        egui::Panel::bottom("footer")
            .frame(egui::Frame::new().fill(PANEL).inner_margin(egui::Margin::symmetric(16, 7)))
            .show(ui, |ui| footer(ui, &t, self.paused.load(Ordering::Relaxed)));
        egui::Panel::right("side")
            .resizable(true)
            .default_size(330.0)
            .min_size(280.0)
            .frame(egui::Frame::new().fill(PANEL).inner_margin(egui::Margin { left: 16, right: 6, top: 16, bottom: 16 }))
            .show(ui, |ui| self.side_panel(ui, &t));

        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin { left: 12, right: 8, top: 0, bottom: 10 }))
            .show(ui, |ui| {
                let Some(snapshot) = &t.snapshot else {
                    ui.centered_and_justified(|ui| {
                        let msg = t
                            .error
                            .as_deref()
                            .map(|e| format!("Couldn't read processes: {e}"))
                            .unwrap_or_else(|| "Reading running processes…".to_string());
                        ui.label(RichText::new(msg).color(MUTED));
                    });
                    return;
                };
                let flagged: HashSet<String> =
                    t.alerts.iter().filter_map(|a| a.target_workload_id.clone()).collect();
                let output = treemap::show(
                    ui,
                    &treemap::Input {
                        workloads: &snapshot.workloads,
                        processes: &snapshot.processes,
                        rates: &t.rates,
                        workload_rates: &t.workload_rates,
                        metric: self.metric,
                        focus: self.focus.as_deref(),
                        filter: &self.filter,
                        flagged: &flagged,
                        selection: &self.selection,
                    },
                );
                if let Some(id) = output.zoom_into {
                    self.focus = Some(id.clone());
                    self.selection = Selection::Workload(id);
                } else if let Some(sel) = output.clicked {
                    self.selection = if sel == self.selection { Selection::None } else { sel };
                }
            });
    }
}

impl DiskMonApp {
    fn header(&mut self, ui: &mut egui::Ui, t: &Telemetry) {
        ui.horizontal(|ui| {
            ui.label(RichText::new("■").size(18.0).color(ACCENT));
            ui.label(RichText::new("diskMon").size(19.0).strong());
            ui.add_space(10.0);

            // Breadcrumb: All apps / <zoomed workload>
            ui.label(RichText::new("/").color(MUTED));
            let zoomed = self
                .focus
                .as_ref()
                .and_then(|id| t.snapshot.as_ref()?.workloads.iter().find(|w| &w.id == id));
            let root = ui.add(egui::Button::new(RichText::new("All apps").color(if zoomed.is_some() { MUTED } else { TEXT })).frame(false));
            if root.clicked() {
                self.focus = None;
            }
            if let Some(w) = zoomed {
                ui.label(RichText::new("/").color(MUTED));
                ui.label(RichText::new(&w.name).strong());
            }

            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                let export = ui.add_enabled(
                    t.snapshot.is_some(),
                    egui::Button::new(RichText::new("Export report").color(BG).strong()).fill(ACCENT).corner_radius(6),
                );
                if export.on_hover_text("Save a Markdown incident report to your Downloads folder (E)").clicked() {
                    self.export_report(t);
                }

                let paused = self.paused.load(Ordering::Relaxed);
                if ui.button(if paused { "Resume" } else { "Pause" }).on_hover_text("Pause live updates (P)").clicked() {
                    self.toggle_pause();
                }

                ui.add(
                    egui::TextEdit::singleline(&mut self.filter)
                        .id(Self::filter_id())
                        .hint_text("Filter  /")
                        .desired_width(150.0),
                );

                ui.add_space(8.0);
                egui::Frame::new().fill(PANEL).corner_radius(6).inner_margin(3).show(ui, |ui| {
                    ui.horizontal(|ui| {
                        for (i, m) in [Metric::Memory, Metric::Cpu, Metric::Disk].into_iter().enumerate().rev() {
                            ui.selectable_value(&mut self.metric, m, m.label())
                                .on_hover_text(format!("Size tiles by {} ({})", m.label(), i + 1));
                        }
                    });
                });

                if let Some(status) = &self.status {
                    ui.label(RichText::new(status).color(MUTED).small());
                }
            });
        });
    }

    fn side_panel(&mut self, ui: &mut egui::Ui, t: &Telemetry) {
        let Some(snapshot) = &t.snapshot else {
            ui.label(RichText::new("Waiting for the first snapshot…").color(MUTED));
            return;
        };
        let total_ram = snapshot.system_metrics.total_memory;

        egui::ScrollArea::vertical().auto_shrink(false).show(ui, |ui| {
            // Leave room for the scrollbar so right-aligned values aren't clipped.
            ui.set_max_width(ui.available_width() - 14.0);
            section(ui, "SELECTION");
            match &self.selection {
                Selection::Process(pid) => match snapshot.processes.get(pid) {
                    Some(p) => {
                        let owner = snapshot.workloads.iter().find(|w| w.member_pids.contains(pid));
                        let color = owner.map(|w| theme::category_color(&w.category)).unwrap_or(ACCENT);
                        title(ui, &p.info.name, color);
                        if let Some(w) = owner {
                            ui.label(RichText::new(format!("in {}", w.name)).color(MUTED).small());
                        }
                        big_bytes(ui, p.metrics.phys_footprint);
                        share_bar(ui, theme::pct(p.metrics.phys_footprint as f64, total_ram as f64), color);
                        let r = t.rates.get(pid).copied().unwrap_or_default();
                        let threads = (p.metrics.thread_count > 0).then(|| p.metrics.thread_count.to_string());
                        stat_grid(ui, "proc", &[
                            ("PID", pid.to_string()),
                            ("PARENT", p.info.ppid.to_string()),
                            ("CPU", treemap::cpu(r.cpu_pct)),
                            ("DISK I/O", theme::rate(r.read_bps + r.write_bps)),
                            ("VIRTUAL", theme::bytes(p.metrics.virtual_size)),
                            ("THREADS", threads.unwrap_or_else(|| "—".into())),
                        ]);
                        if let Some(path) = &p.info.executable_path {
                            ui.add_space(6.0);
                            ui.label(RichText::new(path.display().to_string()).color(MUTED).small().monospace());
                            if ui.button(reveal_label()).clicked() {
                                reveal(path);
                            }
                        }
                    }
                    None => {
                        ui.label(RichText::new("That process has exited.").color(MUTED));
                    }
                },
                _ => match self.selected_workload(t) {
                    Some(w) => {
                        let color = theme::category_color(&w.category);
                        title(ui, &w.name, color);
                        ui.label(RichText::new(theme::category_name(&w.category)).color(MUTED).small());
                        big_bytes(ui, w.aggregated_metrics.phys_footprint);
                        let share = theme::pct(w.aggregated_metrics.phys_footprint as f64, total_ram as f64);
                        share_bar(ui, share, color);
                        let r = t.workload_rates.get(&w.id).copied().unwrap_or_default();
                        stat_grid(ui, "workload", &[
                            ("OF RAM", format!("{share:.1}%")),
                            ("PROCESSES", w.member_pids.len().to_string()),
                            ("CPU", treemap::cpu(r.cpu_pct)),
                            ("DISK I/O", theme::rate(r.read_bps + r.write_bps)),
                        ]);
                        if let Some(series) = t.workload_series.get(&w.id) {
                            sparkline(ui, series, color);
                        }
                        ui.label(RichText::new("Double-click or press Enter to look inside").color(MUTED).small());
                    }
                    None => {
                        title(ui, "All apps", ACCENT);
                        let used = t.total_series.back().copied().unwrap_or(0);
                        big_bytes(ui, used);
                        share_bar(ui, theme::pct(used as f64, total_ram as f64), ACCENT);
                        ui.label(RichText::new(format!("used by {} apps of {} RAM", snapshot.workloads.len(), theme::bytes(total_ram))).color(MUTED).small());
                        sparkline(ui, &t.total_series, ACCENT);
                    }
                },
            }

            ui.add_space(14.0);
            section(ui, "ALERTS");
            if t.alerts.is_empty() {
                ui.horizontal(|ui| {
                    ui.colored_label(SUCCESS, "●");
                    ui.label(RichText::new("No alerts. Memory and CPU use look normal.").color(MUTED));
                });
            }
            for alert in &t.alerts {
                let color = match alert.severity {
                    DiagnosticSeverity::Critical => CORAL,
                    DiagnosticSeverity::Warning => theme::AMBER,
                    DiagnosticSeverity::Info => MUTED,
                };
                let resp = egui::Frame::new()
                    .stroke(Stroke::new(1.0, color.linear_multiply(0.6)))
                    .corner_radius(6)
                    .inner_margin(10)
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.label(RichText::new(&alert.title).color(color).strong());
                        ui.label(RichText::new(&alert.explanation).color(MUTED).small());
                    })
                    .response
                    .interact(Sense::click());
                if resp.clicked() {
                    if let Some(id) = &alert.target_workload_id {
                        self.selection = Selection::Workload(id.clone());
                    }
                }
                ui.add_space(6.0);
            }

            ui.add_space(10.0);
            self.worth_a_look(ui, t);

            ui.add_space(14.0);
            memory_meter(ui, &snapshot.system_metrics);
        });
    }

    /// Workloads worth a look: alerts first, then growth, CPU, disk activity and sheer size.
    fn worth_a_look(&mut self, ui: &mut egui::Ui, t: &Telemetry) {
        let Some(snapshot) = &t.snapshot else { return };
        let mut picks: Vec<(&WorkloadGroup, String)> = Vec::new();
        let rates = |w: &WorkloadGroup| t.workload_rates.get(&w.id).copied().unwrap_or_default();

        for alert in &t.alerts {
            if let Some(w) = alert.target_workload_id.as_ref().and_then(|id| snapshot.workloads.iter().find(|w| &w.id == id)) {
                let reason = alert.title.split(':').next().unwrap_or(&alert.title).to_lowercase();
                add(w, reason, &mut picks);
            }
        }
        // diskMon's own memory grows while its history fills, so leave it out.
        let own = std::process::id();
        for w in snapshot.workloads.iter().filter(|w| !w.member_pids.contains(&own)) {
            if let Some(series) = t.workload_series.get(&w.id) {
                let (first, last) = (series.front().copied().unwrap_or(0), series.back().copied().unwrap_or(0));
                if last > first + 100 * 1024 * 1024 {
                    add(w, format!("grew {} in 5 min", theme::bytes(last - first)), &mut picks);
                }
            }
        }
        let mut busy: Vec<(&WorkloadGroup, Rates)> = snapshot.workloads.iter().map(|w| (w, rates(w))).collect();
        busy.sort_by(|a, b| b.1.cpu_pct.total_cmp(&a.1.cpu_pct));
        for (w, r) in busy.iter().take(2).filter(|(_, r)| r.cpu_pct >= 50.0) {
            add(w, format!("{:.0}% CPU right now", r.cpu_pct), &mut picks);
        }
        busy.sort_by(|a, b| (b.1.read_bps + b.1.write_bps).total_cmp(&(a.1.read_bps + a.1.write_bps)));
        for (w, r) in busy.iter().take(1).filter(|(_, r)| r.read_bps + r.write_bps >= 5.0 * 1024.0 * 1024.0) {
            add(w, format!("{} disk I/O", theme::rate(r.read_bps + r.write_bps)), &mut picks);
        }
        for w in snapshot.workloads.iter().take(3) {
            add(w, format!("{} processes", w.member_pids.len()), &mut picks);
        }
        picks.truncate(6);

        let largest = picks.iter().map(|(w, _)| w.aggregated_metrics.phys_footprint).max().unwrap_or(1).max(1);
        let total: u64 = picks.iter().map(|(w, _)| w.aggregated_metrics.phys_footprint).sum();
        ui.horizontal(|ui| {
            ui.label(RichText::new("WORTH A LOOK").color(MUTED).small().monospace());
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.label(RichText::new(theme::bytes(total)).color(ACCENT).small().monospace());
            });
        });
        ui.add_space(4.0);

        for (w, reason) in picks {
            let color = theme::category_color(&w.category);
            let resp = egui::Frame::new()
                .inner_margin(egui::Margin { left: 10, right: 4, top: 4, bottom: 4 })
                .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(&w.name).strong());
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            ui.label(RichText::new(theme::bytes(w.aggregated_metrics.phys_footprint)).monospace());
                        });
                    });
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(reason).color(MUTED).small());
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            let (bar, _) = ui.allocate_exact_size(Vec2::new(110.0, 4.0), Sense::hover());
                            ui.painter().rect_filled(bar, CornerRadius::same(2), BORDER);
                            let frac = w.aggregated_metrics.phys_footprint as f32 / largest as f32;
                            let fill = egui::Rect::from_min_size(bar.min, Vec2::new(bar.width() * frac, bar.height()));
                            ui.painter().rect_filled(fill, CornerRadius::same(2), color);
                        });
                    });
                })
                .response;
            ui.painter().line_segment(
                [resp.rect.left_top() + Vec2::new(0.0, 4.0), resp.rect.left_bottom() - Vec2::new(0.0, 4.0)],
                Stroke::new(2.0, color),
            );
            if resp.interact(Sense::click()).clicked() {
                self.selection = Selection::Workload(w.id.clone());
            }
        }
    }
}

/// Adds `w` to the "worth a look" picks unless it is already listed.
fn add<'a>(w: &'a WorkloadGroup, reason: String, picks: &mut Vec<(&'a WorkloadGroup, String)>) {
    if !picks.iter().any(|(p, _)| p.id == w.id) {
        picks.push((w, reason));
    }
}

fn legend(ui: &mut egui::Ui, t: &Telemetry) {
    let Some(s) = &t.snapshot else { return };
    ui.horizontal_wrapped(|ui| {
        let used = t.total_series.back().copied().unwrap_or(0);
        ui.label(RichText::new(theme::bytes(used)).strong());
        ui.label(RichText::new(format!("· {} processes · {} apps", s.processes.len(), s.workloads.len())).color(MUTED));
        ui.add_space(14.0);

        let present: HashSet<&str> = s.workloads.iter().map(|w| theme::category_name(&w.category)).collect();
        for category in theme::CATEGORIES.iter() {
            let name = theme::category_name(category);
            if !present.contains(name) {
                continue;
            }
            let (dot, _) = ui.allocate_exact_size(Vec2::splat(10.0), Sense::hover());
            ui.painter().rect_filled(dot, CornerRadius::same(2), theme::category_color(category));
            ui.label(RichText::new(name).color(MUTED).small());
            ui.add_space(6.0);
        }
        if !t.alerts.is_empty() {
            let (dot, _) = ui.allocate_exact_size(Vec2::splat(10.0), Sense::hover());
            ui.painter().rect_stroke(dot, CornerRadius::same(2), Stroke::new(1.0, MUTED), egui::StrokeKind::Inside);
            ui.painter().line_segment([dot.left_bottom(), dot.right_top()], Stroke::new(1.0, MUTED));
            ui.label(RichText::new("Has an alert").color(MUTED).small());
        }
    });
}

fn footer(ui: &mut egui::Ui, t: &Telemetry, paused: bool) {
    ui.horizontal(|ui| {
        for (key, action) in [
            ("click", "select"),
            ("enter", "open"),
            ("bksp", "up"),
            ("/", "filter"),
            ("1 2 3", "mode"),
            ("p", "pause"),
            ("e", "export"),
            ("esc", "clear"),
        ] {
            egui::Frame::new()
                .stroke(Stroke::new(1.0, BORDER))
                .corner_radius(4)
                .inner_margin(egui::Margin::symmetric(5, 1))
                .show(ui, |ui| ui.label(RichText::new(key).monospace().small()));
            ui.label(RichText::new(action).color(MUTED).small());
            ui.add_space(6.0);
        }
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            let text = match (&t.snapshot, paused) {
                (_, true) => "paused".to_string(),
                (Some(s), false) => format!(
                    "sampled {} processes · {} ms · updated {}s ago",
                    s.processes.len(),
                    t.sample_time.as_millis(),
                    t.updated_at.map(|at| at.elapsed().as_secs()).unwrap_or(0)
                ),
                (None, false) => "starting…".to_string(),
            };
            ui.label(RichText::new(text).color(MUTED).small());
        });
    });
}

fn memory_meter(ui: &mut egui::Ui, m: &SystemMetrics) {
    section(ui, "MEMORY");
    let total = m.total_memory.max(1);
    // Cached (inactive) pages are handed back to apps on demand, so count them as available.
    let available = m.free_memory + m.inactive_memory;
    let (value, unit) = theme::bytes_parts(available as f64);
    ui.horizontal(|ui| {
        ui.label(RichText::new(value).size(26.0));
        ui.label(RichText::new(format!("{unit} available")).color(MUTED));
    });

    // macOS reports a breakdown; Windows only used/free (reported as active/free).
    let parts: Vec<(&str, u64, Color32)> = [
        ("Wired", m.wired_memory, CORAL),
        ("Active", m.active_memory, ACCENT),
        ("Compressed", m.compressed_memory, theme::VIOLET),
        ("Cached", m.inactive_memory, theme::SLATE),
    ]
    .into_iter()
    .filter(|(_, v, _)| *v > 0)
    .collect();

    let (bar, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 8.0), Sense::hover());
    ui.painter().rect_filled(bar, CornerRadius::same(3), BORDER);
    let mut x = bar.min.x;
    for (_, v, color) in &parts {
        let w = bar.width() * (*v as f32 / total as f32);
        let seg = egui::Rect::from_min_size(egui::pos2(x, bar.min.y), Vec2::new(w.min(bar.max.x - x), bar.height()));
        ui.painter().rect_filled(seg, CornerRadius::ZERO, *color);
        x += w;
    }
    ui.add_space(4.0);
    for (name, v, color) in &parts {
        ui.horizontal(|ui| {
            ui.colored_label(*color, "■");
            ui.label(RichText::new(*name).color(MUTED).small());
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.label(RichText::new(theme::bytes(*v)).small().monospace());
            });
        });
    }
    ui.add_space(4.0);
    let mut rows = vec![("Free", theme::bytes(m.free_memory)), ("Total", theme::bytes(m.total_memory))];
    if m.swap_total > 0 {
        rows.push(("Swap used", format!("{} of {}", theme::bytes(m.swap_used), theme::bytes(m.swap_total))));
    }
    rows.push(("Pressure", format!("{:.0}%", m.memory_pressure_pct)));
    for (k, v) in rows {
        ui.horizontal(|ui| {
            ui.label(RichText::new(k).color(MUTED).small());
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.label(RichText::new(v).small().monospace());
            });
        });
    }
}

fn section(ui: &mut egui::Ui, title: &str) {
    ui.label(RichText::new(title).color(MUTED).small().monospace());
    ui.add_space(4.0);
}

fn title(ui: &mut egui::Ui, text: &str, color: Color32) {
    ui.horizontal(|ui| {
        let (bar, _) = ui.allocate_exact_size(Vec2::new(3.0, 22.0), Sense::hover());
        ui.painter().rect_filled(bar, CornerRadius::same(1), color);
        ui.label(RichText::new(text).size(19.0).strong());
    });
}

fn big_bytes(ui: &mut egui::Ui, b: u64) {
    let (value, unit) = theme::bytes_parts(b as f64);
    ui.horizontal(|ui| {
        ui.label(RichText::new(value).size(40.0));
        ui.label(RichText::new(unit).size(16.0).color(MUTED));
    });
}

fn share_bar(ui: &mut egui::Ui, pct: f64, color: Color32) {
    let (bar, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 4.0), Sense::hover());
    ui.painter().rect_filled(bar, CornerRadius::same(2), BORDER);
    let w = bar.width() * (pct / 100.0).clamp(0.0, 1.0) as f32;
    ui.painter().rect_filled(egui::Rect::from_min_size(bar.min, Vec2::new(w, bar.height())), CornerRadius::same(2), color);
    ui.add_space(8.0);
}

fn stat_grid(ui: &mut egui::Ui, id: &str, stats: &[(&str, String)]) {
    egui::Grid::new(id).num_columns(2).spacing([24.0, 6.0]).show(ui, |ui| {
        for pair in stats.chunks(2) {
            for (k, _) in pair {
                ui.label(RichText::new(*k).color(MUTED).small().monospace());
            }
            ui.end_row();
            for (_, v) in pair {
                ui.label(RichText::new(v).size(15.0));
            }
            ui.end_row();
        }
    });
}

/// Footprint over the last five minutes, with the change since the first sample.
fn sparkline(ui: &mut egui::Ui, series: &VecDeque<u64>, color: Color32) {
    ui.add_space(8.0);
    let (first, last) = (series.front().copied().unwrap_or(0), series.back().copied().unwrap_or(0));
    let change = last as i64 - first as i64;
    ui.horizontal(|ui| {
        ui.label(RichText::new("LAST 5 MIN").color(MUTED).small().monospace());
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            let sign = if change >= 0 { "+" } else { "−" };
            ui.label(RichText::new(format!("{sign}{}", theme::bytes(change.unsigned_abs()))).small().monospace());
        });
    });
    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 40.0), Sense::hover());
    ui.painter().rect_filled(rect, CornerRadius::same(3), BG);
    if series.len() < 2 {
        return;
    }
    let (min, max) = series.iter().fold((u64::MAX, 0), |(lo, hi), &v| (lo.min(v), hi.max(v)));
    let span = (max - min).max(1) as f32;
    let step = rect.width() / (crate::sampler::HISTORY_CAPACITY - 1) as f32;
    let start = rect.max.x - step * (series.len() - 1) as f32;
    let points: Vec<egui::Pos2> = series
        .iter()
        .enumerate()
        .map(|(i, &v)| egui::pos2(start + step * i as f32, rect.max.y - 4.0 - (rect.height() - 8.0) * ((v - min) as f32 / span)))
        .collect();
    ui.painter().add(Shape::line(points, Stroke::new(1.5, color)));
}

fn reveal_label() -> &'static str {
    if cfg!(windows) { "Show in Explorer" } else { "Reveal in Finder" }
}

/// Opens the system file browser with the executable selected. Read-only.
fn reveal(path: &Path) {
    let result = if cfg!(windows) {
        std::process::Command::new("explorer").arg(format!("/select,{}", path.display())).spawn()
    } else {
        std::process::Command::new("open").arg("-R").arg(path).spawn()
    };
    if let Err(e) = result {
        eprintln!("couldn't reveal {}: {e}", path.display());
    }
}
