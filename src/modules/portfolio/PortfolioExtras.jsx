import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { rateImpact, RATE_IMPACT_STYLE } from './rateSensitivity'

// Small pieces of the holdings tab: the RATE IMPACT pill, the ⋯ row menu and
// the free-text PORTFOLIO NOTES box.

export function RateImpactPill({ holding }) {
  const { impact, why } = rateImpact(holding)
  if (!impact) return <span className="font-mono" style={{ fontSize: 8, color: '#3A4A61' }} title={why}>—</span>
  const c = RATE_IMPACT_STYLE[impact].colour
  return (
    <span
      className="font-mono whitespace-nowrap"
      title={`${impact} if rates rise — ${why}`}
      style={{ fontSize: 8, letterSpacing: '0.08em', padding: '1px 5px', borderRadius: 2, color: c, background: `${c}1A`, border: `1px solid ${c}55` }}
    >{impact === 'POSITIVE' ? 'POS ▲' : impact === 'NEGATIVE' ? 'NEG ▼' : 'NEUTRAL'}</span>
  )
}

// The ⋯ menu. Portalled with fixed positioning: the table scrolls inside an
// overflow container that would clip an absolutely-placed dropdown on the
// bottom rows.
export function RowMenu({ items }) {
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const menu = useRef(null)

  useEffect(() => {
    if (!pos) return
    const close = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setPos(null) }
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPos(null) } }
    const shut = () => setPos(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    window.addEventListener('resize', shut)
    window.addEventListener('scroll', shut, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc, true)
      window.removeEventListener('resize', shut)
      window.removeEventListener('scroll', shut, true)
    }
  }, [pos])

  const open = (e) => {
    e.stopPropagation()
    if (pos) { setPos(null); return }
    const r = btn.current.getBoundingClientRect()
    const h = items.length * 28 + 8
    const top = r.bottom + h > window.innerHeight - 8 ? r.top - h - 2 : r.bottom + 2
    setPos({ top, left: Math.max(8, r.right - 200) })
  }

  return (
    <>
      <button
        ref={btn}
        onClick={open}
        aria-label="Holding actions"
        aria-expanded={!!pos}
        className={`px-1.5 text-xs leading-none transition-colors ${pos ? 'text-terminal-gold' : 'text-terminal-text-dim/50 hover:text-terminal-gold'}`}
      >⋯</button>
      {pos && createPortal(
        <div
          ref={menu}
          role="menu"
          className="fixed z-[200] bg-terminal-panel border border-terminal-border-gold shadow-xl py-1"
          style={{ top: pos.top, left: pos.left, width: 200 }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => { setPos(null); it.onClick() }}
              className="w-full text-left px-3 font-mono font-bold tracking-wider text-terminal-text hover:bg-terminal-gold/10 hover:text-terminal-gold transition-colors flex items-center gap-2"
              style={{ fontSize: 10, height: 28 }}
            >
              <span aria-hidden="true" className="w-4 text-center">{it.icon}</span>{it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

const NOTES_KEY = 'maddex_portfolio_notes'
const NOTES_MAX = 500

export function PortfolioNotes() {
  const [text, setText] = useState(() => { try { return localStorage.getItem(NOTES_KEY) ?? '' } catch { return '' } })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const save = () => {
    const v = draft.slice(0, NOTES_MAX).trim()
    setText(v)
    try { v ? localStorage.setItem(NOTES_KEY, v) : localStorage.removeItem(NOTES_KEY) } catch { /* private mode */ }
    setEditing(false)
  }
  const edit = () => { setDraft(text); setEditing(true) }

  return (
    <div className="border-t border-terminal-border px-3 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">PORTFOLIO NOTES</span>
        <span className="text-terminal-text-dim/40 font-mono" style={{ fontSize: 8 }}>saved on this device</span>
        {!editing && (
          <button onClick={edit} className="ml-auto text-2xs font-bold border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-2 transition-colors">
            {text ? 'EDIT' : '+ ADD'}
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            autoFocus
            value={draft}
            maxLength={NOTES_MAX}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
            rows={3}
            placeholder={'Your investment thesis, goals, reminders…\ne.g. Long-term wealth building, targeting 5% annual yield, reviewing quarterly'}
            className="w-full bg-terminal-bg border border-terminal-border focus:border-terminal-gold outline-none px-2 py-1.5 text-xs text-terminal-text-bright resize-none leading-relaxed"
          />
          <div className="flex items-center gap-2 mt-1">
            <span className={`font-mono tabular-nums ${draft.length >= NOTES_MAX ? 'text-terminal-red' : 'text-terminal-text-dim/50'}`} style={{ fontSize: 9 }}>
              {draft.length}/{NOTES_MAX}
            </span>
            <span className="text-terminal-text-dim/40 font-mono" style={{ fontSize: 8 }}>⌘↵ to save · Esc to cancel</span>
            <button onClick={() => setEditing(false)} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-text-bright px-2">CANCEL</button>
            <button onClick={save} className="text-2xs font-bold bg-terminal-gold text-terminal-bg px-3 py-0.5 hover:bg-terminal-gold-bright">SAVE</button>
          </div>
        </div>
      ) : text ? (
        <div className="text-xs text-terminal-text leading-relaxed whitespace-pre-wrap">{text}</div>
      ) : (
        <div className="text-2xs text-terminal-text-dim/50 italic leading-relaxed">
          Your investment thesis, goals, reminders… e.g. Long-term wealth building, targeting 5% annual yield, reviewing quarterly.
        </div>
      )}
    </div>
  )
}
