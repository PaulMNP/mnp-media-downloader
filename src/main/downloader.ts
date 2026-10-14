import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import { binPath } from './binaries'
import { BrowserWindow, Notification, clipboard } from 'electron'
import { getSettings } from './settings'

// Bundled binaries, copied to Application Support on first launch (see binaries.ts)
const ytdlp = () => binPath('yt-dlp')
const ffmpeg = () => binPath('ffmpeg')

// Markers we ask yt-dlp to print so we can parse its output reliably
const TITLE_MARK = '__MNP_TITLE__'
const FILE_MARK = '__MNP_FILE__'

export interface DownloadRequest {
  id: string
  url: string
  format: 'mp4' | 'webm' | 'mp3' | 'm4a'
  quality: string
  isAudioOnly: boolean
  outputDir: string
  playlist?: boolean
  clipStart?: string
  clipEnd?: string
  convertMp4?: boolean
  embedSubs?: boolean
  notify?: boolean
}

interface QueueItem extends DownloadRequest {
  status: 'queued' | 'downloading' | 'complete' | 'error' | 'cancelled'
}

export interface MediaInfo {
  title: string
  thumbnail?: string
  duration?: number
  uploader?: string
  extractor: string
  isPlaylist: boolean
  entryCount?: number
  heights: number[]
}

const queue: QueueItem[] = []
const active = new Map<string, ChildProcess>()
let maxConcurrent = 3

function sendToRenderer(channel: string, data: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  })
}

function resolveOutputDir(outputDir: string): string {
  return outputDir.startsWith('~') ? outputDir.replace('~', homedir()) : outputDir
}

// Facebook titles look like "15K views · 219 reactions | Real title | Page name"
const FB_COUNTS = String.raw`^(?:[\d.,]+[KMB]? (?:views|reactions|comments|shares|likes)\s*[·|｜]\s*)+`
const FB_PAGE = String.raw`\s*[|｜]\s*[^|｜]+$`
const isFacebook = (url: string) => /facebook\.com|fb\.watch/.test(url)

function cleanTitle(url: string, title: string): string {
  if (!isFacebook(url)) return title
  return title.replace(new RegExp(FB_COUNTS), '').replace(new RegExp(FB_PAGE), '').trim() || title
}

function titleArgs(url: string): string[] {
  return isFacebook(url)
    ? ['--replace-in-metadata', 'title', FB_COUNTS, '', '--replace-in-metadata', 'title', FB_PAGE, '']
    : []
}

const HEIGHTS: Record<string, string> = { '4k': '2160', '1440p': '1440', '1080p': '1080', '720p': '720', '480p': '480', '360p': '360' }

// Args shared by every yt-dlp call (info lookups and downloads)
async function commonArgs(): Promise<string[]> {
  const settings = await getSettings()
  const args = ['--no-warnings', '--ffmpeg-location', ffmpeg()]
  if (settings.cookiesBrowser && settings.cookiesBrowser !== 'none') {
    args.push('--cookies-from-browser', settings.cookiesBrowser)
  }
  return args
}

async function buildArgs(item: DownloadRequest): Promise<string[]> {
  const outDir = resolveOutputDir(item.outputDir)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const nameTemplate = item.playlist
    ? '%(playlist_title|Playlist).100B/%(playlist_index|0)03d - %(title).150B [%(id)s].%(ext)s'
    : '%(title).150B [%(id)s].%(ext)s'

  const args = [
    ...(await commonArgs()),
    '--newline',
    '--progress',
    '--no-simulate',
    '--no-quiet',
    '--no-mtime',
    '--embed-metadata',
    item.playlist ? '--yes-playlist' : '--no-playlist',
    '-O', `before_dl:${TITLE_MARK}%(title)s`,
    '-O', `after_move:${FILE_MARK}%(filepath)s`,
    '-o', `${outDir}/${nameTemplate}`,
    ...titleArgs(item.url)
  ]

  const audioOnly = item.isAudioOnly || item.format === 'mp3' || item.format === 'm4a'

  if (audioOnly) {
    args.push('-f', 'ba/b')
    args.push('-x', '--audio-format', item.format === 'm4a' ? 'm4a' : 'mp3', '--audio-quality', '0')
    args.push('--embed-thumbnail')
  } else {
    // Works on every site: merge separate video+audio streams when the site
    // has them, otherwise take the best single file. -S caps the resolution
    // and prefers codecs that fit the chosen container.
    const ext = item.format === 'webm' ? 'webm' : 'mp4'
    const h = HEIGHTS[item.quality?.toLowerCase()]
    const sort = ext === 'mp4' ? ['vcodec:h264', 'ext:mp4:m4a'] : ['ext:webm:webm']
    sort.unshift(h ? `res:${h}` : 'res')
    args.push('-f', 'bv*+ba/b', '-S', sort.join(','))
    args.push('--merge-output-format', ext, '--remux-video', ext)
    if (item.embedSubs) {
      // Creator-made subtitles only (not auto-generated), built into the video
      args.push('--write-subs', '--sub-langs', 'all,-live_chat', '--embed-subs')
    }
  }

  // Only download part of the video, e.g. 1:30 to 2:00
  if (item.clipStart || item.clipEnd) {
    args.push('--download-sections', `*${item.clipStart || '0'}-${item.clipEnd || 'inf'}`, '--force-keyframes-at-cuts')
  }

  args.push(item.url)
  return args
}

