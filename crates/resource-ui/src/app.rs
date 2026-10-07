use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use eframe::egui::{
    self, Align, Align2, Color32, CornerRadius, FontId, Layout, Pos2, RichText, Sense, Stroke,
    StrokeKind, Vec2,
};
use resource_core::{
    DiagnosticSeverity, GroupCategory, Rect, ReportExporter, SquarifiedTreemap, WorkloadGroup,
};

use crate::sampler::Telemetry;

/// Largest workloads drawn as their own tile; the rest are merged into "Other".
const TREEMAP_TILES: usize = 40;
const OTHER_ID: &str = "__other__";

// Palette shared with the diskMon website.
const BG: Color32 = Color32::from_rgb(0x12, 0x11, 0x10);
const PANEL: Color32 = Color32::from_rgb(0x1b, 0x1a, 0x18);
const BORDER: Color32 = Color32::from_rgb(0x34, 0x32, 0x2f);
const TEXT: Color32 = Color32::from_rgb(0xf4, 0xf1, 0xec);
const MUTED: Color32 = Color32::from_rgb(0x9a, 0x96, 0x90);
const ACCENT: Color32 = Color32::from_rgb(0xf0, 0x8a, 0x3c);
const AMBER: Color32 = Color32::from_rgb(0xf2, 0xae, 0x3d);
const CORAL: Color32 = Color32::from_rgb(0xec, 0x6a, 0x5c);
const SUCCESS: Color32 = Color32::from_rgb(0x5f, 0xc8, 0x8f);

pub struct DiskMonApp {
    telemetry: Arc<Mutex<Telemetry>>,
    selected: Option<String>,
    status: Option<String>,
}

impl DiskMonApp {
    pub fn new(cc: &eframe::CreationContext<'_>, telemetry: Arc<Mutex<Telemetry>>) -> Self {
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
            selected: None,
            status: None,
        }
    }

    fn export_report(&mut self, t: &Telemetry) {
        let Some(snapshot) = &t.snapshot else { return };
        let report = ReportExporter::generate(snapshot, t.alerts.clone(), t.delta.clone());
        let markdown = ReportExporter::to_markdown(&report);

        let dir = dirs::download_dir()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("."));
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or_default();
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
        ui.ctx().request_repaint_after(std::time::Duration::from_secs(1));

        let shared = Arc::clone(&self.telemetry);
        let t = shared.lock().unwrap();

        egui::Panel::top("header")
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin::symmetric(16, 10)))
            .show(ui, |ui| self.header(ui, &t));

        egui::Panel::right("details")
            .resizable(true)
            .default_size(340.0)
            .min_size(280.0)
            .frame(egui::Frame::new().fill(PANEL).inner_margin(14))
            .show(ui, |ui| self.side_panel(ui, &t));

        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(BG).inner_margin(12))
            .show(ui, |ui| match &t.snapshot {
                Some(snapshot) => {
                    let total = snapshot.system_metrics.total_memory;
                    self.treemap(ui, &snapshot.workloads, total);
                }
                None => {
                    ui.centered_and_justified(|ui| {
                        let msg = t
                            .error
                            .as_deref()
                            .map(|e| format!("Couldn't read processes: {e}"))
                            .unwrap_or_else(|| "Reading running processes…".to_string());
                        ui.label(RichText::new(msg).color(MUTED));
                    });
                }
            });
    }
}

