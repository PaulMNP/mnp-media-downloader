import { create } from 'zustand'
import { api, type DownloadItem, type AppSettings } from '../types'
import { detectPlatform } from '../lib/platform'

const HISTORY_LIMIT = 500
const LEGACY_KEY = 'mnp-download-history'

// History lives in the app's settings file (main process), not browser storage
function saveHistory(history: DownloadItem[]) {
  api.saveHistory(history.slice(0, HISTORY_LIMIT)).catch(console.error)
}

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

  moveToHistory: (id) => {
    const item = get().queue.find((i) => i.id === id)
    if (!item) return
    set((state) => {
      const history = [{ ...item, completedAt: Date.now() }, ...state.history.filter((h) => h.id !== id)]
      saveHistory(history)
      return { queue: state.queue.filter((i) => i.id !== id), history }
    })
  },

  removeFromHistory: (id) =>
    set((state) => {
      const history = state.history.filter((h) => h.id !== id)
      saveHistory(history)
      return { history }
    }),

  setSettings: (settings) => set({ settings }),

  clearHistory: () => {
    saveHistory([])
    set({ history: [] })
  }
}))

if (typeof window !== 'undefined' && api) {
  api.getHistory().then((saved) => {
    let history = saved || []
    // One-time move of history kept in browser storage by older versions
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]') as DownloadItem[]
      if (legacy.length) {
        const ids = new Set(history.map((h) => h.id))
        history = [...history, ...legacy.filter((h) => !ids.has(h.id))].sort((a, b) => (b.completedAt || b.addedAt) - (a.completedAt || a.addedAt))
        saveHistory(history)
        localStorage.removeItem(LEGACY_KEY)
      }
    } catch {
      // ignore unreadable legacy data
    }
    useDownloadsStore.setState({ history })
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
