pub mod traits;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

pub use traits::*;

#[cfg(target_os = "macos")]
pub use macos::MacOsCollector as NativeCollector;

#[cfg(target_os = "windows")]
pub use windows::WindowsCollector as NativeCollector;
