#!/bin/bash
# Prints the GitHub release notes for a version: its CHANGELOG.md section,
# then download and install steps, bundled components and checksums.
# Used by .github/workflows/build.yml.
#   bash scripts/release-notes.sh <version> <yt-dlp version> <mac .dmg> <windows .exe>
set -euo pipefail
cd "$(dirname "$0")/.."
version=$1 ytdlp=$2 dmg=$3 exe=$4

# The lines between "## <version>" and the next "## " heading
changes=$(awk -v v="## $version" '$0 == v { on = 1; next } /^## / { on = 0 } on' CHANGELOG.md | sed -e '/./,$!d')
if [ -z "$changes" ]; then
  echo "CHANGELOG.md has no \"## $version\" section. Add one describing this version." >&2
  exit 1
fi

mb() { echo "$(( ($(wc -c < "$1") + 524288) / 1048576 )) MB"; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

cat <<EOF
$changes

## Download

| Your computer | File |
|---|---|
| Mac with Apple Silicon (M1 or newer), macOS 13 Ventura or newer | **$(basename "$dmg")** ($(mb "$dmg")) |
| Windows 10 or 11, 64-bit | **$(basename "$exe")** ($(mb "$exe")) |

## Install

**Mac**
1. Open the \`.dmg\` and drag **MNP Media Downloader** into **Applications**.
2. Open it from Applications.
3. The app isn't signed with an Apple Developer ID, so macOS will block it the first time. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.

**Windows**
1. Run the installer. It installs for your user account only, so no administrator password is needed.
2. The installer isn't code-signed, so Windows SmartScreen may say it "protected your PC". Click **More info**, then **Run anyway**.
3. The app opens when installation finishes, and you can find it in the Start menu.

## Bundled components

- yt-dlp $ytdlp (The Unlicense)
- FFmpeg, GPL static builds: Mac by Martin Riedl (build scripts: https://git.martin-riedl.de/ffmpeg/build-script), Windows by BtbN (build scripts: https://github.com/BtbN/FFmpeg-Builds). Licensed under the GNU GPL v3. Source: https://ffmpeg.org/download.html#get-sources
- Electron (MIT)

See [THIRD_PARTY_NOTICES.md](https://github.com/PaulMNP/mnp-media-downloader/blob/main/THIRD_PARTY_NOTICES.md).

## Checksums (SHA-256)

- \`$(basename "$dmg")\`: \`$(sha "$dmg")\`
- \`$(basename "$exe")\`: \`$(sha "$exe")\`

The official builds may be used for personal use (see [LICENSE](https://github.com/PaulMNP/mnp-media-downloader/blob/main/LICENSE)). Please only download content you have the right to download.
EOF
