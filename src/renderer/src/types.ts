export type MediaFormat = 'mp4' | 'webm' | 'mp3' | 'm4a'
export type DownloadStatus = 'queued' | 'downloading' | 'complete' | 'error' | 'cancelled'

export interface DownloadItem {
  id: string
  url: string
  title: string
  platform: string
  thumbnail?: string
  status: DownloadStatus
  progress: number
  speed?: string
  eta?: string
  outputPath?: string
  format: MediaFormat
  quality: string
  isAudioOnly: boolean
  playlist?: boolean
  clipStart?: string
  clipEnd?: string
  playlistIndex?: number
  playlistCount?: number
  currentItem?: string
  filesDone?: number
  addedAt: number
  completedAt?: number
  error?: string
}

export interface DownloadRequest {
  id: string
  url: string
  format: MediaFormat
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
  embedSubs: boolean
  notify: boolean
  autoUpdate: boolean
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

export interface ElectronAPI {
  fetchInfo: (url: string, playlist?: boolean) => Promise<MediaInfo>
  getYtdlpVersion: () => Promise<string>
  updateYtdlp: () => Promise<string>
  readClipboard: () => Promise<string>
  startDownload: (item: DownloadRequest) => Promise<{ id: string }>
  cancelDownload: (id: string) => Promise<{ success: boolean }>
  openFile: (path: string) => Promise<string>
  showInFolder: (path: string) => Promise<{ success: boolean }>
  getSettings: () => Promise<AppSettings>
  saveSettings: (s: Partial<AppSettings>) => Promise<{ success: boolean }>
  selectFolder: () => Promise<string | null>
  getHistory: () => Promise<DownloadItem[]>
  saveHistory: (h: DownloadItem[]) => Promise<void>
  onDownloadAdded: (cb: (data: DownloadRequest) => void) => void
  onDownloadProgress: (cb: (data: any) => void) => void
  onDownloadComplete: (cb: (data: any) => void) => void
  onDownloadError: (cb: (data: any) => void) => void
}

export const api = (window as unknown as { electronAPI: ElectronAPI }).electronAPI