function parseProgress(line: string): { percent: number; speed: string; eta: string } | null {
  // e.g. [download]  45.3% of   12.34MiB at    1.23MiB/s ETA 00:05
  const m = line.match(/\[download\]\s+([\d.]+)%(?:\s+of\s+~?\s*\S+)?(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/)
  if (!m) return null
  return { percent: parseFloat(m[1]), speed: m[2] && m[2] !== 'Unknown' ? m[2] : '', eta: m[3] && m[3] !== 'Unknown' ? m[3] : '' }
}

// Turn yt-dlp's raw error into something a person can act on
function friendlyError(raw: string): string {
  const msg = raw
    .replace(/^\s*ERROR:\s*/i, '')
    .replace(/^\[[^\]]+\]\s*/, '') // "[vimeo] "
    .replace(/^[\w-]+:\s+/, '') // "76979871: "
    .replace(/\s*\(caused by .*\)\s*$/i, '')
    .replace(/\s*(Use --cookies|See\s+https?:\/\/|Confirm you are on the latest).*$/is, '')
    .trim()
  const r = msg.toLowerCase()
  if (r.includes('could not copy') || r.includes('could not find') && r.includes('cookies'))
    return 'Could not read that browser\'s login. Quit the browser and try again, or choose another browser in Settings.'
  if (r.includes('http error 404') || /\bnot found\b/.test(r)) return 'Nothing found at this link. Check that it\'s correct and the post is still up.'
  if (/\blog(ged)?[ -]?in\b|\bsign in\b|\bprivate\b|\bage[- ]restrict|\byour age\b|\bmembers[- ]only\b|\brate[- ]?limit|\bcookies\b/.test(r))
    return 'This needs you to be logged in. Turn on Settings → "Use browser login" with a browser where you\'re signed in to the site.'
  if (r.includes('unsupported url')) return 'This site or type of link isn\'t supported.'
  if (r.includes('http error 403') || r.includes('http error 429'))
    return 'The site blocked the download. Try Settings → "Check for updates", or turn on browser login.'
  if (r.includes('no video') || r.includes('no media') || r.includes('there is no video'))
    return 'There\'s no video or audio in this post. It may only have text, images or a link.'
  if (r.includes('unable to download') || r.includes('timed out') || r.includes('network')) return `Couldn't reach the site: ${msg}`
  return msg || 'Download failed'
}

function run(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args)
    let out = ''
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (out += d.toString()))
    proc.on('close', (code) => resolve({ code: code ?? 1, out }))
    proc.on('error', () => resolve({ code: 1, out }))
  })
}

// Instagram and some other sites only serve VP9/AV1, which QuickTime, Photos
// and iPhones can't play. Re-encode those to H.264 with the hardware encoder.
async function ensurePlayableMp4(file: string): Promise<void> {
  if (!file.toLowerCase().endsWith('.mp4') || !existsSync(file)) return
  // ffmpeg -i prints stream info (to stderr) and exits; read the video codec from it
  const probe = await run(ffmpeg(), ['-hide_banner', '-i', file])
  const codec = probe.out.match(/Stream #0:\d+[^:]*: Video: (\w+)/)?.[1]
  if (!codec || codec === 'h264' || codec === 'hevc') return
  const tmp = file.replace(/\.mp4$/i, '.converting.mp4')
  const res = await run(ffmpeg(), [
    '-v', 'error', '-y', '-i', file,
    '-map', '0', '-c:s', 'copy', '-c:v', 'h264_videotoolbox', '-q:v', '65', '-tag:v', 'avc1',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp
  ])
  if (res.code === 0 && existsSync(tmp)) {
    renameSync(tmp, file)
  } else if (existsSync(tmp)) {
    unlinkSync(tmp)
  }
}

// Show a macOS notification when the app isn't in front
function notifyDone(item: QueueItem, files: string[]) {
  if (!item.notify || !Notification.isSupported()) return
  if (BrowserWindow.getAllWindows().some((w) => w.isFocused())) return
  const last = files[files.length - 1] || ''
  const name = last.split('/').pop()?.replace(/ \[[^\]]+\]\.\w+$/, '') || 'Download'
  const n = new Notification({
    title: files.length > 1 ? `Downloaded ${files.length} files` : 'Download finished',
    body: name
  })
  n.on('click', () => {
    if (last) import('electron').then(({ shell }) => shell.showItemInFolder(last))
  })
  n.show()
}

