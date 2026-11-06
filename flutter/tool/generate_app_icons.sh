#!/bin/zsh
# Regenerates every app icon (iOS, Android, web) from one 1024x1024 opaque PNG.
# Usage: tool/generate_app_icons.sh [path/to/source-1024.png]
# Default source is the iOS marketing icon, which is the master copy in the repo.
set -euo pipefail
cd "${0:A:h}/.."

ios_dir=ios/Runner/Assets.xcassets/AppIcon.appiconset
src="${1:-$ios_dir/Icon-App-1024x1024@1x.png}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Flatten onto white so no output has an alpha channel (App Store rejects transparent icons).
master=$tmp/master.png
sips -s format jpeg -s formatOptions 100 "$src" --out "$tmp/flat.jpg" >/dev/null
sips -s format png -z 1024 1024 "$tmp/flat.jpg" --out "$master" >/dev/null

resize() { # size out
  sips -s format png -z "$1" "$1" "$master" --out "$2" >/dev/null
}

# iOS: filename -> pixel size
for spec in 1024x1024@1x:1024 20x20@1x:20 20x20@2x:40 20x20@3x:60 \
            29x29@1x:29 29x29@2x:58 29x29@3x:87 40x40@1x:40 40x40@2x:80 40x40@3x:120 \
            60x60@2x:120 60x60@3x:180 76x76@1x:76 76x76@2x:152 83.5x83.5@2x:167; do
  resize "${spec##*:}" "$tmp/Icon-App-${spec%%:*}.png"
done
cp "$tmp"/Icon-App-*.png "$ios_dir/"

# Android legacy launcher icons
for spec in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  resize "${spec##*:}" "android/app/src/main/res/mipmap-${spec%%:*}/ic_launcher.png"
done

# Web
resize 192 web/icons/Icon-192.png
resize 512 web/icons/Icon-512.png
resize 32 web/favicon.png
# Maskable icons keep the artwork inside the 80% safe zone.
sips -s format png -z 700 700 "$master" --out "$tmp/inner.png" >/dev/null
sips -s format png --padToHeightWidth 1024 1024 --padColor FFFFFF "$tmp/inner.png" --out "$tmp/maskable.png" >/dev/null
sips -s format png -z 192 192 "$tmp/maskable.png" --out web/icons/Icon-maskable-192.png >/dev/null
sips -s format png -z 512 512 "$tmp/maskable.png" --out web/icons/Icon-maskable-512.png >/dev/null

echo "App icons regenerated from $src"
