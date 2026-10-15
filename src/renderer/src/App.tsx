import React, { useState, useEffect } from 'react'
import DownloadForm from './components/DownloadForm'
import DownloadQueue from './components/DownloadQueue'
import DownloadHistory from './components/DownloadHistory'
import Settings from './components/Settings'
import { useDownloadsStore } from './store/downloads'
import { api, isWin } from './types'

type Tab = 'downloads' | 'history' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('downloads')
  const { queue, history, setSettings } = useDownloadsStore()

  useEffect(() => {
    api.getSettings().then((s) => s && setSettings(s)).catch(console.error)
  }, [setSettings])

  // ⌘1/⌘2/⌘3 switch tabs, ⌘, opens settings (Ctrl on Windows)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(isWin ? e.ctrlKey : e.metaKey)) return
      const map: Record<string, Tab> = { '1': 'downloads', '2': 'history', '3': 'settings', ',': 'settings' }
      if (map[e.key]) { e.preventDefault(); setTab(map[e.key]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const active = queue.filter((i) => i.status === 'downloading' || i.status === 'queued').length
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'downloads', label: 'Downloads', count: active || undefined },
    { id: 'history', label: 'History', count: history.length || undefined },
    { id: 'settings', label: 'Settings' }
  ]

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* Title bar: leaves room for the macOS traffic lights (left) or the
          Windows window buttons (right) and is draggable */}
      <header className={`drag flex-shrink-0 h-[52px] ${isWin ? 'pl-4 pr-[150px]' : 'pl-[84px] pr-4'} flex items-center gap-6 border-b border-line`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full bg-accent ${active ? 'rec-dot' : 'opacity-40'}`} />
          <span className="font-semibold tracking-tight">MNP</span>
          <span className="text-muted">Media Downloader</span>
        </div>
        <nav className="no-drag flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`h-7 px-3 rounded-md flex items-center gap-1.5 transition-colors ${tab === t.id ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
            >
              {t.label}
              {t.count !== undefined && <span className={`mono text-[11px] ${t.id === 'downloads' ? 'text-accent' : 'text-faint'}`}>{t.count}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-5">
          {tab === 'downloads' && (
            <div className="flex flex-col gap-4">
              <DownloadForm />
              <DownloadQueue />
            </div>
          )}
          {tab === 'history' && <DownloadHistory />}
          {tab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  )
}
