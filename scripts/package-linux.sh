#!/usr/bin/env bash
# Builds diskMon for Linux x86_64 as an AppImage (any distro) and a .deb (Debian/Ubuntu).
# Usage: scripts/package-linux.sh
#   → dist/diskMon-linux-x86_64.AppImage
#   → dist/diskMon-linux-amd64.deb
# Needs: cargo-deb (`cargo install cargo-deb`) and network access to fetch appimagetool.
set -euo pipefail

cd "$(dirname "$0")/.."

cargo build --release -p resource-ui

rm -rf dist && mkdir -p dist

# --- .deb -------------------------------------------------------------------
cargo deb --no-build -p resource-ui --output dist/diskMon-linux-amd64.deb

# --- AppImage ---------------------------------------------------------------
APPDIR="$(mktemp -d)/diskMon.AppDir"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/applications" "$APPDIR/usr/share/icons/hicolor/512x512/apps"
cp target/release/resource-ui "$APPDIR/usr/bin/diskmon"
cp packaging/linux/diskmon.desktop "$APPDIR/usr/share/applications/"
cp packaging/diskmon.png "$APPDIR/usr/share/icons/hicolor/512x512/apps/"
cp packaging/linux/diskmon.desktop "$APPDIR/"
cp packaging/diskmon.png "$APPDIR/"
ln -s usr/bin/diskmon "$APPDIR/AppRun"

TOOL="$(mktemp -d)/appimagetool"
curl -fsSL -o "$TOOL" https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x "$TOOL"
# Extract-and-run avoids needing FUSE on the build machine.
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$TOOL" "$APPDIR" dist/diskMon-linux-x86_64.AppImage

ls -lh dist
