import { app } from 'electron'
import { join } from 'path'

export interface AppSettings {
  outputDir: string
  maxConcurrent: number
  defaultQuality: string
  defaultFormat: string
  cookiesBrowser: string
  convertMp4: boolean
}

const defaultSettings: AppSettings = {
  outputDir: join(app.getPath('home'), 'Downloads'),
  maxConcurrent: 3,
  defaultQuality: 'best',
  defaultFormat: 'mp4',
  cookiesBrowser: 'none',
  convertMp4: true
}

type Store = InstanceType<typeof import('electron-store').default<AppSettings>>
let storeInstance: Store | null = null

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    const { default: Store } = await import('electron-store')
    storeInstance = new Store<AppSettings>({
      defaults: defaultSettings
    })
  }
  return storeInstance
}

export async function getSettings(): Promise<AppSettings> {
  const store = await getStore()
  return {
    outputDir: store.get('outputDir', defaultSettings.outputDir) as string,
    maxConcurrent: store.get('maxConcurrent', defaultSettings.maxConcurrent) as number,
    defaultQuality: store.get('defaultQuality', defaultSettings.defaultQuality) as string,
    defaultFormat: store.get('defaultFormat', defaultSettings.defaultFormat) as string,
    cookiesBrowser: store.get('cookiesBrowser', defaultSettings.cookiesBrowser) as string,
    convertMp4: store.get('convertMp4', defaultSettings.convertMp4) as boolean
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const store = await getStore()
  if (settings.outputDir !== undefined) store.set('outputDir', settings.outputDir)
  if (settings.maxConcurrent !== undefined) store.set('maxConcurrent', settings.maxConcurrent)
  if (settings.defaultQuality !== undefined) store.set('defaultQuality', settings.defaultQuality)
  if (settings.defaultFormat !== undefined) store.set('defaultFormat', settings.defaultFormat)
  if (settings.cookiesBrowser !== undefined) store.set('cookiesBrowser', settings.cookiesBrowser)
  if (settings.convertMp4 !== undefined) store.set('convertMp4', settings.convertMp4)
}
