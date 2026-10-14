#!/bin/bash
# Puts yt-dlp and ffmpeg in resources/bin so they get bundled into the app.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p resources/bin

# The unpacked ("onedir") build starts in ~0.3s; the single-file build
# re-extracts itself on every run and takes ~12s.
if [ ! -x resources/bin/yt-dlp_macos/yt-dlp_macos ]; then
  echo "Downloading yt-dlp…"
  tmp=$(mktemp -d)
  curl -fL --progress-bar -o "$tmp/yt-dlp_macos.zip" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos.zip
  mkdir -p resources/bin/yt-dlp_macos
  unzip -q -o "$tmp/yt-dlp_macos.zip" -d resources/bin/yt-dlp_macos
  chmod +x resources/bin/yt-dlp_macos/yt-dlp_macos
fi

if [ ! -x resources/bin/ffmpeg ]; then
  echo "Copying ffmpeg from ffmpeg-static…"
  cp node_modules/ffmpeg-static/ffmpeg resources/bin/ffmpeg
  chmod +x resources/bin/ffmpeg
fi

resources/bin/yt-dlp_macos/yt-dlp_macos --version
resources/bin/ffmpeg -version | head -1