function startDownloadProcess(item: QueueItem, args: string[]) {
  item.status = 'downloading'
  const proc = spawn(ytdlp(), args)
  active.set(item.id, proc)

  let stderrBuffer = ''
  let stdoutTail = ''
  let entry = { index: 1, count: 1 }
  const files: string[] = []

  sendToRenderer('download:progress', { id: item.id, progress: 0, speed: '', eta: '', status: 'downloading' })

  const handleLine = (line: string) => {
    if (line.startsWith(TITLE_MARK)) {
      const title = line.slice(TITLE_MARK.length)
      sendToRenderer('download:progress', { id: item.id, title: item.playlist ? undefined : title, currentItem: title })
      return
    }
    if (line.startsWith(FILE_MARK)) {
      const path = line.slice(FILE_MARK.length)
      files.push(path)
      sendToRenderer('download:progress', { id: item.id, outputPath: path, filesDone: files.length })
      return
    }
    const pl = line.match(/\[download\] Downloading (?:item|video) (\d+) of (\d+)/)
    if (pl) {
      entry = { index: parseInt(pl[1]), count: parseInt(pl[2]) }
      sendToRenderer('download:progress', { id: item.id, playlistIndex: entry.index, playlistCount: entry.count })
      return
    }
    const plTitle = line.match(/\[download\] Downloading playlist: (.+)/)
    if (plTitle) {
      sendToRenderer('download:progress', { id: item.id, title: plTitle[1] })
      return
    }
    const progress = parseProgress(line)
    if (progress) {
      // For playlists, show overall progress across all entries
      const overall = ((entry.index - 1) + progress.percent / 100) / entry.count * 100
      sendToRenderer('download:progress', {
        id: item.id,
        progress: Math.min(99.9, overall),
        speed: progress.speed,
        eta: progress.eta,
        status: 'downloading'
      })
    } else if (line.startsWith('[ExtractAudio]') || line.startsWith('[Merger]') || line.startsWith('[VideoRemuxer]')) {
      sendToRenderer('download:progress', { id: item.id, eta: '', speed: 'Processing…' })
    }
  }

  proc.stdout.on('data', (data: Buffer) => {
    const text = stdoutTail + data.toString()
    const lines = text.split('\n')
    stdoutTail = lines.pop() || ''
    lines.forEach((l) => l.trim() && handleLine(l.trim()))
  })

  proc.stderr.on('data', (data: Buffer) => {
    stderrBuffer += data.toString()
  })

  const finish = () => {
    active.delete(item.id)
    const idx = queue.findIndex((q) => q.id === item.id)
    if (idx !== -1) queue.splice(idx, 1)
    processQueue()
  }

  proc.on('close', async (code) => {
    if (stdoutTail.trim()) handleLine(stdoutTail.trim())
    if (item.status === 'cancelled') {
      sendToRenderer('download:error', { id: item.id, error: 'Download cancelled', status: 'cancelled' })
    } else if (code === 0 || (item.playlist && files.length > 0)) {
      // A playlist with a few unavailable entries still counts as done
      if (item.convertMp4 && !item.isAudioOnly && item.format === 'mp4') {
        sendToRenderer('download:progress', { id: item.id, speed: 'Converting for QuickTime…', eta: '' })
        for (const f of files) await ensurePlayableMp4(f)
      }
      if ((item.status as QueueItem['status']) === 'cancelled') {
        sendToRenderer('download:error', { id: item.id, error: 'Download cancelled', status: 'cancelled' })
        return finish()
      }
      sendToRenderer('download:complete', {
        id: item.id,
        status: 'complete',
        progress: 100,
        outputPath: files[files.length - 1],
        filesDone: files.length
      })
      notifyDone(item, files)
    } else {
      const raw = stderrBuffer.split('\n').filter((l) => l.includes('ERROR:')).pop()
        || stderrBuffer.trim().split('\n').pop() || `yt-dlp exited with code ${code}`
      sendToRenderer('download:error', { id: item.id, error: friendlyError(raw), status: 'error' })
    }
    finish()
  })

  proc.on('error', (err) => {
    sendToRenderer('download:error', { id: item.id, error: err.message, status: 'error' })
    finish()
  })
}

