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

# Static GPL build (no --enable-nonfree, so it may be redistributed) from
# https://ffmpeg.martin-riedl.de. Includes the VideoToolbox H.264 encoder.
if [ ! -x resources/bin/ffmpeg ]; then
  echo "Downloading ffmpeg…"
  tmp=$(mktemp -d)
  curl -fL --progress-bar -o "$tmp/ffmpeg.zip" https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip
  unzip -q -o "$tmp/ffmpeg.zip" -d "$tmp"
  mv "$tmp/ffmpeg" resources/bin/ffmpeg
  chmod +x resources/bin/ffmpeg
fi

# Refuse to bundle an ffmpeg that can't legally be redistributed
if resources/bin/ffmpeg -hide_banner -version | grep -q -- "--enable-nonfree"; then
  echo "resources/bin/ffmpeg was built with --enable-nonfree and can't be redistributed. Delete it and run again." >&2
  exit 1
fi

resources/bin/yt-dlp_macos/yt-dlp_macos --version
resources/bin/ffmpeg -version | head -1
