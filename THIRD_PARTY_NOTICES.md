# Third-party notices

MNP Media Downloader is built with, and the macOS app bundles, the following
third-party software. Each is the property of its respective authors and is
distributed under its own license, not under this project's license.

## Bundled in the app

| Component | What it does | License | Source |
| --- | --- | --- | --- |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Finds and downloads media from websites | The Unlicense (public domain). Its macOS build also includes Python and other libraries under their own licenses; see yt-dlp's [THIRD_PARTY_LICENSES.txt](https://github.com/yt-dlp/yt-dlp/blob/master/THIRD_PARTY_LICENSES.txt) | https://github.com/yt-dlp/yt-dlp |
| [FFmpeg](https://ffmpeg.org) (static macOS build by [Martin Riedl](https://ffmpeg.martin-riedl.de)) | Merges, converts and trims audio/video | GNU GPL v3 (built with `--enable-gpl --enable-version3`, including libx264, libvpx, libdav1d, libmp3lame and libopus) | FFmpeg source: https://ffmpeg.org/download.html#get-sources — build scripts: https://git.martin-riedl.de/ffmpeg/build-script |
| [Electron](https://www.electronjs.org) | Desktop app runtime (includes Chromium and Node.js) | MIT; Chromium components under their own licenses (see `LICENSES.chromium.html` inside the app) | https://github.com/electron/electron |

FFmpeg is included as a separate program that the app runs; it is not
linked into this project's code. The version bundled in a release is shown
by `ffmpeg -version`; its complete corresponding source code is available
from the links above, or on request from the copyright holder of this
project for three years after each release. FFmpeg is a trademark of Fabrice Bellard.

## Used to build the app

React, Zustand, electron-store, Tailwind CSS, Vite and electron-vite (all MIT
licensed), plus their dependencies as listed in `package-lock.json`.
