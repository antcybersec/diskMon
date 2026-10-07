//! Nested, disktree-style treemap: workloads with header bands, their processes inside.

use std::collections::{HashMap, HashSet};

use eframe::egui::{self, Align2, Color32, CornerRadius, FontId, Painter, Pos2, Sense, Stroke, StrokeKind, Vec2};
use resource_core::{Pid, ProcessSnapshot, Rect, SquarifiedTreemap, WorkloadGroup};

use crate::sampler::Rates;
use crate::theme::{self, BG, MUTED, TEXT};

/// Largest workloads drawn as their own tile; the rest are merged into "Other apps".
const MAX_WORKLOADS: usize = 60;
/// Largest processes drawn inside a workload tile.
const MAX_CHILDREN: usize = 30;
const HEADER_H: f32 = 22.0;
const OTHER_ID: &str = "__other__";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Metric {
    Memory,
    Cpu,
    Disk,
}

impl Metric {
    pub fn label(self) -> &'static str {
        match self {
            Metric::Memory => "Memory",
            Metric::Cpu => "CPU",
            Metric::Disk => "Disk I/O",
        }
    }

    /// Integer weight used for the layout (CPU in hundredths of a percent).
    fn weight(self, footprint: u64, rates: Rates) -> u64 {
        match self {
            Metric::Memory => footprint,
            Metric::Cpu => (rates.cpu_pct * 100.0) as u64,
            Metric::Disk => (rates.read_bps + rates.write_bps) as u64,
        }
    }

    pub fn format(self, footprint: u64, rates: Rates) -> String {
        match self {
            Metric::Memory => theme::bytes(footprint),
            Metric::Cpu => cpu(rates.cpu_pct),
            Metric::Disk => theme::rate(rates.read_bps + rates.write_bps),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum Selection {
    #[default]
    None,
    Workload(String),
    Process(Pid),
}

pub struct Input<'a> {
    pub workloads: &'a [WorkloadGroup],
    pub processes: &'a HashMap<Pid, ProcessSnapshot>,
    pub rates: &'a HashMap<Pid, Rates>,
    pub workload_rates: &'a HashMap<String, Rates>,
    pub metric: Metric,
    /// Workload the view is zoomed into, if any.
    pub focus: Option<&'a str>,
    pub filter: &'a str,
    /// Workloads with an active alert; drawn hatched.
    pub flagged: &'a HashSet<String>,
    pub selection: &'a Selection,
}

#[derive(Default)]
pub struct Output {
    pub clicked: Option<Selection>,
    pub zoom_into: Option<String>,
}

pub fn show(ui: &mut egui::Ui, input: &Input) -> Output {
    let (area, _) = ui.allocate_exact_size(ui.available_size(), Sense::hover());
    let painter = ui.painter_at(area);
    let mut out = Output::default();

    let focused = input.focus.and_then(|id| input.workloads.iter().find(|w| w.id == id));
    let drawn = match focused {
        Some(w) => draw_processes(ui, &painter, input, w, area, &mut out),
        None => draw_workloads(ui, &painter, input, area, &mut out),
    };

    if drawn == 0 {
        let msg = match input.metric {
            Metric::Memory => "Reading running processes…",
            Metric::Cpu => "Nothing is using the CPU right now.",
            Metric::Disk => "No disk reads or writes right now.",
        };
        painter.text(area.center(), Align2::CENTER_CENTER, msg, FontId::proportional(14.0), MUTED);
    }
    out
}

fn draw_workloads(ui: &egui::Ui, painter: &Painter, input: &Input, area: egui::Rect, out: &mut Output) -> usize {
    let rates_of = |w: &WorkloadGroup| input.workload_rates.get(&w.id).copied().unwrap_or_default();
    let mut ranked: Vec<(&WorkloadGroup, u64)> = input
        .workloads
        .iter()
        .map(|w| (w, input.metric.weight(w.aggregated_metrics.phys_footprint, rates_of(w))))
        .filter(|(_, v)| *v > 0)
        .collect();
    ranked.sort_by_key(|(_, v)| std::cmp::Reverse(*v));

    let mut items: Vec<(String, String, u64)> = ranked
        .iter()
        .take(MAX_WORKLOADS)
        .map(|(w, v)| (w.id.clone(), w.name.clone(), *v))
        .collect();
    let rest: u64 = ranked.iter().skip(MAX_WORKLOADS).map(|(_, v)| v).sum();
    if rest > 0 {
        items.push((OTHER_ID.to_string(), format!("{} more apps", ranked.len() - MAX_WORKLOADS), rest));
    }

    let by_id: HashMap<&str, &WorkloadGroup> = input.workloads.iter().map(|w| (w.id.as_str(), w)).collect();
    let nodes = SquarifiedTreemap::layout(&items, to_core(area));

    for node in &nodes {
        let tile = to_egui(node.rect).shrink(1.5);
        if tile.width() < 2.0 || tile.height() < 2.0 {
            continue;
        }
        let Some(w) = by_id.get(node.id.as_str()).copied() else {
            painter.rect_filled(tile, CornerRadius::same(3), theme::mix(theme::BORDER, BG, 0.4));
            label(painter, tile.shrink(6.0), &node.label, None);
            continue;
        };

        let color = theme::category_color(&w.category);
        let tile_resp = ui.interact(tile, ui.id().with(("w", &w.id)), Sense::click());
        painter.rect_filled(tile, CornerRadius::same(3), theme::mix(color, BG, 0.78));

        let has_header = tile.height() >= HEADER_H * 2.0 && tile.width() >= 70.0;
        let value_text = input.metric.format(w.aggregated_metrics.phys_footprint, rates_of(w));
        let body = if has_header {
            let band = egui::Rect::from_min_size(tile.min, Vec2::new(tile.width(), HEADER_H));
            painter.rect_filled(band, CornerRadius { nw: 3, ne: 3, sw: 0, se: 0 }, theme::mix(color, BG, 0.66));
            painter.line_segment([band.left_top(), band.right_top()], Stroke::new(2.0, color));
            label(painter, band.shrink2(Vec2::new(7.0, 4.0)), &w.name, Some(&value_text));
            egui::Rect::from_min_max(Pos2::new(tile.min.x, band.max.y), tile.max).shrink(2.0)
        } else {
            tile
        };

        if has_header {
            draw_children(ui, painter, input, w, color, body, out);
        } else if tile.width() > 60.0 && tile.height() > 18.0 {
            label(painter, tile.shrink2(Vec2::new(6.0, 4.0)), &w.name, Some(&value_text));
        }

        if input.flagged.contains(&w.id) {
            hatch(painter, tile, color.gamma_multiply(0.14));
        }
        if !input.filter.is_empty() && !matches_filter(w, input) {
            painter.rect_filled(tile, CornerRadius::same(3), BG.gamma_multiply(0.75));
        }

        let selected = *input.selection == Selection::Workload(w.id.clone());
        outline(painter, tile, selected, tile_resp.hovered());
        let tip = format!("{}\n{} · {} processes", w.name, value_text, w.member_pids.len());
        let tile_resp = tile_resp.on_hover_text_at_pointer(tip);
        if tile_resp.double_clicked() {
            out.zoom_into = Some(w.id.clone());
        } else if tile_resp.clicked() {
            out.clicked = Some(Selection::Workload(w.id.clone()));
        }
    }
    nodes.len()
}

fn draw_children(
    ui: &egui::Ui,
    painter: &Painter,
    input: &Input,
    w: &WorkloadGroup,
    color: Color32,
    body: egui::Rect,
    out: &mut Output,
) {
    if body.width() < 8.0 || body.height() < 8.0 {
        return;
    }
    let items = process_items(input, w);
    for node in SquarifiedTreemap::layout(&items, to_core(body)) {
        let r = to_egui(node.rect).shrink(1.0);
        if r.width() < 2.0 || r.height() < 2.0 {
            continue;
        }
        painter.rect_filled(r, CornerRadius::same(2), theme::mix(color, BG, 0.6));
        let Ok(pid) = node.id.parse::<Pid>() else { continue };
        if r.width() > 56.0 && r.height() > 30.0 {
            let value = input.metric.format(process_footprint(input, pid), rate_of(input, pid));
            stacked_label(painter, r.shrink2(Vec2::new(6.0, 4.0)), &node.label, &value);
        }

        let resp = ui.interact(r, ui.id().with(("p", pid)), Sense::click());
        let selected = *input.selection == Selection::Process(pid);
        if selected || resp.hovered() {
            outline(painter, r, selected, resp.hovered());
        }
        let resp = resp.on_hover_text_at_pointer(format!("{} (PID {pid})\nin {}", node.label, w.name));
        if resp.double_clicked() {
            out.zoom_into = Some(w.id.clone());
        } else if resp.clicked() {
            out.clicked = Some(Selection::Process(pid));
        }
    }
}

/// Zoomed view: one workload's processes fill the whole area.
fn draw_processes(ui: &egui::Ui, painter: &Painter, input: &Input, w: &WorkloadGroup, area: egui::Rect, out: &mut Output) -> usize {
    let color = theme::category_color(&w.category);
    let nodes = SquarifiedTreemap::layout(&process_items(input, w), to_core(area));
    for node in &nodes {
        let tile = to_egui(node.rect).shrink(1.5);
        let Ok(pid) = node.id.parse::<Pid>() else { continue };
        if tile.width() < 2.0 || tile.height() < 2.0 {
            continue;
        }
        painter.rect_filled(tile, CornerRadius::same(3), theme::mix(color, BG, 0.7));
        painter.line_segment([tile.left_top(), tile.right_top()], Stroke::new(2.0, color));
        if tile.width() > 60.0 && tile.height() > 34.0 {
            let value = input.metric.format(process_footprint(input, pid), rate_of(input, pid));
            stacked_label(painter, tile.shrink2(Vec2::new(8.0, 6.0)), &node.label, &format!("{value} · PID {pid}"));
        }
        if !input.filter.is_empty() && !node.label.to_lowercase().contains(&input.filter.to_lowercase()) {
            painter.rect_filled(tile, CornerRadius::same(3), BG.gamma_multiply(0.75));
        }
        let resp = ui.interact(tile, ui.id().with(("zp", pid)), Sense::click());
        outline(painter, tile, *input.selection == Selection::Process(pid), resp.hovered());
        if resp.on_hover_text_at_pointer(format!("{} (PID {pid})", node.label)).clicked() {
            out.clicked = Some(Selection::Process(pid));
        }
    }
    nodes.len()
}

/// Treemap items for a workload's member processes (id = PID).
fn process_items(input: &Input, w: &WorkloadGroup) -> Vec<(String, String, u64)> {
    let mut items: Vec<(String, String, u64)> = w
        .member_pids
        .iter()
        .filter_map(|pid| {
            let p = input.processes.get(pid)?;
            let v = input.metric.weight(p.metrics.phys_footprint, rate_of(input, *pid));
            (v > 0).then(|| (pid.to_string(), p.info.name.clone(), v))
        })
        .collect();
    items.sort_by_key(|(_, _, v)| std::cmp::Reverse(*v));
    items.truncate(MAX_CHILDREN);
    items
}

fn process_footprint(input: &Input, pid: Pid) -> u64 {
    input.processes.get(&pid).map(|p| p.metrics.phys_footprint).unwrap_or(0)
}

fn rate_of(input: &Input, pid: Pid) -> Rates {
    input.rates.get(&pid).copied().unwrap_or_default()
}

fn matches_filter(w: &WorkloadGroup, input: &Input) -> bool {
    let needle = input.filter.to_lowercase();
    w.name.to_lowercase().contains(&needle)
        || w.member_pids.iter().any(|pid| {
            input.processes.get(pid).is_some_and(|p| p.info.name.to_lowercase().contains(&needle))
        })
}

/// Name on the left, optional value on the right, both clipped to `rect`.
fn label(painter: &Painter, rect: egui::Rect, name: &str, value: Option<&str>) {
    let font = FontId::proportional(12.5);
    let mut name_width = rect.width();
    if let Some(value) = value {
        let galley = painter.layout_no_wrap(value.to_string(), FontId::monospace(10.5), MUTED);
        if galley.size().x + 40.0 < rect.width() {
            name_width -= galley.size().x + 8.0;
            painter.galley(Pos2::new(rect.max.x - galley.size().x, rect.min.y + 1.0), galley, MUTED);
        }
    }
    let name = fit(painter, name, &font, name_width);
    painter.with_clip_rect(rect).text(rect.min, Align2::LEFT_TOP, name, font, TEXT);
}

/// Name with the value on the line below, like disktree's inner tiles.
fn stacked_label(painter: &Painter, rect: egui::Rect, name: &str, value: &str) {
    let clip = painter.with_clip_rect(rect);
    let font = FontId::proportional(12.0);
    clip.text(rect.min, Align2::LEFT_TOP, fit(painter, name, &font, rect.width()), font, TEXT);
    clip.text(rect.min + Vec2::new(0.0, 16.0), Align2::LEFT_TOP, value, FontId::monospace(10.5), MUTED);
}

/// Truncates `text` with an ellipsis so it fits in `max_width`.
fn fit(painter: &Painter, text: &str, font: &FontId, max_width: f32) -> String {
    let width = |s: &str| painter.layout_no_wrap(s.to_string(), font.clone(), TEXT).size().x;
    if width(text) <= max_width {
        return text.to_string();
    }
    let mut chars: Vec<char> = text.chars().collect();
    while !chars.is_empty() {
        chars.pop();
        let candidate: String = chars.iter().collect::<String>() + "…";
        if width(&candidate) <= max_width {
            return candidate;
        }
    }
    String::new()
}

fn outline(painter: &Painter, rect: egui::Rect, selected: bool, hovered: bool) {
    if selected {
        painter.rect_stroke(rect, CornerRadius::same(3), Stroke::new(2.0, theme::ACCENT), StrokeKind::Inside);
    } else if hovered {
        painter.rect_stroke(rect, CornerRadius::same(3), Stroke::new(1.0, TEXT.gamma_multiply(0.6)), StrokeKind::Inside);
    }
}

/// Diagonal hatching marks workloads with an active alert.
fn hatch(painter: &Painter, rect: egui::Rect, color: Color32) {
    let clip = painter.with_clip_rect(rect);
    let stroke = Stroke::new(1.0, color);
    let mut x = rect.min.x - rect.height();
    while x < rect.max.x {
        clip.line_segment([Pos2::new(x, rect.max.y), Pos2::new(x + rect.height(), rect.min.y)], stroke);
        x += 9.0;
    }
}

/// CPU share with one decimal below 10%, where whole numbers would all read "0%".
pub fn cpu(pct: f32) -> String {
    if pct < 10.0 { format!("{pct:.1}%") } else { format!("{pct:.0}%") }
}

fn to_core(r: egui::Rect) -> Rect {
    Rect { x: r.min.x, y: r.min.y, w: r.width(), h: r.height() }
}

fn to_egui(r: Rect) -> egui::Rect {
    egui::Rect::from_min_size(Pos2::new(r.x, r.y), Vec2::new(r.w, r.h))
}