impl DiskMonApp {
    fn header(&mut self, ui: &mut egui::Ui, t: &Telemetry) {
        ui.horizontal(|ui| {
            ui.label(RichText::new("disk").size(20.0).strong());
            ui.add_space(-ui.spacing().item_spacing.x);
            ui.label(RichText::new("Mon").size(20.0).strong().color(ACCENT));
            ui.add_space(16.0);

            if let Some(s) = &t.snapshot {
                let used: u64 = s.workloads.iter().map(|w| w.aggregated_metrics.phys_footprint).sum();
                stat(ui, "Memory", &format!("{} of {}", bytes(used), bytes(s.system_metrics.total_memory)));
                stat(ui, "Processes", &s.processes.len().to_string());
                stat(ui, "Workloads", &s.workloads.len().to_string());
                if let Some(at) = t.updated_at {
                    stat(ui, "Updated", &format!("{}s ago", at.elapsed().as_secs()));
                }
            }

            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                let export = ui.add_enabled(
                    t.snapshot.is_some(),
                    egui::Button::new(RichText::new("Export report").color(BG).strong())
                        .fill(ACCENT)
                        .corner_radius(6),
                );
                if export.on_hover_text("Save a Markdown incident report to your Downloads folder").clicked() {
                    self.export_report(t);
                }
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
        let total = snapshot.system_metrics.total_memory;

        egui::ScrollArea::vertical().auto_shrink(false).show(ui, |ui| {
            section(ui, "ALERTS");
            if t.alerts.is_empty() {
                ui.horizontal(|ui| {
                    ui.colored_label(SUCCESS, "●");
                    ui.label(RichText::new("No alerts. Memory use looks normal.").color(MUTED));
                });
            }
            for alert in &t.alerts {
                let color = match alert.severity {
                    DiagnosticSeverity::Critical => CORAL,
                    DiagnosticSeverity::Warning => AMBER,
                    DiagnosticSeverity::Info => MUTED,
                };
                egui::Frame::new()
                    .stroke(Stroke::new(1.0, color.linear_multiply(0.6)))
                    .corner_radius(6)
                    .inner_margin(10)
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.label(RichText::new(&alert.title).color(color).strong());
                        ui.label(RichText::new(&alert.explanation).color(MUTED).small());
                        for ev in &alert.evidence {
                            ui.label(RichText::new(format!("• {ev}")).small());
                        }
                    });
                ui.add_space(6.0);
            }

            if let Some(w) = self
                .selected
                .as_ref()
                .and_then(|id| snapshot.workloads.iter().find(|w| &w.id == id))
            {
                ui.add_space(8.0);
                section(ui, "SELECTED WORKLOAD");
                workload_details(ui, w, total);
            }

            ui.add_space(8.0);
            section(ui, "TOP WORKLOADS");
            for w in snapshot.workloads.iter().take(25) {
                let selected = self.selected.as_deref() == Some(w.id.as_str());
                let label = format!("{}  ·  {}", w.name, bytes(w.aggregated_metrics.phys_footprint));
                let row = ui.add(
                    egui::Button::selectable(selected, RichText::new(label))
                        .min_size(Vec2::new(ui.available_width(), 0.0)),
                );
                if row.clicked() {
                    self.selected = if selected { None } else { Some(w.id.clone()) };
                }
            }
        });
    }

    fn treemap(&mut self, ui: &mut egui::Ui, workloads: &[WorkloadGroup], total_ram: u64) {
        let (area, _) = ui.allocate_exact_size(ui.available_size(), Sense::hover());

        let mut items: Vec<(String, String, u64)> = workloads
            .iter()
            .filter(|w| w.aggregated_metrics.phys_footprint > 0)
            .take(TREEMAP_TILES)
            .map(|w| (w.id.clone(), w.name.clone(), w.aggregated_metrics.phys_footprint))
            .collect();
        let rest: u64 = workloads
            .iter()
            .skip(TREEMAP_TILES)
            .map(|w| w.aggregated_metrics.phys_footprint)
            .sum();
        if rest > 0 {
            items.push((OTHER_ID.to_string(), "Other apps".to_string(), rest));
        }

        let by_id: HashMap<&str, &WorkloadGroup> =
            workloads.iter().map(|w| (w.id.as_str(), w)).collect();
        let bounds = Rect { x: area.min.x, y: area.min.y, w: area.width(), h: area.height() };
        let painter = ui.painter_at(area);

        for node in SquarifiedTreemap::layout(&items, bounds) {
            let tile = egui::Rect::from_min_size(
                Pos2::new(node.rect.x, node.rect.y),
                Vec2::new(node.rect.w, node.rect.h),
            )
            .shrink(1.5);
            if tile.width() < 1.0 || tile.height() < 1.0 {
                continue;
            }

            let workload = by_id.get(node.id.as_str()).copied();
            let base = workload.map(|w| category_color(&w.category)).unwrap_or(BORDER);
            let response = ui.interact(tile, ui.id().with(&node.id), Sense::click());
            let fill = if response.hovered() { base.gamma_multiply(1.15) } else { base };
            let selected = self.selected.as_deref() == Some(node.id.as_str());

            painter.rect_filled(tile, CornerRadius::same(4), fill);
            if selected {
                painter.rect_stroke(tile, CornerRadius::same(4), Stroke::new(2.0, TEXT), StrokeKind::Inside);
            }

            if tile.width() > 70.0 && tile.height() > 36.0 {
                let text = painter.with_clip_rect(tile.shrink(4.0));
                text.text(tile.min + Vec2::new(8.0, 7.0), Align2::LEFT_TOP, &node.label, FontId::proportional(13.0), BG);
                text.text(tile.min + Vec2::new(8.0, 24.0), Align2::LEFT_TOP, bytes(node.value), FontId::monospace(11.0), BG.gamma_multiply(0.8));
            }

            let share = pct(node.value, total_ram);
            let tip = match workload {
                Some(w) => format!(
                    "{}\n{} · {:.1}% of RAM\n{} processes",
                    w.name,
                    bytes(node.value),
                    share,
                    w.member_pids.len()
                ),
                None => format!("{}\n{} · {:.1}% of RAM", node.label, bytes(node.value), share),
            };
            let response = response.on_hover_text_at_pointer(tip);
            if response.clicked() && workload.is_some() {
                self.selected = if selected { None } else { Some(node.id.clone()) };
            }
        }
    }
}