async function processQueue() {
  const pending = queue.filter((item) => item.status === 'queued')
  const slots = maxConcurrent - active.size
  for (const item of pending.slice(0, Math.max(0, slots))) {
    item.status = 'downloading'
    try {
      startDownloadProcess(item, await buildArgs(item))
    } catch (e) {
      queue.splice(queue.indexOf(item), 1)
      sendToRenderer('download:error', { id: item.id, error: (e as Error).message, status: 'error' })
    }
  }
}

export async function addToQueue(item: DownloadRequest): Promise<void> {
  const settings = await getSettings()
  maxConcurrent = settings.maxConcurrent
  queue.push({ ...item, convertMp4: settings.convertMp4, embedSubs: settings.embedSubs, notify: settings.notify, status: 'queued' })
  await processQueue()
}

export function cancelDownload(id: string): void {
  const proc = active.get(id)
  const queueItem = queue.find((q) => q.id === id)
  if (queueItem) queueItem.status = 'cancelled'

  if (proc) {
    proc.kill('SIGTERM')
  } else {
    const idx = queue.findIndex((q) => q.id === id)
    if (idx !== -1) queue.splice(idx, 1)
    sendToRenderer('download:error', { id, error: 'Download cancelled', status: 'cancelled' })
  }
}

function runYtdlp(args: string[], timeoutMs = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlp(), args)
    let out = ''
    let err = ''
    const timer = setTimeout(() => proc.kill('SIGTERM'), timeoutMs)
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (err += d.toString()))
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) return resolve(out)
      const msg = err.split('\n').filter((l) => l.includes('ERROR:')).pop() || err.trim() || `yt-dlp exited with code ${code}`
      reject(new Error(friendlyError(msg)))
    })
    proc.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

// Look up title, thumbnail and available resolutions before downloading
export async function fetchInfo(url: string, playlist = false): Promise<MediaInfo> {
  const args = [...(await commonArgs()), '-J', playlist ? '--flat-playlist' : '--no-playlist', url]
  const info = JSON.parse(await runYtdlp(args))
  const isPlaylist = info._type === 'playlist'
  const heights = Array.from(
    new Set<number>((info.formats || []).map((f: { height?: number }) => f.height).filter((h: unknown): h is number => typeof h === 'number' && h > 0))
  ).sort((a, b) => b - a)
  const thumb = info.thumbnail || info.thumbnails?.[info.thumbnails.length - 1]?.url || info.entries?.[0]?.thumbnails?.[0]?.url
  return {
    title: cleanTitle(url, info.title || info.id || url),
    thumbnail: thumb,
    duration: info.duration,
    uploader: info.uploader || info.channel || info.uploader_id,
    extractor: info.extractor_key || info.extractor || '',
    isPlaylist,
    entryCount: isPlaylist ? info.playlist_count ?? info.entries?.length : undefined,
    heights
  }
}

export function getYtdlpVersion(): Promise<string> {
  return runYtdlp(['--version'], 30000).then((v) => v.trim())
}

export async function updateYtdlp(): Promise<string> {
  const out = await runYtdlp(['-U'], 180000)
  return out.trim().split('\n').pop() || 'Done'
}

// Start a download that didn't come from the window (menu bar icon).
// The renderer is told so it can show the item in its queue.
export async function queueFromClipboard(): Promise<string | null> {
  const url = (await clipboard.readText()).trim()
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return null
  const settings = await getSettings()
  const audio = settings.defaultFormat === 'mp3' || settings.defaultFormat === 'm4a'
  const request: DownloadRequest = {
    id: `tray-${Date.now()}`,
    url,
    format: settings.defaultFormat as DownloadRequest['format'],
    quality: audio ? 'best' : settings.defaultQuality,
    isAudioOnly: audio,
    outputDir: settings.outputDir
  }
  sendToRenderer('download:added', request)
  await addToQueue(request)
  return url
}

// Keep yt-dlp current: sites change often and old versions stop working
export async function autoUpdateYtdlp(): Promise<void> {
  const { getValue, setValue } = await import('./settings')
  const settings = await getSettings()
  const last = await getValue('lastYtdlpUpdate')
  if (!settings.autoUpdate || Date.now() - last < 24 * 3600 * 1000) return
  try {
    await updateYtdlp()
    await setValue('lastYtdlpUpdate', Date.now())
  } catch {
    // Offline or GitHub unreachable; try again next launch
  }
}
