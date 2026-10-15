import { app } from 'electron'
import { execFile } from 'child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'

// yt-dlp and ffmpeg ship inside the app (resources/bin). On first launch they
// are copied to ~/Library/Application Support/<app>/bin (%APPDATA%\<app>\bin
// on Windows), where yt-dlp can update itself and macOS quarantine flags can
// be cleared.
//
// yt-dlp is the unpacked "onedir" build (a folder with an _internal dir): it
// starts in ~0.3s, while the single-file build takes ~12s on every run.
const isWin = process.platform === 'win32'
const ENTRIES = isWin
  ? {
      'yt-dlp': { copy: 'yt-dlp_win', exe: join('yt-dlp_win', 'yt-dlp.exe') },
      ffmpeg: { copy: 'ffmpeg.exe', exe: 'ffmpeg.exe' }
    }
  : {
      'yt-dlp': { copy: 'yt-dlp_macos', exe: join('yt-dlp_macos', 'yt-dlp_macos') },
      ffmpeg: { copy: 'ffmpeg', exe: 'ffmpeg' }
    }
type Name = keyof typeof ENTRIES

function bundledDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'bin')
  return join(app.getAppPath(), 'resources', isWin ? 'bin-win' : 'bin')
}

function userDir(): string {
  return join(app.getPath('userData'), 'bin')
}

export function binPath(name: Name): string {
  return join(userDir(), ENTRIES[name].exe)
}

export function installBinaries(): void {
  const dir = userDir()
  mkdirSync(dir, { recursive: true })
  for (const name of Object.keys(ENTRIES) as Name[]) {
    const { copy, exe } = ENTRIES[name]
    const source = join(bundledDir(), copy)
    if (!existsSync(source)) continue
    if (existsSync(join(dir, exe))) {
      // yt-dlp updates itself in place, so keep it. ffmpeg is replaced when
      // the app ships a different build.
      if (name === 'yt-dlp' || statSync(join(dir, exe)).size === statSync(source).size) continue
      rmSync(join(dir, copy), { recursive: true, force: true })
    }
    cpSync(source, join(dir, copy), { recursive: true })
    // Run once now so the system's one-time security scan (~10s on macOS,
    // Defender on Windows) doesn't happen during the first real download
    const warmUp = () => execFile(join(dir, exe), name === 'ffmpeg' ? ['-version'] : ['--version'], { windowsHide: true }, () => {})
    if (isWin) {
      warmUp()
    } else {
      chmodSync(join(dir, exe), 0o755)
      execFile('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', join(dir, copy)], warmUp)
    }
  }
}
