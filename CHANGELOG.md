# Changelog

What changed in each version. When a version tag is pushed, the release
workflow copies that version's section into the GitHub release notes.

## 1.1.1

This update fixes a bug in 1.1.0 that could delete a video: saving an MP3 of a video you had already downloaded removed the video file. **If you have 1.1.0, please update.**

- Downloading the MP3 or M4A of a video already in your folder no longer deletes that video
- A trimmed clip of a video you already downloaded is now a real clip; before, you got the whole video again (and the whole video after a clip gave you the clip)
- Clips are saved with their times in the name, e.g. `Title [id] (clip 1.30-2.00).mp4`, so they sit next to the full video
- Regular X (Twitter) video posts tested: full video, clips and MP3

## 1.1.0

- **Windows version**, with Windows-style window buttons, a tray icon, Ctrl shortcuts and logging in through Chrome, Edge, Firefox, Brave, Opera or Vivaldi
- **Trimming works again** on Mac (it failed in 1.0.0)
- Sites that only send whole videos (such as Bluesky) can now be trimmed: the app downloads the video and trims it itself
- **Cancel** now fully stops trimmed downloads, and quitting the app stops running downloads
- Rumble and other sites that block download tools are retried automatically as a regular browser
- Clearer messages when a site needs a login or can't be trimmed (Loom)
- The Arc login option was replaced with Opera and Vivaldi (the download engine can't read Arc's login)

## 1.0.0

The first public release, for Macs with Apple Silicon.
