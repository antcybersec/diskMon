pub mod traits;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(any(target_os = "windows", target_os = "linux"))]
pub mod portable;

pub use traits::*;

#[cfg(target_os = "macos")]
pub use macos::MacOsCollector as NativeCollector;

#[cfg(any(target_os = "windows", target_os = "linux"))]
pub use portable::SysinfoCollector as NativeCollector;
