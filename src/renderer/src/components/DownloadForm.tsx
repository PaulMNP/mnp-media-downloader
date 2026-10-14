import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useDownloadsStore } from '../store/downloads'
import { api, type DownloadItem, type MediaFormat, type MediaInfo } from '../types'
import { detectPlatform, isUrl, formatDuration, extractUrls, parseTime } from '../lib/platform'
import { Segmented, Thumb, PlatformTag, Spinner } from './ui'

type Kind = 'video' | 'audio'
const QUALITY_STEPS = [2160, 1440, 1080, 720, 480, 360]
const qualityLabel = (h: number) => (h === 2160 ? '4K' : `${h}p`)

export default function DownloadForm() {
  const { addToQueue, settings } = useDownloadsStore()
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<Kind>('video')
  const [format, setFormat] = useState<MediaFormat>('mp4')
  const [quality, setQuality] = useState('best')
  const [playlist, setPlaylist] = useState(false)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [infoError, setInfoError] = useState('')
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [clipboardUrl, setClipboardUrl] = useState('')
  const [trim, setTrim] = useState(false)
  const [clipStart, setClipStart] = useState('')
  const [clipEnd, setClipEnd] = useState('')
  const [dragging, setDragging] = useState(false)
  const lookupId = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const links = extractUrls(url)
  const batch = links.length > 1
  const trimmed = batch ? '' : (links[0] || url.trim())
  const valid = !batch && isUrl(trimmed)
  const startTime = parseTime(clipStart)
  const endTime = parseTime(clipEnd)
  const badTime = trim && (startTime === null || endTime === null)
  const platform = detectPlatform(trimmed)

  // Apply saved defaults once settings load
  useEffect(() => {
    if (!settings) return
    const f = settings.defaultFormat as MediaFormat
    setKind(f === 'mp3' || f === 'm4a' ? 'audio' : 'video')
    setFormat(f)
    setQuality(settings.defaultQuality || 'best')
  }, [settings])

  // Offer the clipboard link whenever the window regains focus
  useEffect(() => {
    const check = () =>
      api.readClipboard().then((t) => setClipboardUrl(isUrl(t) ? t.trim() : '')).catch(() => {})
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  // Look up title/thumbnail/qualities shortly after the link changes
  useEffect(() => {
    setInfo(null)
    setInfoError('')
    if (!valid || platform.soundPage) return
    const id = ++lookupId.current
    const timer = setTimeout(async () => {
      setLoadingInfo(true)
      try {
        const result = await api.fetchInfo(trimmed, playlist)
        if (id === lookupId.current) setInfo(result)
      } catch (e) {
        if (id === lookupId.current) setInfoError(String((e as Error).message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      } finally {
        if (id === lookupId.current) setLoadingInfo(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [trimmed, valid, playlist, platform.soundPage])

  useEffect(() => setPlaylist(!!platform.playlistHint && /youtube\.com\/playlist/.test(trimmed)), [trimmed])

  const switchKind = (k: Kind) => {
    setKind(k)
    setFormat(k === 'audio' ? 'mp3' : 'mp4')
  }

  const reset = () => {
    setUrl('')
    setTrim(false)
    setClipStart('')
    setClipEnd('')
    setInfo(null)
    setInfoError('')
    setPlaylist(false)
    inputRef.current?.focus()
  }

  const startOne = async (target: string, withInfo: boolean) => {
    const id = crypto.randomUUID()
    const audio = kind === 'audio'
    const clip = trim && !playlist && withInfo
    const item: DownloadItem = {
      id,
      url: target,
      title: (withInfo && info?.title) || target,
      platform: detectPlatform(target).label,
      thumbnail: withInfo ? info?.thumbnail : undefined,
      status: 'queued',
      progress: 0,
      format,
      quality: audio ? 'best' : quality,
      isAudioOnly: audio,
      playlist: withInfo && playlist,
      clipStart: clip ? startTime || undefined : undefined,
      clipEnd: clip ? endTime || undefined : undefined,
      addedAt: Date.now()
    }
    addToQueue(item)
    await api.startDownload({
      id,
      url: target,
      format,
      quality: item.quality,
      isAudioOnly: audio,
      outputDir: settings?.outputDir || '~/Downloads',
      playlist: item.playlist,
      clipStart: item.clipStart,
      clipEnd: item.clipEnd
    })
  }

  const submit = useCallback(async () => {
    if (badTime) return
    if (batch) {
      for (const link of links.filter((l) => !detectPlatform(l).soundPage)) await startOne(link, false)
      return reset()
    }
    if (!valid || platform.soundPage) return
    await startOne(trimmed, true)
    reset()
  }, [trimmed, links, batch, valid, kind, format, quality, playlist, info, settings, trim, startTime, endTime, badTime])

  // Accept links dragged in from the browser
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (text) setUrl(extractUrls(text).join(' ') || text.trim())
  }

  // Only offer qualities the video actually has (plus the next step up)
  const maxHeight = info?.heights?.[0]
  const qualityOptions = [
    { value: 'best', label: 'Best' },
    ...QUALITY_STEPS.filter((h) => !maxHeight || h <= maxHeight).map((h) => ({ value: qualityLabel(h).toLowerCase(), label: qualityLabel(h) }))
  ].slice(0, 6)

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-2xl bg-surface border overflow-hidden transition-colors ${dragging ? 'border-accent' : 'border-line'}`}
    >
      {/* Paste field */}
      <div className="p-4 pb-3">
        <div className="relative">
          <input
            ref={inputRef}
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={dragging ? 'Drop the link here' : 'Paste or drop links from YouTube, TikTok, Instagram, X, Facebook…'}
            spellCheck={false}
            className="w-full h-12 pl-4 pr-28 rounded-xl bg-bg border border-line text-[15px] placeholder:text-faint focus:border-line-strong transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loadingInfo && <Spinner />}
            {url ? (
              <button onClick={reset} className="px-2.5 py-1 rounded-md text-xs text-muted hover:text-ink hover:bg-surface-2">Clear</button>
            ) : (
              <button
                onClick={() => api.readClipboard().then((t) => setUrl(t.trim()))}
                className="px-2.5 py-1 rounded-md text-xs text-muted hover:text-ink hover:bg-surface-2"
              >
                Paste
              </button>
            )}
          </div>
        </div>

        {!url && clipboardUrl && (
          <button
            onClick={() => setUrl(clipboardUrl)}
            className="mt-2 max-w-full truncate text-xs text-muted hover:text-ink text-left"
          >
            Use copied link: <span className="text-ink">{clipboardUrl}</span>
          </button>
        )}
      </div>

      {url && !valid && !batch && <p className="px-4 pb-3 -mt-1 text-xs text-danger">That doesn't look like a link. It should start with https://</p>}

      {batch && (
        <div className="px-4 pb-4">
          <ul className="max-h-40 overflow-y-auto mb-3 rounded-lg bg-bg border border-line divide-y divide-line">
            {links.map((l) => {
              const p = detectPlatform(l)
              return (
                <li key={l} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                  <PlatformTag label={p.label} color={p.color} />
                  <span className={`truncate mono ${p.soundPage ? 'text-faint line-through' : 'text-muted'}`}>{l}</span>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Segmented value={kind} onChange={switchKind} options={[{ value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio' }]} />
            <Segmented
              size="sm"
              value={format}
              onChange={setFormat}
              options={kind === 'video'
                ? [{ value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]
                : [{ value: 'mp3', label: 'MP3' }, { value: 'm4a', label: 'M4A' }]}
            />
            {kind === 'video' && (
              <Segmented size="sm" value={quality} onChange={setQuality}
                options={[{ value: 'best', label: 'Best' }, { value: '1080p', label: '1080p' }, { value: '720p', label: '720p' }, { value: '480p', label: '480p' }]} />
            )}
            <button onClick={() => submit()} className="ml-auto h-9 px-5 rounded-lg bg-accent text-white font-semibold hover:brightness-110 transition">
              Download {links.filter((l) => !detectPlatform(l).soundPage).length} links
            </button>
          </div>
        </div>
      )}

      {valid && platform.soundPage && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-bg border border-line text-xs leading-relaxed">
          <p className="text-warn font-medium mb-0.5">{platform.label} pages can't be downloaded directly</p>
          <p className="text-muted">Open any video that uses this sound, copy its link, paste it here and choose <b className="text-ink">Audio</b>. You'll get the same sound as an MP3.</p>
        </div>
      )}

      {valid && !platform.soundPage && (
        <>
          {/* Preview */}
          <div className="px-4 pb-4 flex items-center gap-3 min-h-[72px]">
            <Thumb src={info?.thumbnail} platformColor={platform.color} audio={kind === 'audio'} size={52} />
            <div className="min-w-0 flex-1">
              <PlatformTag label={platform.label} color={platform.color} />
              {info ? (
                <>
                  <p className="text-ink font-medium truncate mt-0.5">{info.title}</p>
                  <p className="text-xs text-muted truncate mono">
                    {[info.uploader, formatDuration(info.duration), info.isPlaylist && info.entryCount ? `${info.entryCount} videos` : '', maxHeight ? `up to ${qualityLabel(maxHeight)}` : '']
                      .filter(Boolean).join('  ·  ')}
                  </p>
                </>
              ) : infoError ? (
                <p className="text-xs text-danger mt-0.5 line-clamp-2 select-text">{infoError}</p>
              ) : (
                <p className="text-muted mt-0.5">{loadingInfo ? 'Looking up…' : ' '}</p>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="px-4 py-3 border-t border-line flex flex-wrap items-center gap-x-5 gap-y-3">
            <Segmented value={kind} onChange={switchKind} options={[{ value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio' }]} />
            <Segmented
              size="sm"
              value={format}
              onChange={setFormat}
              options={kind === 'video'
                ? [{ value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]
                : [{ value: 'mp3', label: 'MP3' }, { value: 'm4a', label: 'M4A' }]}
            />
            {kind === 'video' && <Segmented size="sm" value={quality} onChange={setQuality} options={qualityOptions} />}
            {platform.playlistHint && (
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={playlist} onChange={(e) => setPlaylist(e.target.checked)} className="accent-[var(--accent)]" />
                Whole playlist
              </label>
            )}
            {!playlist && (
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} className="accent-[var(--accent)]" />
                Trim
              </label>
            )}
            {trim && !playlist && (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <input value={clipStart} onChange={(e) => setClipStart(e.target.value)} placeholder="0:00"
                  className={`w-16 h-7 px-2 rounded-md bg-bg border mono ${startTime === null ? 'border-danger' : 'border-line'}`} />
                to
                <input value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} placeholder={formatDuration(info?.duration) || 'end'}
                  className={`w-16 h-7 px-2 rounded-md bg-bg border mono ${endTime === null ? 'border-danger' : 'border-line'}`} />
              </span>
            )}
            <button
              onClick={() => submit()}
              disabled={badTime}
              className="ml-auto h-9 px-5 rounded-lg bg-accent disabled:opacity-40 text-white font-semibold hover:brightness-110 active:brightness-95 transition flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v9M4 7l4 4 4-4M2.5 14h11" /></svg>
              Download
            </button>
          </div>
        </>
      )}
    </section>
  )
}
