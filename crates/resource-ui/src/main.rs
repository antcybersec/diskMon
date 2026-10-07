// Hide the console window that would otherwise open next to the app on Windows.
#![cfg_attr(windows, windows_subsystem = "windows")]

mod app;
mod sampler;
mod theme;
mod treemap;

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

fn main() -> eframe::Result {
    let telemetry = Arc::new(Mutex::new(sampler::Telemetry::default()));
    let paused = Arc::new(AtomicBool::new(false));

    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_title("diskMon")
            .with_inner_size([1280.0, 820.0])
            .with_min_inner_size([900.0, 560.0]),
        ..Default::default()
    };

    eframe::run_native(
        "diskMon",
        options,
        Box::new(move |cc| {
            let ctx = cc.egui_ctx.clone();
            sampler::spawn(Arc::clone(&telemetry), Arc::clone(&paused), move || ctx.request_repaint());
            Ok(Box::new(app::DiskMonApp::new(cc, telemetry, paused)))
        }),
    )
}
