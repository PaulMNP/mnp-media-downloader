import { contextBridge, ipcRenderer } from 'electron'

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
}

export interface AppSettings {
  outputDir: string
  maxConcurrent: number
  defaultQuality: string
  defaultFormat: string
  cookiesBrowser: string
  convertMp4: boolean
}

const api = {
  platform: process.platform,

  fetchInfo: (url: string, playlist = false) => ipcRenderer.invoke('download:fetch-info', url, playlist),

  getYtdlpVersion: () => ipcRenderer.invoke('ytdlp:version'),

  updateYtdlp: () => ipcRenderer.invoke('ytdlp:update'),

  readClipboard: () => ipcRenderer.invoke('clipboard:read'),

  startDownload: (item: DownloadRequest) => ipcRenderer.invoke('download:start', item),

  cancelDownload: (id: string) => ipcRenderer.invoke('download:cancel', id),

  openFile: (path: string) => ipcRenderer.invoke('file:open', path),

  showInFolder: (path: string) => ipcRenderer.invoke('file:show-in-folder', path),

  getSettings: () => ipcRenderer.invoke('settings:get'),

  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:save', settings),

  selectFolder: () => ipcRenderer.invoke('folder:select'),

  getHistory: () => ipcRenderer.invoke('history:get'),

  addHistory: (entry: unknown) => ipcRenderer.invoke('history:add', entry),

  removeHistory: (id: string) => ipcRenderer.invoke('history:remove', id),

  clearHistory: () => ipcRenderer.invoke('history:clear'),

  onHistoryChanged: (cb: (history: unknown[]) => void) => {
    ipcRenderer.on('history:changed', (_event, history) => cb(history))
  },

  onDownloadAdded: (cb: (data: unknown) => void) => {
    ipcRenderer.on('download:added', (_event, data) => cb(data))
  },

  onDownloadProgress: (cb: (data: unknown) => void) => {
    ipcRenderer.on('download:progress', (_event, data) => cb(data))
  },

  onDownloadComplete: (cb: (data: unknown) => void) => {
    ipcRenderer.on('download:complete', (_event, data) => cb(data))
  },

  onDownloadError: (cb: (data: unknown) => void) => {
    ipcRenderer.on('download:error', (_event, data) => cb(data))
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