fn workload_details(ui: &mut egui::Ui, w: &WorkloadGroup, total_ram: u64) {
    let m = &w.aggregated_metrics;
    ui.label(RichText::new(&w.name).strong().size(15.0));
    ui.label(RichText::new(category_name(&w.category)).color(MUTED).small());
    ui.add_space(4.0);
    egui::Grid::new("workload_details").num_columns(2).spacing([16.0, 4.0]).show(ui, |ui| {
        let mut row = |k: &str, v: String| {
            ui.label(RichText::new(k).color(MUTED));
            ui.label(v);
            ui.end_row();
        };
        row("Memory", format!("{} ({:.1}% of RAM)", bytes(m.phys_footprint), pct(m.phys_footprint, total_ram)));
        row("Processes", w.member_pids.len().to_string());
        row("CPU time", format!("{:.1} s", (m.user_time_ns + m.system_time_ns) as f64 / 1e9));
        row("Disk read", bytes(m.disk_read_bytes));
        row("Disk written", bytes(m.disk_write_bytes));
        if m.thread_count > 0 {
            row("Threads", m.thread_count.to_string());
        }
    });
}

fn stat(ui: &mut egui::Ui, label: &str, value: &str) {
    ui.label(RichText::new(label).color(MUTED).small());
    ui.label(RichText::new(value).monospace());
    ui.add_space(10.0);
}

fn section(ui: &mut egui::Ui, title: &str) {
    ui.label(RichText::new(title).color(MUTED).small().monospace());
    ui.add_space(4.0);
}

fn category_color(category: &GroupCategory) -> Color32 {
    match category {
        GroupCategory::Browser => AMBER,
        GroupCategory::Ide => Color32::from_rgb(0xb0, 0x7c, 0xe8),
        GroupCategory::LanguageServer => Color32::from_rgb(0x6c, 0x9c, 0xf0),
        GroupCategory::ContainerRuntime => Color32::from_rgb(0x4f, 0xbf, 0xae),
        GroupCategory::LocalLlm => Color32::from_rgb(0xea, 0x8a, 0xb3),
        GroupCategory::Database | GroupCategory::BuildSystem => CORAL,
        GroupCategory::SystemDaemon => Color32::from_rgb(0x7d, 0x79, 0x73),
        GroupCategory::UserApplication | GroupCategory::Unclassified => ACCENT,
    }
}

fn category_name(category: &GroupCategory) -> &'static str {
    match category {
        GroupCategory::Browser => "Browser",
        GroupCategory::Ide => "IDE",
        GroupCategory::LanguageServer => "Language server",
        GroupCategory::ContainerRuntime => "Container runtime",
        GroupCategory::Database => "Database",
        GroupCategory::LocalLlm => "Local LLM",
        GroupCategory::BuildSystem => "Build system",
        GroupCategory::SystemDaemon => "System",
        GroupCategory::UserApplication => "Application",
        GroupCategory::Unclassified => "Unclassified",
    }
}

fn pct(part: u64, total: u64) -> f64 {
    if total == 0 { 0.0 } else { part as f64 / total as f64 * 100.0 }
}

fn bytes(b: u64) -> String {
    const GB: f64 = 1024.0 * 1024.0 * 1024.0;
    const MB: f64 = 1024.0 * 1024.0;
    let b = b as f64;
    if b >= GB {
        format!("{:.2} GB", b / GB)
    } else if b >= MB {
        format!("{:.0} MB", b / MB)
    } else {
        format!("{:.0} KB", b / 1024.0)
    }
}
