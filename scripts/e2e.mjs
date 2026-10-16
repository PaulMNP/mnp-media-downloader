// End-to-end test: drives the installed app like a person would (paste a
// link, pick options, click Download) and checks the files it produces.
// Used by .github/workflows/windows-test.yml; also runs on a Mac.
//
//   node scripts/e2e.mjs <path to app executable> <output folder>
//   node scripts/e2e.mjs node_modules/electron/dist/... <output folder> .   (development build)
//
// Needs playwright-core (npm i --no-save playwright-core).
import { _electron as electron } from 'playwright-core'
import { execFileSync, execSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { createServer } from 'http'
import { createReadStream } from 'fs'
import { join, resolve } from 'path'

const [exe, outArg = 'e2e-out', appDir] = process.argv.slice(2)
const out = resolve(outArg)
const dataDir = join(out, 'userdata')
const dlDir = join(out, 'downloads')
const isWin = process.platform === 'win32'
rmSync(out, { recursive: true, force: true })
mkdirSync(dataDir, { recursive: true })
mkdirSync(dlDir, { recursive: true })
// Fresh settings: downloads go to our folder, nothing runs in the background
writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ outputDir: dlDir, notify: false, autoUpdate: false }))

const results = []
const log = (r) => {
  results.push(r)
  console.log(`${r.ok ? 'PASS' : r.optional ? 'SKIP' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
}

const app = await electron.launch({ executablePath: exe, args: appDir ? [resolve(appDir)] : [], env: { ...process.env, MNP_USER_DATA: dataDir }, timeout: 60000 })
const win = await app.firstWindow()
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(2000)
await win.screenshot({ path: join(out, '1-main.png') })
// The page screenshot doesn't include what Windows draws on top (the
// minimize/maximize/close buttons), so also capture the whole screen there
if (isWin) {
  const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $i=New-Object System.Drawing.Bitmap $b.Width,$b.Height; [System.Drawing.Graphics]::FromImage($i).CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $i.Save('${join(out, '0-screen.png')}')`
  try { execFileSync('powershell', ['-NoProfile', '-Command', ps]) } catch (e) { console.log('screen capture failed:', String(e).split('\n')[0]) }
}

// The app copies its bundled ffmpeg into the data folder on first launch
const ffmpeg = join(dataDir, 'bin', isWin ? 'ffmpeg.exe' : 'ffmpeg')

function probe(file) {
  let text = ''
  try { execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: 'pipe' }) } catch (e) { text = String(e.stderr) }
  const dur = text.match(/Duration: (\d+):(\d+):([\d.]+)/)
  return {
    video: text.match(/Stream #0:\d+[^:]*: Video: (\w+)/)?.[1],
    audio: text.match(/Stream #0:\d+[^:]*: Audio: (\w+)/)?.[1],
    seconds: dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : undefined
  }
}

// Tab buttons show counts ("History 7"), so match the start of the name
const tab = (name) => win.getByRole('button', { name: new RegExp(`^${name}`) }).first().click()

async function history() {
  return win.evaluate(() => window.electronAPI.getHistory())
}

// Paste a link, set options, click Download, wait for it to finish
async function download({ url, audio, trim }) {
  await tab('Downloads')
  await win.getByPlaceholder(/Paste or drop links/).fill(url)
  await win.getByText('Trim', { exact: true }).waitFor({ timeout: 120000 })
  await win.waitForTimeout(3000) // let the preview (title, qualities) load
  // The form remembers Video/Audio from the last download, so always choose
  await win.getByRole('button', { name: audio ? 'Audio' : 'Video', exact: true }).first().click()
  if (trim) {
    await win.getByText('Trim', { exact: true }).click()
    await win.getByPlaceholder('0:00').fill(trim[0])
    await win.getByPlaceholder('0:00').locator('xpath=following::input[1]').fill(trim[1])
  }
  await win.getByRole('button', { name: 'Download', exact: true }).click()
  const t0 = Date.now()
  while (Date.now() - t0 < 300000) {
    const entry = (await history()).find((e) => e.url === url && (e.status === 'complete' || e.status === 'error'))
    if (entry) return { ...entry, secs: Math.round((Date.now() - t0) / 1000) }
    await win.waitForTimeout(1000)
  }
  return { status: 'timeout' }
}

async function check(name, job, expect, optional = false) {
  try {
    const e = await download(job)
    if (e.status !== 'complete') return log({ name, ok: false, optional, detail: e.error || e.status })
    if (!e.outputPath || !existsSync(e.outputPath)) return log({ name, ok: false, optional, detail: `file missing: ${e.outputPath}` })
    const p = probe(e.outputPath)
    const problem = expect(p)
    log({ name, ok: !problem, optional, detail: problem || `${p.video || '-'} / ${p.audio || '-'}, ${p.seconds?.toFixed(1)}s, ${e.secs}s to download, ${e.outputPath.split(/[\\/]/).pop()}` })
  } catch (err) {
    log({ name, ok: false, optional, detail: String(err).split('\n')[0] })
  }
}

// 1. A whole video
await check('Streamable video', { url: 'https://streamable.com/dnd1' }, (p) => (p.video === 'h264' && p.audio ? '' : `got ${p.video}/${p.audio}`))

// 2. Trim (yt-dlp hands the download to ffmpeg, which fetches over HTTPS itself)
await check('Bluesky video, trimmed to 0:01-0:04', { url: 'https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g', trim: ['0:01', '0:04'] },
  (p) => (p.seconds && Math.abs(p.seconds - 3) < 1 ? '' : `length ${p.seconds}s, expected 3s`))

// 3. Audio with cover art
await check('Bandcamp track as MP3', { url: 'http://youtube-dl.bandcamp.com/track/youtube-dl-test-song', audio: true },
  (p) => (p.audio === 'mp3' ? '' : `got audio ${p.audio}`))

// 4. A site that blocks yt-dlp until it retries as Chrome; title has non-English characters (｜)
await check('Rumble (403 retry, special characters in title), trimmed', { url: 'https://rumble.com/embed/v5pv5f', trim: ['0:00', '0:08'] },
  (p) => (p.video ? '' : 'no video stream'))

// 5. VP9 video gets converted to H.264. Served from a local web server so the
//    test doesn't depend on Instagram.
const vp9 = join(out, 'vp9-source.mp4')
execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=4', '-f', 'lavfi', '-i', 'sine=duration=4',
  '-c:v', 'libvpx-vp9', '-b:v', '500k', '-c:a', 'aac', '-shortest', vp9])
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': statSync(vp9).size })
  createReadStream(vp9).pipe(res)
}).listen(0, '127.0.0.1')
await new Promise((r) => server.once('listening', r))
await check('VP9 video converted to H.264', { url: `http://127.0.0.1:${server.address().port}/vp9-clip.mp4` },
  (p) => (p.video === 'h264' ? '' : `video is still ${p.video}`))
