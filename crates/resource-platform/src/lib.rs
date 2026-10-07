pub mod traits;

#[cfg(target_os = "macos")]
pub mod macos;

pub use traits::*;

#[cfg(target_os = "macos")]
pub use macos::MacOsCollector as NativeCollector;
