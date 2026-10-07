#!/usr/bin/env bash
# Builds a universal (Apple Silicon + Intel) diskMon.app and wraps it in a .dmg.
# Usage: scripts/package-macos.sh   → dist/diskMon-macos-universal.dmg
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"
APP="dist/diskMon.app"
DMG="dist/diskMon-macos-universal.dmg"
export MACOSX_DEPLOYMENT_TARGET=11.0

for target in aarch64-apple-darwin x86_64-apple-darwin; do
  cargo build --release -p resource-ui --target "$target"
done

rm -rf dist && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
lipo -create \
  target/aarch64-apple-darwin/release/resource-ui \
  target/x86_64-apple-darwin/release/resource-ui \
  -output "$APP/Contents/MacOS/diskMon"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>diskMon</string>
  <key>CFBundleDisplayName</key><string>diskMon</string>
  <key>CFBundleIdentifier</key><string>com.antcybersec.diskmon</string>
  <key>CFBundleExecutable</key><string>diskMon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# Ad-hoc signature: required for Apple Silicon to launch the binary. Not notarized.
codesign --force --deep --sign - "$APP"

STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "diskMon" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"

echo "Built $DMG"
