import React from 'react'
import { useDownloadsStore } from '../store/downloads'
import { api, type DownloadItem } from '../types'
import { detectPlatform } from '../lib/platform'
import { Thumb, PlatformTag, IconButton } from './ui'

function QueueRow({ item }: { item: DownloadItem }) {
  const platform = detectPlatform(item.url)
  const indeterminate = item.status === 'queued' || (item.status === 'downloading' && item.progress === 0)
  const barColor = item.status === 'complete' ? 'var(--ok)' : item.status === 'error' ? 'var(--danger)' : 'var(--accent)'
  const statusText =
    item.status === 'queued' ? 'Waiting…'
    : item.status === 'complete' ? 'Done'
    : item.status === 'error' ? 'Failed'
    : item.status === 'cancelled' ? 'Cancelled'
    : item.speed || 'Starting…'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-line">
      <Thumb src={item.thumbnail} platformColor={platform.color} audio={item.isAudioOnly} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <p className="truncate font-medium flex-1">{item.title}</p>
          <span className="mono text-xs text-muted">{item.progress > 0 ? `${item.progress.toFixed(0)}%` : ''}</span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-bg overflow-hidden">
          {indeterminate ? (
            <div className="h-full w-2/5 rounded-full indeterminate" style={{ background: barColor, opacity: 0.6 }} />
          ) : (
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${item.progress}%`, background: barColor }} />
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
          <PlatformTag label={platform.label} color={platform.color} />
          <span className="uppercase mono">{item.format}{!item.isAudioOnly && item.quality !== 'best' ? ` · ${item.quality}` : ''}</span>
          {item.playlist && item.playlistCount ? <span className="mono">{item.playlistIndex} of {item.playlistCount}</span> : null}
          {(item.clipStart || item.clipEnd) && <span className="mono">{item.clipStart || '0:00'}–{item.clipEnd || 'end'}</span>}
          <span className="ml-auto mono">{statusText}{item.eta ? `  ·  ${item.eta} left` : ''}</span>
        </div>
        {item.error && <p className="mt-1 text-xs text-danger truncate">{item.error}</p>}
      </div>
      {(item.status === 'queued' || item.status === 'downloading') && (
        <IconButton title="Cancel" danger onClick={() => api.cancelDownload(item.id)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
        </IconButton>
      )}
    </div>
  )
}

export default function DownloadQueue() {
  const { queue, history } = useDownloadsStore()

  if (queue.length === 0) {
    const done = history.filter((h) => h.status === 'complete').length
    return (
      <div className="py-14 text-center">
        <p className="text-muted">Nothing downloading.</p>
        <p className="text-faint text-xs mt-1">
          Copy a link anywhere, come back here and press Paste, or ⌘V then Enter.
          {done > 0 && (done === 1 ? ' 1 finished download is in History.' : ` ${done} finished downloads are in History.`)}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {queue.map((item) => <QueueRow key={item.id} item={item} />)}
    </div>
  )
}
