import { app } from 'electron'
import { execFile } from 'child_process'
import { chmodSync, cpSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// yt-dlp and ffmpeg ship inside the app (resources/bin). On first launch they
// are copied to ~/Library/Application Support/<app>/bin, where yt-dlp can
// update itself and macOS quarantine flags can be cleared.
//
// yt-dlp is the unpacked "onedir" build (a folder with an _internal dir): it
// starts in ~0.3s, while the single-file build takes ~12s on every run.
const ENTRIES = {
  'yt-dlp': { copy: 'yt-dlp_macos', exe: join('yt-dlp_macos', 'yt-dlp_macos') },
  ffmpeg: { copy: 'ffmpeg', exe: 'ffmpeg' }
} as const
type Name = keyof typeof ENTRIES

function bundledDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'bin') : join(app.getAppPath(), 'resources', 'bin')
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
    if (existsSync(join(dir, exe)) || !existsSync(source)) continue
    cpSync(source, join(dir, copy), { recursive: true })
    chmodSync(join(dir, exe), 0o755)
    execFile('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', join(dir, copy)], () => {
      // Run once now so macOS's one-time security scan (~10s) doesn't
      // happen during the first real download
      execFile(join(dir, exe), name === 'ffmpeg' ? ['-version'] : ['--version'], () => {})
    })
  }
}