server.close()

// 6. YouTube. GitHub's servers are often blocked by YouTube, so this one is informational.
await check('YouTube, trimmed (may be blocked on CI servers)', { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', trim: ['0:02', '0:06'] },
  (p) => (p.video ? '' : 'no video'), true)

// 7. Cancel stops every process and leaves no locked files behind. A slow
//    local server keeps the download running long enough to cancel it.
try {
  const big = join(out, 'slow-source.mp4')
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=60', '-f', 'lavfi', '-i', 'sine=duration=60',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '3M', '-c:a', 'aac', '-shortest', big])
  const slow = createServer((req, res) => {
    const size = statSync(big).size
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '')
    const from = m ? +m[1] : 0
    const to = m && m[2] ? +m[2] : size - 1
    res.writeHead(m ? 206 : 200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': to - from + 1,
      ...(m && { 'Content-Range': `bytes ${from}-${to}/${size}` }) })
    const stream = createReadStream(big, { start: from, end: to, highWaterMark: 16384 })
    stream.on('data', (chunk) => { stream.pause(); res.write(chunk); setTimeout(() => stream.resume(), 100) })
    stream.on('end', () => res.end())
    res.on('close', () => stream.destroy())
  }).listen(0, '127.0.0.1')
  await new Promise((r) => slow.once('listening', r))
  await tab('Downloads')
  await win.getByPlaceholder(/Paste or drop links/).fill(`http://127.0.0.1:${slow.address().port}/slow-clip.mp4`)
  await win.getByText('Trim', { exact: true }).waitFor({ timeout: 120000 })
  await win.waitForTimeout(2000)
  await win.getByRole('button', { name: 'Video', exact: true }).first().click()
  // Trimming makes ffmpeg do the downloading, so cancel has to stop yt-dlp
  // *and* the ffmpeg it started
  await win.getByText('Trim', { exact: true }).click()
  await win.getByPlaceholder('0:00').fill('0:10')
  await win.getByRole('button', { name: 'Download', exact: true }).click()
  await win.locator('[title="Cancel"]').first().waitFor({ timeout: 30000 })
  await win.waitForTimeout(5000)
  await win.screenshot({ path: join(out, '2-downloading.png') })
  const procs = () => isWin
    ? execSync('tasklist /FO CSV /NH', { encoding: 'utf8' }).split('\n').filter((l) => /^"(yt-dlp|ffmpeg)\.exe"/i.test(l)).map((l) => l.split(',')[0])
    : execSync('ps -axo comm', { encoding: 'utf8' }).split('\n').filter((l) => l.startsWith(dataDir)).map((l) => l.split('/').pop())
  const before = procs()
  await win.locator('[title="Cancel"]').first().click()
  await win.waitForTimeout(5000)
  const running = procs()
  slow.close()
  const leftovers = readdirSync(dlDir).filter((f) => /\.part|\.ytdl|\.temp|slow-clip/.test(f))
  const locked = leftovers.filter((f) => { try { rmSync(join(dlDir, f)); return false } catch { return true } })
  log({ name: 'Cancel stops yt-dlp and ffmpeg', ok: before.length > 0 && running.length === 0 && locked.length === 0,
    detail: `running before cancel: ${before.join(', ') || 'none'}; after: ${running.join(', ') || 'none'}; locked files: ${locked.join(', ') || 'none'}` })
} catch (err) {
  log({ name: 'Cancel stops yt-dlp and ffmpeg', ok: false, detail: String(err).split('\n')[0] })
}

// Screens for a visual check
await tab('History')
await win.waitForTimeout(800)
await win.screenshot({ path: join(out, '3-history.png') })
await tab('Settings')
await win.waitForTimeout(800)
await win.screenshot({ path: join(out, '4-settings.png'), fullPage: true })

await app.close()
writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.ok && !r.optional)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
