import { create } from 'zustand'
import { api, type DownloadItem, type AppSettings } from '../types'
import { detectPlatform } from '../lib/platform'

const LEGACY_KEY = 'mnp-download-history'

interface DownloadsStore {
  queue: DownloadItem[]
  history: DownloadItem[]
  settings: AppSettings | null
  addToQueue: (item: DownloadItem) => void
  updateItem: (id: string, updates: Partial<DownloadItem>) => void
  moveToHistory: (id: string) => void
  removeFromHistory: (id: string) => void
  setSettings: (s: AppSettings) => void
  clearHistory: () => void
}

export const useDownloadsStore = create<DownloadsStore>((set, get) => ({
  queue: [],
  history: [],
  settings: null,

  addToQueue: (item) => set((state) => ({ queue: [...state.queue, item] })),

  updateItem: (id, updates) => {
    // Drop undefined values so partial progress events don't erase fields
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    set((state) => ({
      queue: state.queue.map((item) => (item.id === id ? { ...item, ...clean } : item))
    }))
  },

  // History is saved by the main process one entry at a time, never by
  // writing this window's whole list, so a window that hasn't loaded history
  // yet (or a second window) can't wipe it. The main process then sends the
  // full list back through onHistoryChanged.
  moveToHistory: (id) => {
    const item = get().queue.find((i) => i.id === id)
    if (!item) return
    const entry = { ...item, completedAt: Date.now() }
    set((state) => ({
      queue: state.queue.filter((i) => i.id !== id),
      history: [entry, ...state.history.filter((h) => h.id !== id)]
    }))
    api.addHistory(entry).catch(console.error)
  },

  removeFromHistory: (id) => {
    set((state) => ({ history: state.history.filter((h) => h.id !== id) }))
    api.removeHistory(id).catch(console.error)
  },

  setSettings: (settings) => set({ settings }),

  clearHistory: () => {
    set({ history: [] })
    api.clearHistory().catch(console.error)
  }
}))

if (typeof window !== 'undefined' && api) {
  api.onHistoryChanged((history) => useDownloadsStore.setState({ history }))

  api.getHistory().then(async (saved) => {
    useDownloadsStore.setState({ history: saved || [] })
    // One-time move of history kept in browser storage by older versions
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]') as DownloadItem[]
      if (legacy.length) {
        const oldestFirst = [...legacy].sort((a, b) => (a.completedAt || a.addedAt) - (b.completedAt || b.addedAt))
        for (const entry of oldestFirst) await api.addHistory(entry)
        localStorage.removeItem(LEGACY_KEY)
      }
    } catch {
      // ignore unreadable legacy data
    }
  })

  // Downloads started from the menu bar icon
  api.onDownloadAdded((req) => {
    useDownloadsStore.getState().addToQueue({
      id: req.id, url: req.url, title: req.url, platform: detectPlatform(req.url).label,
      status: 'queued', progress: 0, format: req.format, quality: req.quality,
      isAudioOnly: req.isAudioOnly, addedAt: Date.now()
    })
  })

  api.onDownloadProgress(({ id, ...updates }) => {
    useDownloadsStore.getState().updateItem(id, updates)
  })

  api.onDownloadComplete(({ id, ...updates }) => {
    const store = useDownloadsStore.getState()
    store.updateItem(id, { ...updates, status: 'complete', progress: 100, speed: '', eta: '' })
    setTimeout(() => useDownloadsStore.getState().moveToHistory(id), 1200)
  })

  api.onDownloadError(({ id, error, status }) => {
    const store = useDownloadsStore.getState()
    store.updateItem(id, { error, status: status || 'error' })
    setTimeout(() => useDownloadsStore.getState().moveToHistory(id), 1500)
  })
}
