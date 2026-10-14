import { app } from 'electron'
import { join } from 'path'

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

const defaultSettings: AppSettings = {
  outputDir: join(app.getPath('home'), 'Downloads'),
  maxConcurrent: 3,
  defaultQuality: 'best',
  defaultFormat: 'mp4',
  cookiesBrowser: 'none',
  convertMp4: true,
  embedSubs: false,
  notify: true,
  autoUpdate: true
}

const KEYS = Object.keys(defaultSettings) as (keyof AppSettings)[]

type StoreShape = AppSettings & { lastYtdlpUpdate: number; history: unknown[] }
type Store = InstanceType<typeof import('electron-store').default<StoreShape>>
let storeInstance: Store | null = null

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    const { default: Store } = await import('electron-store')
    storeInstance = new Store<StoreShape>({
      defaults: { ...defaultSettings, lastYtdlpUpdate: 0, history: [] }
    })
  }
  return storeInstance
}

export async function getSettings(): Promise<AppSettings> {
  const store = await getStore()
  return Object.fromEntries(KEYS.map((k) => [k, store.get(k, defaultSettings[k])])) as unknown as AppSettings
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const store = await getStore()
  for (const k of KEYS) {
    if (settings[k] !== undefined) store.set(k, settings[k] as never)
  }
}

export async function getValue<K extends 'lastYtdlpUpdate' | 'history'>(key: K): Promise<StoreShape[K]> {
  return (await getStore()).get(key)
}

export async function setValue<K extends 'lastYtdlpUpdate' | 'history'>(key: K, value: StoreShape[K]): Promise<void> {
  ;(await getStore()).set(key, value)
}

// History is only ever changed here, one entry at a time, reading the file
// fresh each time. The window never overwrites the whole list, so a window
// that hasn't loaded history yet can't wipe it.
const HISTORY_LIMIT = 500
type Entry = { id: string }

export async function addHistory(entry: Entry): Promise<unknown[]> {
  const history = ((await getValue('history')) as Entry[]).filter((h) => h.id !== entry.id)
  const next = [entry, ...history].slice(0, HISTORY_LIMIT)
  await setValue('history', next)
  return next
}

export async function removeHistory(id: string): Promise<unknown[]> {
  const next = ((await getValue('history')) as Entry[]).filter((h) => h.id !== id)
  await setValue('history', next)
  return next
}

export async function clearHistory(): Promise<unknown[]> {
  await setValue('history', [])
  return []
}
