import { useEffect, useRef, useState } from 'react'
import { fmt } from '../../utils/format'
import { GROUP_COLOURS } from '../../services/watchlistMeta'

// ─── Pieces of a watchlist row that are not price cells ─────────────────────
//
// Quick actions, the ⋯ menu, the price-target editor and the group bar. Kept
// out of WatchlistModule so that file stays about the table.

const ACTION_BTN = 'w-5 h-5 flex items-center justify-center text-[11px] rounded-sm transition-colors'

// Quick actions, shown on row hover. The ✕ asks once: the first click turns it
// into REMOVE?, a second within three seconds removes. One stray click on a
// dense table should not cost someone a ticker and its note and target.
export function RowActions({
  row, hasNote, groups, groupId,
  onDetail, onAlert, onAddToPortfolio, onRemove, onNote, onTarget, onMoveGroup,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const menuRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])
  useEffect(() => () => clearTimeout(timer.current), [])

  const remove = () => {
    if (confirm) { clearTimeout(timer.current); setConfirm(false); onRemove(); return }
    setConfirm(true)
    timer.current = setTimeout(() => setConfirm(false), 3000)
  }
  const isCrypto = row.type === 'crypto'

  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <div className={`flex items-center gap-0.5 transition-opacity ${menuOpen || confirm ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button onClick={onDetail} disabled={row.price == null} title="Open detail" className={`${ACTION_BTN} text-terminal-text-dim hover:text-terminal-gold hover:bg-terminal-gold/10 disabled:opacity-30`}>📊</button>
        <button onClick={onAlert} title="Set a price alert" className={`${ACTION_BTN} text-terminal-text-dim hover:text-terminal-gold hover:bg-terminal-gold/10`}>⚡</button>
        <button onClick={onAddToPortfolio} title="Add to portfolio" className={`${ACTION_BTN} text-terminal-text-dim hover:text-terminal-gold hover:bg-terminal-gold/10 font-bold`}>+</button>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} title="More"
            className={`${ACTION_BTN} ${menuOpen ? 'text-terminal-gold bg-terminal-gold/10' : 'text-terminal-text-dim hover:text-terminal-gold hover:bg-terminal-gold/10'}`}>⋯</button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-terminal-panel border border-terminal-border-gold shadow-2xl text-left" style={{ zIndex: 130, minWidth: 190 }}>
              <button onClick={() => { setMenuOpen(false); onTarget() }} disabled={isCrypto}
                className="w-full px-3 py-1.5 text-2xs text-left hover:bg-terminal-surface2 disabled:opacity-40">◎ Set price target</button>
              <button onClick={() => { setMenuOpen(false); onNote() }}
                className="w-full px-3 py-1.5 text-2xs text-left hover:bg-terminal-surface2">✎ {hasNote ? 'Edit note' : 'Add note'}</button>
              {!isCrypto && (
                <>
                  <div className="px-3 pt-1.5 pb-0.5 text-[9px] font-mono tracking-widest text-terminal-text-dim border-t border-terminal-border">MOVE TO GROUP</div>
                  {groups.map((g) => (
                    <button key={g.id} onClick={() => { setMenuOpen(false); onMoveGroup(g.id) }} disabled={g.id === groupId}
                      className="w-full px-3 py-1 text-2xs text-left hover:bg-terminal-surface2 flex items-center gap-2 disabled:opacity-40">
                      <span className="w-2 h-2 rounded-sm" style={{ background: GROUP_COLOURS[g.colour] ?? GROUP_COLOURS.gold }} />{g.name}
                    </button>
                  ))}
                  <button onClick={() => { setMenuOpen(false); onMoveGroup(null) }} disabled={!groupId}
                    className="w-full px-3 py-1 text-2xs text-left hover:bg-terminal-surface2 text-terminal-text-dim disabled:opacity-40">No group</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <button onClick={remove} title={confirm ? 'Click again to remove' : 'Remove from watchlist'}
        className={confirm
          ? 'text-[9px] font-bold px-1 py-0.5 border border-terminal-red/60 text-terminal-red'
          : `${ACTION_BTN} text-terminal-text-dim hover:text-terminal-red`}>
        {confirm ? 'REMOVE?' : '✕'}
      </button>
    </div>
  )
}

// Inline editor, rendered as a full-width row under its stock, like the note
// and alert editors.
export function TargetRow({ symbol, label, price, current, onSave, onClear, onClose, colSpan }) {
  const [value, setValue] = useState(() => (current?.price ? current.price.toFixed(2) : ''))
  const n = Number(value)
  const valid = Number.isFinite(n) && n > 0
  const save = () => { if (valid) onSave(n) }
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-2 bg-terminal-header/40 border-b border-terminal-border/40">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xs font-bold text-terminal-gold tracking-widest">PRICE TARGET · {label}</span>
          <span className="text-2xs text-terminal-text-dim">now {price != null ? fmt.aud(price) : '—'}</span>
          <label className="flex items-center gap-1 text-2xs text-terminal-text-dim">
            My target: A$
            <input autoFocus type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
              aria-label={`Price target for ${symbol}`}
              className="bg-terminal-bg border border-terminal-border text-terminal-text-bright text-2xs px-2 py-1 w-24 tabular-nums focus:border-terminal-gold focus:outline-none" />
          </label>
          {valid && price != null && (
            <span className="text-2xs text-terminal-text-dim">
              {n >= price ? 'upside' : 'downside'} target, {Math.abs(((n - price) / price) * 100).toFixed(1)}% from here
            </span>
          )}
          <button onClick={save} disabled={!valid} className="btn-primary btn-sm disabled:opacity-40">SAVE</button>
          <button onClick={onClose} className="btn-secondary btn-sm">CANCEL</button>
          {current && <button onClick={onClear} className="text-2xs px-2 py-0.5 border border-terminal-red/40 text-terminal-red hover:bg-terminal-red hover:text-terminal-bg transition-colors">CLEAR</button>}
        </div>
        <div className="text-[9px] text-terminal-text-dim/50 mt-1">
          Saved to this browser. A target above today&apos;s price is hit when the price reaches it; one below is hit when the price falls to it.
        </div>
      </td>
    </tr>
  )
}

// Group chips: counts, drop targets, and creating or deleting a group.
export function GroupBar({ groups, counts, ungroupedCount, dragging, onDropTo, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [colour, setColour] = useState('gold')
  const [over, setOver] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const create = () => {
    const n = name.trim()
    if (!n) return
    onCreate(n, colour)
    setName(''); setAdding(false)
  }
  const drop = (id) => ({
    onDragOver: (e) => { e.preventDefault(); if (over !== id) setOver(id) },
    onDragLeave: () => setOver(null),
    onDrop: (e) => { e.preventDefault(); setOver(null); onDropTo(id) },
  })

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-1.5 border-b border-terminal-border flex-shrink-0" style={{ background: '#040B16' }}>
      <span className="text-[9px] font-mono tracking-widest text-terminal-text-dim mr-1">GROUPS</span>
      {groups.map((g) => {
        const c = GROUP_COLOURS[g.colour] ?? GROUP_COLOURS.gold
        return (
          <span key={g.id} {...drop(g.id)}
            className="inline-flex items-center gap-1.5 text-2xs px-2 py-0.5 border transition-colors"
            style={{ borderColor: over === g.id ? c : `${c}55`, background: over === g.id ? `${c}30` : dragging ? `${c}14` : 'transparent', color: c }}>
            <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
            {g.name}
            <span className="text-terminal-text-dim tabular-nums">{counts[g.id] ?? 0}</span>
            {confirmDel === g.id ? (
              <button onClick={() => { onDelete(g.id); setConfirmDel(null) }} className="text-terminal-red font-bold text-[9px]" title="Stocks in it become ungrouped">DELETE?</button>
            ) : (
              <button onClick={() => setConfirmDel(g.id)} className="text-terminal-text-dim/50 hover:text-terminal-red" title="Delete group">×</button>
            )}
          </span>
        )
      })}
      <span {...drop(null)}
        className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 border border-dashed transition-colors"
        style={{ borderColor: over === null && dragging ? '#8BA3C4' : 'rgba(139,163,196,0.3)', color: '#8BA3C4' }}>
        UNGROUPED <span className="tabular-nums text-terminal-text-dim">{ungroupedCount}</span>
      </span>
      {adding ? (
        <span className="inline-flex items-center gap-1.5">
          <input autoFocus value={name} maxLength={24} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Group name" className="bg-terminal-bg border border-terminal-border text-2xs px-1.5 py-0.5 w-32 focus:border-terminal-gold focus:outline-none" />
          {Object.entries(GROUP_COLOURS).map(([k, c]) => (
            <button key={k} onClick={() => setColour(k)} title={k} aria-label={`Colour ${k}`}
              className="w-3.5 h-3.5 rounded-sm" style={{ background: c, outline: colour === k ? '2px solid #E6EDF6' : 'none', outlineOffset: 1 }} />
          ))}
          <button onClick={create} disabled={!name.trim()} className="text-2xs font-bold text-terminal-gold disabled:opacity-40">ADD</button>
          <button onClick={() => setAdding(false)} className="text-2xs text-terminal-text-dim">✕</button>
        </span>
      ) : (
        <button onClick={() => setAdding(true)} className="text-2xs text-terminal-text-dim hover:text-terminal-gold">+ NEW GROUP</button>
      )}
      <span className="ml-auto text-[9px] text-terminal-text-dim/40">Drag a row onto a group, or onto a row in another group</span>
    </div>
  )
}
