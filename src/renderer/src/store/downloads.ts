import { create } from 'zustand'
import { api, type DownloadItem, type AppSettings } from '../types'

const HISTORY_KEY = 'mnp-download-history'
const HISTORY_LIMIT = 300

function loadHistory(): DownloadItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as DownloadItem[]
  } catch {
    return []
  }
}

function saveHistory(history: DownloadItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)))
  } catch {
    // ignore
  }
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
  history: loadHistory(),
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
