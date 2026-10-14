import React from 'react'

export function Segmented<T extends string>({
  value, options, onChange, size = 'md'
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-bg border border-line">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5'} ${
              on ? 'bg-surface-2 text-ink shadow-[0_1px_0_var(--line-strong)_inset]' : 'text-muted hover:text-ink'
            } disabled:opacity-30 disabled:hover:text-muted`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Thumb({ src, platformColor, audio, size = 56 }: { src?: string; platformColor: string; audio?: boolean; size?: number }) {
  const [failed, setFailed] = React.useState(false)
  const style = { width: size * 1.6, height: size }
  if (src && !failed) {
    return (
      <img
        src={src}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="rounded-md object-cover flex-shrink-0 bg-surface-2"
        style={style}
        draggable={false}
      />
    )
  }
  return (
    <div className="rounded-md flex-shrink-0 flex items-center justify-center bg-surface-2" style={style}>
      {audio ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={platformColor} strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={platformColor} strokeWidth="2" strokeLinejoin="round"><rect x="2" y="5" width="15" height="14" rx="2" /><path d="M17 10l5-3v10l-5-3z" /></svg>
      )}
    </div>
  )
}

export function PlatformTag({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="inline-block rounded-full border-2 border-line-strong border-t-accent spin" style={{ width: size, height: size }} />
}

export function IconButton({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`w-7 h-7 rounded-md flex items-center justify-center text-muted transition-colors hover:bg-surface-2 ${danger ? 'hover:text-danger' : 'hover:text-ink'}`}
    >
      {children}
    </button>
  )
}
