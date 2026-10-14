import React, { useState } from 'react'
import { useDownloadsStore } from '../store/downloads'
import { api, type DownloadItem } from '../types'
import { detectPlatform, timeAgo } from '../lib/platform'
import { Thumb, PlatformTag, IconButton } from './ui'

function HistoryRow({ item }: { item: DownloadItem }) {
  const { removeFromHistory, addToQueue, settings } = useDownloadsStore()
  const platform = detectPlatform(item.url)
  const ok = item.status === 'complete'

  const retry = async () => {
    const id = crypto.randomUUID()
    removeFromHistory(item.id)
    addToQueue({ ...item, id, status: 'queued', progress: 0, error: undefined, speed: '', eta: '', addedAt: Date.now() })
    await api.startDownload({
      id, url: item.url, format: item.format, quality: item.quality, isAudioOnly: item.isAudioOnly,
      outputDir: settings?.outputDir || '~/Downloads', playlist: item.playlist
    })
  }

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface transition-colors">
      <button disabled={!ok || !item.outputPath} onClick={() => item.outputPath && api.openFile(item.outputPath)} className="flex-shrink-0">
        <Thumb src={item.thumbnail} platformColor={platform.color} audio={item.isAudioOnly} size={36} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate ${ok ? 'text-ink' : 'text-muted'}`}>{item.title}</p>
        <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
          <PlatformTag label={platform.label} color={platform.color} />
          <span className="mono uppercase">{item.format}</span>
          {item.playlist && item.filesDone ? <span className="mono">{item.filesDone} files</span> : null}
          {item.status === 'error' && <span className="text-danger truncate select-text" title={item.error}>{item.error}</span>}
          {item.status === 'cancelled' && <span>Cancelled</span>}
          <span className="ml-auto flex-shrink-0">{timeAgo(item.completedAt || item.addedAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
        {ok && item.outputPath ? (
          <>
            <IconButton title="Open" onClick={() => api.openFile(item.outputPath!)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
            </IconButton>
            <IconButton title="Show in Finder" onClick={() => api.showInFolder(item.outputPath!)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 4.5a1 1 0 011-1h3.5l1.5 1.5h6a1 1 0 011 1v6.5a1 1 0 01-1 1h-11a1 1 0 01-1-1z" /></svg>
            </IconButton>
          </>
        ) : (
          <IconButton title="Try again" onClick={retry}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13.5 8A5.5 5.5 0 113 4.5M3 1.5v3h3" /></svg>
          </IconButton>
        )}
        <IconButton title="Remove from history" danger onClick={() => removeFromHistory(item.id)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
        </IconButton>
      </div>
    </div>
  )
}

export default function DownloadHistory() {
  const { history, clearHistory } = useDownloadsStore()
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState(false)
  const q = query.toLowerCase()
  const items = q ? history.filter((h) => `${h.title} ${h.url} ${h.platform}`.toLowerCase().includes(q)) : history

  if (history.length === 0) {
    return <p className="py-14 text-center text-muted">Finished downloads will show up here.</p>
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 px-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${history.length} downloads`}
          className="flex-1 h-8 px-3 rounded-lg bg-surface border border-line placeholder:text-faint focus:border-line-strong"
        />
        {confirming ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-muted">Clear all history? Files stay on disk.</span>
            <button onClick={() => { clearHistory(); setConfirming(false) }} className="text-danger font-medium">Clear</button>
            <button onClick={() => setConfirming(false)} className="text-muted">Keep</button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-xs text-muted hover:text-ink">Clear history</button>
        )}
      </div>
      {items.map((item) => <HistoryRow key={item.id} item={item} />)}
      {items.length === 0 && <p className="py-8 text-center text-muted">No matches.</p>}
    </div>
  )
}
