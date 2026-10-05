import { useEffect, useRef, useState } from 'react'
import { useOfficialCheck } from '../../hooks/useOfficialCheck'
import { SOURCE_URL } from '../../services/officialStats'

// "● LIVE CHECK" beside a figure that is reconciled against its agency.
// Green when the official data matches, amber on drift, grey when the check
// could not reach the source. Click for the source, period and check time.
//
// A span with role=button rather than a <button>: it sits inside clickable
// cards, and a button inside a button is invalid HTML.
export default function LiveCheckBadge({ field, className = '' }) {
  const check = useOfficialCheck()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const row = check?.rows?.find((r) => r.field === field)
  if (!row) return null
  const tone = row.status === 'match' ? '#2D8A50' : row.status === 'drift' ? '#C9A84C' : '#637899'
  const label = row.status === 'match' ? '● LIVE CHECK' : row.status === 'drift' ? '⚠ DRIFT' : '○ UNCHECKED'
  const dp = row.dp ?? 1
  const toggle = (e) => { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v) }

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <span
        role="button" tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
        className="font-mono font-bold tracking-wider cursor-pointer whitespace-nowrap"
        style={{ fontSize: 7, color: tone, border: `1px solid ${tone}66`, padding: '0 3px', borderRadius: 2 }}
        title="Checked against the official source — click for details"
      >{label}</span>
      {open && (
        <span
          className="absolute left-0 top-full mt-1 z-[95] w-64 text-left font-mono p-2.5 shadow-2xl normal-case tracking-normal"
          style={{ background: 'rgba(7,20,40,0.98)', border: `1px solid ${tone}66`, fontSize: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block font-bold" style={{ color: tone }}>
            {row.status === 'match' ? 'Matches the official figure' : row.status === 'drift' ? 'Official figure has changed' : 'Source unreachable at last check'}
          </span>
          <span className="block text-terminal-text mt-1">
            Terminal {Number(row.constant).toFixed(dp)}% · official {row.official != null ? `${Number(row.official).toFixed(dp)}%` : '—'}
          </span>
          {row.period && <span className="block text-terminal-text-dim">{row.period}</span>}
          <span className="block text-terminal-text-dim mt-1">{row.source}</span>
          <span className="block text-terminal-text-dim/70">Checked {new Date(check.fetchedAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          {SOURCE_URL[field] && (
            <a href={SOURCE_URL[field]} target="_blank" rel="noopener noreferrer" className="block mt-1.5 text-terminal-gold hover:underline">View at source ↗</a>
          )}
        </span>
      )}
    </span>
  )
}
