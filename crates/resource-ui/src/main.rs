// Hide the console window that would otherwise open next to the app on Windows.
#![cfg_attr(windows, windows_subsystem = "windows")]

mod app;
mod sampler;

use std::sync::{Arc, Mutex};

fn main() -> eframe::Result {
    let telemetry = Arc::new(Mutex::new(sampler::Telemetry::default()));

    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_title("diskMon")
            .with_inner_size([1180.0, 760.0])
            .with_min_inner_size([820.0, 520.0]),
        ..Default::default()
    };

    eframe::run_native(
        "diskMon",
        options,
        Box::new(move |cc| {
            let ctx = cc.egui_ctx.clone();
            sampler::spawn(Arc::clone(&telemetry), move || ctx.request_repaint());
            Ok(Box::new(app::DiskMonApp::new(cc, telemetry)))
        }),
    )
}
