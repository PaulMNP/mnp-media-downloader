#!/bin/bash
# Puts yt-dlp and ffmpeg in resources/bin (Mac) or resources/bin-win (Windows)
# so they get bundled into the app.
#   bash scripts/fetch-binaries.sh        Mac
#   bash scripts/fetch-binaries.sh win    Windows (can be run on a Mac)
set -euo pipefail
cd "$(dirname "$0")/.."
target=${1:-mac}

# Refuse to bundle an ffmpeg that can't legally be redistributed. The build
# configuration is stored as text inside the binary, so this also works for
# the Windows .exe without running it.
check_ffmpeg() {
  if LC_ALL=C grep -aq -- "--enable-nonfree" "$1"; then
    echo "$1 was built with --enable-nonfree and can't be redistributed. Delete it and run again." >&2
    exit 1
  fi
}

if [ "$target" = win ]; then
  dir=resources/bin-win
  mkdir -p "$dir"
  # Unpacked ("onedir") build: starts much faster than the single yt-dlp.exe
  if [ ! -f "$dir/yt-dlp_win/yt-dlp.exe" ]; then
    echo "Downloading yt-dlp for Windows…"
    tmp=$(mktemp -d)
    curl -fL --progress-bar -o "$tmp/yt-dlp_win.zip" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_win.zip
    mkdir -p "$dir/yt-dlp_win"
    unzip -q -o "$tmp/yt-dlp_win.zip" -d "$dir/yt-dlp_win"
  fi
  # Static GPL build (no --enable-nonfree) from https://github.com/BtbN/FFmpeg-Builds,
  # newest release series. Includes libx264 for the H.264 conversion.
  if [ ! -f "$dir/ffmpeg.exe" ]; then
    name=$(curl -fsSL https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest \
      | grep -o '"name": *"ffmpeg-n[0-9.]*-latest-win64-gpl-[0-9.]*\.zip"' \
      | sed 's/.*"\(ffmpeg-[^"]*\)"/\1/' | sort -V | tail -1)
    echo "Downloading ${name}…"
    tmp=$(mktemp -d)
    curl -fL --progress-bar -o "$tmp/ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/$name"
    unzip -q -o -j "$tmp/ffmpeg.zip" '*/bin/ffmpeg.exe' -d "$dir"
  fi
  check_ffmpeg "$dir/ffmpeg.exe"
  ls -l "$dir" "$dir/yt-dlp_win/yt-dlp.exe"
  exit 0
fi

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

check_ffmpeg resources/bin/ffmpeg

resources/bin/yt-dlp_macos/yt-dlp_macos --version
resources/bin/ffmpeg -version | head -1
