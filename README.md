<p align="center">
  <img src="docs/icon.png" width="128" height="128" alt="MNP Media Downloader icon">
</p>

<h1 align="center">MNP Media Downloader</h1>

<p align="center">
  A Mac and Windows app for saving videos and audio from YouTube, TikTok, Instagram, Facebook, X and more.<br>
  Paste a link, pick a format, done.
</p>

<p align="center">
  <img src="docs/screenshots/preview.png" width="760" alt="Pasting a link shows a preview with the title, channel, length and available qualities">
</p>

## Features

- **Paste and go.** Paste or drag in a link and see the title, thumbnail, length and the qualities that are actually available before you download.
- **Video or audio.** MP4 or WebM up to 4K, or MP3 / M4A with cover art.
- **Plays everywhere.** Instagram and Facebook often send VP9 or AV1 video that QuickTime, Photos and iPhone can't open. The app converts these to H.264 automatically (using the hardware encoder on a Mac).
- **Several at once.** Paste a whole list of links; downloads run side by side with live progress, speed and time left.
- **Playlists.** Download an entire YouTube playlist into its own numbered folder.
- **Trim.** Save just part of a video, for example 1:30 to 2:00.
- **Subtitles.** Optionally include the creator's subtitles inside the video.
- **Menu bar / tray shortcut.** Copy a link anywhere, then choose *Download Copied Link* from the app's icon in the Mac menu bar or the Windows system tray.
- **Notifications** when downloads finish in the background.
- **Stays working.** The download engine updates itself daily, because sites change often.
- **Clear errors.** Instead of raw error codes, the app says what went wrong and what to do about it.

<p align="center">
  <img src="docs/screenshots/queue.png" width="760" alt="Two downloads in progress with speed and time remaining">
</p>

## Supported sites

| Site | Video | Audio | Notes |
| --- | :---: | :---: | --- |
| YouTube (videos, Shorts, playlists) | ✅ | ✅ | Up to 4K |
| TikTok | ✅ | ✅ | |
| Instagram (Reels, posts) | ✅ | ✅ | Private posts need *Use browser login* |
| Facebook (videos, Reels) | ✅ | ✅ | |
| X / Twitter | ✅ | ✅ | Only posts that contain a video |
| SoundCloud | | ✅ | |
| Bandcamp | | ✅ | |
| Vimeo | ✅ | ✅ | Needs *Use browser login* |
| Twitch (clips) | ✅ | ✅ | |
| Dailymotion | ✅ | ✅ | |
| Bilibili | ✅ | ✅ | Some videos need *Use browser login* |
| Rumble | ✅ | ✅ | |
| Pinterest | ✅ | ✅ | |
| Bluesky | ✅ | ✅ | |
| LinkedIn | ✅ | ✅ | Public posts |
| Snapchat Spotlight | ✅ | ✅ | |
| Kick (clips) | ✅ | ✅ | |
| Streamable | ✅ | ✅ | |
| Loom | ✅ | ✅ | Choose *Best* quality; trimming isn't possible |

Hundreds of other sites work too, since the app is built on [yt-dlp](https://github.com/yt-dlp/yt-dlp).

**Reddit and Tumblr** now refuse downloads unless you're logged in. Turning on *Use browser login* should help, but this hasn't been tested yet.

**Not supported:** TikTok and Instagram *sound* pages. Paste a video that uses the sound and choose *Audio* instead.

## Requirements

- **Mac:** Apple Silicon (M1 or newer), macOS 13 Ventura or newer
- **Windows:** Windows 10 or 11, 64-bit

## Installing

### Mac

1. Download the latest `.dmg` from the [Releases page](https://github.com/PaulMNP/mnp-media-downloader/releases/latest) and open it.
2. Drag **MNP Media Downloader** into **Applications**.
3. Open it from Applications or Spotlight.

The app is not signed with an Apple Developer ID, so macOS may refuse to open it the first time. If that happens, try opening it once, then go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.

The first launch takes about 10 seconds longer while macOS checks the built-in download tools.

### Windows

1. Download the latest `MNP-Media-Downloader-Setup-…-x64.exe` from the [Releases page](https://github.com/PaulMNP/mnp-media-downloader/releases/latest) and run it. It installs for your user account only, so no administrator password is needed.
2. The installer is not code-signed, so Windows SmartScreen may say it "protected your PC". Click **More info**, then **Run anyway**.
3. The app opens when installation finishes, and you can find it in the Start menu.

## Using it

1. Copy a link from your browser or phone.
2. In the app, click **Paste** (or press ⌘V on a Mac, Ctrl+V on Windows), or drag the link onto the window.
3. Choose **Video** or **Audio**, a format and a quality, then click **Download**.

Finished downloads go to your Downloads folder (change this in Settings) and appear under **History**, where you can open them or show them in Finder or File Explorer.

<p align="center">
  <img src="docs/screenshots/settings.png" width="760" alt="Settings: download folder, default format and quality, browser login, MP4 compatibility, subtitles, notifications and updates">
</p>

### Private or login-only posts

Turn on **Settings → Use browser login** and choose a browser where you're signed in to the site. The app then uses that browser's cookies for downloads. macOS may ask for your password the first time. On Windows, choose Firefox: Chrome, Edge and Brave don't let other apps read their logins there. Nothing is sent anywhere except to the site you're downloading from.

### If a site stops working

Sites change how they serve video all the time. Go to **Settings → Check for updates** to get the newest download engine. The app also does this automatically once a day.

## Building from source

You need [Node.js](https://nodejs.org) 20.19 or newer (or 22.12+).

```sh
npm install
npm run dev      # run the app in development mode
npm run dist     # build the Mac .app and .dmg into dist/
npm run dist:win # build the Windows installer into dist/ (works on a Mac too)
```

These commands first run `scripts/fetch-binaries.sh`, which downloads yt-dlp and a redistributable FFmpeg build into `resources/bin` (Mac) or `resources/bin-win` (Windows). Neither is committed to git.

## Responsible use

This app is meant for saving content you have the right to download, such as your own uploads, content with a permissive license, or content that is in the public domain. Respect the terms of service of each site and the rights of creators. You are responsible for how you use the app.

This project is not affiliated with, endorsed by or sponsored by YouTube, Google, TikTok, ByteDance, Instagram, Facebook, Meta, X, SoundCloud, Vimeo or any other site mentioned here. All trademarks belong to their owners.

## License

Copyright © 2026 PaulMNP. All rights reserved. See [LICENSE](LICENSE).

The app bundles third-party software (yt-dlp, FFmpeg, Electron) under their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
