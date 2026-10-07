//! Colours and number formatting shared by every part of the UI.

use eframe::egui::Color32;
use resource_core::GroupCategory;

// Palette shared with the diskMon website.
pub const BG: Color32 = Color32::from_rgb(0x12, 0x11, 0x10);
pub const PANEL: Color32 = Color32::from_rgb(0x1b, 0x1a, 0x18);
pub const BORDER: Color32 = Color32::from_rgb(0x34, 0x32, 0x2f);
pub const TEXT: Color32 = Color32::from_rgb(0xf4, 0xf1, 0xec);
pub const MUTED: Color32 = Color32::from_rgb(0x9a, 0x96, 0x90);
pub const ACCENT: Color32 = Color32::from_rgb(0xf0, 0x8a, 0x3c);
pub const AMBER: Color32 = Color32::from_rgb(0xf2, 0xae, 0x3d);
pub const CORAL: Color32 = Color32::from_rgb(0xec, 0x6a, 0x5c);
pub const VIOLET: Color32 = Color32::from_rgb(0xb0, 0x7c, 0xe8);
pub const BLUE: Color32 = Color32::from_rgb(0x6c, 0x9c, 0xf0);
pub const TEAL: Color32 = Color32::from_rgb(0x4f, 0xbf, 0xae);
pub const ROSE: Color32 = Color32::from_rgb(0xea, 0x8a, 0xb3);
pub const SLATE: Color32 = Color32::from_rgb(0x7d, 0x79, 0x73);
pub const SUCCESS: Color32 = Color32::from_rgb(0x5f, 0xc8, 0x8f);

/// Categories in legend order.
pub const CATEGORIES: [GroupCategory; 9] = [
    GroupCategory::Browser,
    GroupCategory::Ide,
    GroupCategory::LanguageServer,
    GroupCategory::BuildSystem,
    GroupCategory::ContainerRuntime,
    GroupCategory::Database,
    GroupCategory::LocalLlm,
    GroupCategory::UserApplication,
    GroupCategory::SystemDaemon,
];

pub fn category_color(category: &GroupCategory) -> Color32 {
    match category {
        GroupCategory::Browser => AMBER,
        GroupCategory::Ide => VIOLET,
        GroupCategory::LanguageServer => BLUE,
        GroupCategory::BuildSystem => CORAL,
        GroupCategory::ContainerRuntime => TEAL,
        GroupCategory::Database => Color32::from_rgb(0x9c, 0xc8, 0x5a),
        GroupCategory::LocalLlm => ROSE,
        GroupCategory::SystemDaemon => SLATE,
        GroupCategory::UserApplication | GroupCategory::Unclassified => ACCENT,
    }
}

pub fn category_name(category: &GroupCategory) -> &'static str {
    match category {
        GroupCategory::Browser => "Browsers",
        GroupCategory::Ide => "IDEs",
        GroupCategory::LanguageServer => "Language servers",
        GroupCategory::BuildSystem => "Builds",
        GroupCategory::ContainerRuntime => "Containers",
        GroupCategory::Database => "Databases",
        GroupCategory::LocalLlm => "Local AI",
        GroupCategory::SystemDaemon => "System",
        GroupCategory::UserApplication | GroupCategory::Unclassified => "Apps",
    }
}

/// Blend from `a` (t = 0) to `b` (t = 1) in sRGB space, which matches how the eye reads
/// "a darker, muted version of this colour".
pub fn mix(a: Color32, b: Color32, t: f32) -> Color32 {
    let ch = |x: u8, y: u8| (x as f32 + (y as f32 - x as f32) * t).round() as u8;
    Color32::from_rgb(ch(a.r(), b.r()), ch(a.g(), b.g()), ch(a.b(), b.b()))
}

const KB: f64 = 1024.0;
const MB: f64 = KB * 1024.0;
const GB: f64 = MB * 1024.0;

pub fn bytes(b: u64) -> String {
    let (value, unit) = bytes_parts(b as f64);
    format!("{value} {unit}")
}

/// Splits a byte count into a display number and unit, e.g. `("5.29", "GB")`.
pub fn bytes_parts(b: f64) -> (String, &'static str) {
    if b >= GB {
        (format!("{:.2}", b / GB), "GB")
    } else if b >= MB {
        (format!("{:.0}", b / MB), "MB")
    } else {
        (format!("{:.0}", b / KB), "KB")
    }
}

pub fn rate(bps: f64) -> String {
    let (value, unit) = bytes_parts(bps);
    format!("{value} {unit}/s")
}

pub fn pct(part: f64, total: f64) -> f64 {
    if total <= 0.0 { 0.0 } else { part / total * 100.0 }
}
