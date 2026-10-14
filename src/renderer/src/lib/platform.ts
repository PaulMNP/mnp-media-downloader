export interface Platform {
  label: string
  color: string
  // Sound pages (TikTok /music/, Instagram /reels/audio/) can't be downloaded
  // directly; the user needs a video that uses the sound instead.
  soundPage?: boolean
  playlistHint?: boolean
}

const RULES: [RegExp, Platform][] = [
  [/instagram\.com\/reels?\/audio\//, { label: 'Instagram sound', color: '#e1306c', soundPage: true }],
  [/instagram\.com/, { label: 'Instagram', color: '#e1306c' }],
  [/tiktok\.com\/music\//, { label: 'TikTok sound', color: '#25f4ee', soundPage: true }],
  [/tiktok\.com/, { label: 'TikTok', color: '#25f4ee' }],
  [/youtube\.com\/playlist/, { label: 'YouTube playlist', color: '#ff3d3d', playlistHint: true }],
  [/(youtube\.com|youtu\.be).*[?&]list=/, { label: 'YouTube', color: '#ff3d3d', playlistHint: true }],
  [/youtube\.com|youtu\.be/, { label: 'YouTube', color: '#ff3d3d' }],
  [/(^|\/\/|\.)(twitter|x)\.com/, { label: 'X', color: '#d6d6d6' }],
  [/facebook\.com|fb\.watch/, { label: 'Facebook', color: '#4c8dff' }],
  [/soundcloud\.com/, { label: 'SoundCloud', color: '#ff7a1a' }],
  [/vimeo\.com/, { label: 'Vimeo', color: '#3fc0ff' }],
  [/reddit\.com|redd\.it/, { label: 'Reddit', color: '#ff5a1f' }],
  [/twitch\.tv/, { label: 'Twitch', color: '#a970ff' }]
]

export function detectPlatform(url: string): Platform {
  for (const [re, p] of RULES) if (re.test(url)) return p
  try {
    return { label: new URL(url).hostname.replace(/^www\./, ''), color: '#948d82' }
  } catch {
    return { label: 'Link', color: '#948d82' }
  }
}

export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+\.\S+/.test(text.trim())
}

export function formatDuration(sec?: number): string {
  if (!sec) return ''
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString()
}
