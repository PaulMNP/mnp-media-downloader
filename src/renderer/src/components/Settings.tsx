import React, { useEffect, useState } from 'react'
import { useDownloadsStore } from '../store/downloads'
import { api, type AppSettings } from '../types'
import { Segmented, Spinner } from './ui'

function Row({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-line last:border-0">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {hint && <p className="text-xs text-muted mt-0.5 max-w-[46ch] leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">{children}</div>
    </div>
  )
}

const selectCls = 'h-8 px-2.5 rounded-lg bg-bg border border-line hover:border-line-strong'

export default function Settings() {
  const { settings, setSettings } = useDownloadsStore()
  const [version, setVersion] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')

  useEffect(() => {
    api.getYtdlpVersion().then(setVersion).catch(() => setVersion('not found'))
  }, [])

  if (!settings) return <div className="py-16 flex justify-center"><Spinner size={20} /></div>

  // Settings save as soon as they change
  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    api.saveSettings(patch)
  }

  const runUpdate = async () => {
    setUpdating(true)
    setUpdateMsg('')
    try {
      setUpdateMsg(await api.updateYtdlp())
      setVersion(await api.getYtdlpVersion())
    } catch (e) {
      setUpdateMsg(String((e as Error).message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl bg-surface border border-line px-5">
      <Row title="Save downloads to" hint={<span className="mono select-text">{settings.outputDir}</span>}>
        <button onClick={() => api.showInFolder(settings.outputDir)} className="text-xs text-muted hover:text-ink px-2">Open</button>
        <button
          onClick={async () => { const p = await api.selectFolder(); if (p) update({ outputDir: p }) }}
          className="h-8 px-3 rounded-lg bg-surface-2 border border-line hover:border-line-strong"
        >
          Change…
        </button>
      </Row>

      <Row title="Default format">
        <Segmented
          size="sm"
          value={settings.defaultFormat}
          onChange={(v) => update({ defaultFormat: v })}
          options={[{ value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }, { value: 'mp3', label: 'MP3' }, { value: 'm4a', label: 'M4A' }]}
        />
      </Row>

      <Row title="Default video quality" hint="If a video isn't available at this quality, the closest lower one is used.">
        <Segmented
          size="sm"
          value={settings.defaultQuality}
          onChange={(v) => update({ defaultQuality: v })}
          options={[{ value: 'best', label: 'Best' }, { value: '1080p', label: '1080p' }, { value: '720p', label: '720p' }, { value: '480p', label: '480p' }]}
        />
      </Row>

      <Row title="Downloads at once">
        <Segmented
          size="sm"
          value={String(settings.maxConcurrent)}
          onChange={(v) => update({ maxConcurrent: Number(v) })}
          options={['1', '2', '3', '5'].map((n) => ({ value: n, label: n }))}
        />
      </Row>

      <Row
        title="Use browser login"
        hint="Needed for private, age-restricted or login-only posts, and helps when Instagram, Facebook, TikTok or Vimeo block downloads. Uses the cookies of a browser where you're logged in. macOS may ask for your password the first time."
      >
        <select value={settings.cookiesBrowser} onChange={(e) => update({ cookiesBrowser: e.target.value })} className={selectCls}>
          <option value="none">Off</option>
          <option value="chrome">Chrome</option>
          <option value="safari">Safari</option>
          <option value="firefox">Firefox</option>
          <option value="brave">Brave</option>
          <option value="edge">Edge</option>
          <option value="arc">Arc</option>
        </select>
      </Row>

      <Row
        title="Make MP4s play everywhere"
        hint="Some sites (like Instagram) send VP9 video, which QuickTime, Photos and iPhone can't play. This converts it to H.264 after downloading."
      >
        <input
          type="checkbox"
          checked={settings.convertMp4}
          onChange={(e) => update({ convertMp4: e.target.checked })}
          className="w-4 h-4 accent-[var(--accent)]"
        />
      </Row>

      <Row
        title="Download engine"
        hint={
          <>
            <span className="mono">yt-dlp {version || '…'}</span>. Sites change often. If downloads from a site suddenly stop working, update first.
            {updateMsg && <span className="block mt-1 text-ink select-text">{updateMsg}</span>}
          </>
        }
      >
        <button
          onClick={runUpdate}
          disabled={updating}
          className="h-8 px-3 rounded-lg bg-surface-2 border border-line hover:border-line-strong disabled:opacity-50 flex items-center gap-2"
        >
          {updating && <Spinner size={12} />}
          {updating ? 'Updating…' : 'Check for updates'}
        </button>
      </Row>
    </div>
  )
}
