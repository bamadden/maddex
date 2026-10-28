import { useEffect, useMemo, useState } from 'react'
import { isKnownTicker } from '../../services/watchlistPrefs'

// Watchlist additions: the hover quick view, the bulk-action bar and the
// import dialog. Kept out of WatchlistModule.jsx, which is already the
// longest module in the terminal.

const money = (v) => (v == null ? '—' : `A$${v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`)
const volFmt = (v) => (v == null ? '—' : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v))

// ─── Quick view ───────────────────────────────────────────────────────────────
//
// Shown after a row has been hovered for two seconds, beside the pointer
// rather than over the row. Every figure is the row's own (the same batch
// quote the table shows); nothing is fetched for it.
export function HoverPreview({ row, sector, x, y, onAnalyse, onAlert, onChart, onEnter, onLeave }) {
  const left = Math.min(x + 18, window.innerWidth - 296)
  const top = Math.min(Math.max(8, y - 20), window.innerHeight - 230)
  const up = (row.pct ?? 0) >= 0
  const pos = row.week52Low != null && row.week52High != null && row.week52High > row.week52Low && row.price != null
    ? Math.min(100, Math.max(0, ((row.price - row.week52Low) / (row.week52High - row.week52Low)) * 100)) : null
  const exch = row.type === 'asx' ? 'ASX' : row.type === 'crypto' ? 'CRYPTO' : 'US'
  return (
    <div
      onMouseEnter={onEnter} onMouseLeave={onLeave}
      className="fixed z-50 font-mono bg-terminal-panel border border-terminal-border-gold shadow-2xl panel-fade"
      style={{ left, top, width: 280, padding: '10px 12px' }}
      role="tooltip"
    >
      <div className="text-terminal-text-bright font-bold truncate" style={{ fontSize: 11 }}>{String(row.name).toUpperCase()}</div>
      <div className="text-terminal-text-dim mt-0.5" style={{ fontSize: 9 }}>{exch}: {row.symbol}{sector ? ` · ${sector}` : ''}</div>
      <div className="mt-2.5 flex items-baseline gap-2" style={{ fontSize: 11 }}>
        <span className="text-terminal-text-dim" style={{ fontSize: 9 }}>Last</span>
        <span className="text-terminal-text-bright font-bold tabular-nums">{money(row.price)}</span>
        {row.pct != null && (
          <span className="tabular-nums" style={{ color: up ? '#2D8A50' : '#A83232', fontSize: 10 }}>
            {up ? '▲' : '▼'} {row.change != null ? `${up ? '+' : '−'}${Math.abs(row.change).toFixed(2)} ` : ''}({up ? '+' : ''}{row.pct.toFixed(2)}%)
          </span>
        )}
      </div>
      {pos != null && (
        <div className="mt-2" style={{ fontSize: 9 }}>
          <div className="flex items-center gap-2">
            <span className="text-terminal-text-dim w-6">52W</span>
            <span className="tabular-nums text-terminal-text-dim">{money(row.week52Low)}</span>
            <span className="relative flex-1 h-1 rounded-full" style={{ background: 'rgba(100,130,160,0.25)' }}>
              <span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-terminal-gold" style={{ left: `calc(${pos}% - 4px)` }} />
            </span>
            <span className="tabular-nums text-terminal-text-dim">{money(row.week52High)}</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2" style={{ fontSize: 9 }}>
        <span className="text-terminal-text-dim">P/E <span className="text-terminal-text-bright tabular-nums">{row.pe != null ? `${row.pe.toFixed(1)}x` : '—'}</span></span>
        <span className="text-terminal-text-dim">Yield <span className="text-terminal-gold tabular-nums">{row.divYield != null ? `${row.divYield.toFixed(1)}%` : '—'}</span></span>
        <span className="text-terminal-text-dim col-span-2">Vol <span className="text-terminal-text-bright tabular-nums">{volFmt(row.volume)}</span>{row.volRatio != null && <span className="tabular-nums"> ({row.volRatio.toFixed(1)}× avg)</span>}</span>
      </div>
      <div className="flex gap-1.5 mt-2.5">
        {[['ANALYSE', onAnalyse], ['ALERT', onAlert], ['CHART', onChart]].map(([l, fn]) => (
          <button key={l} onClick={fn} className="flex-1 font-bold tracking-wider border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors py-1" style={{ fontSize: 9 }}>{l}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Bulk actions ─────────────────────────────────────────────────────────────
export function BulkBar({ count, total, groups, onSelectAll, onClear, onGroup, onAlert, onRemove }) {
  const [pct, setPct] = useState('5')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { if (!confirm) return undefined; const t = setTimeout(() => setConfirm(false), 4000); return () => clearTimeout(t) }, [confirm])
  const btn = 'text-2xs font-bold tracking-wider px-2 py-0.5 border transition-colors'
  return (
    <div className="flex items-center gap-2 flex-wrap flex-shrink-0 font-mono px-4 py-1.5 border-b border-terminal-gold/30" style={{ background: 'rgba(201,168,76,0.08)' }}>
      <span className="text-2xs font-bold text-terminal-gold tracking-widest">{count} SELECTED</span>
      <button onClick={count === total ? onClear : onSelectAll} className={`${btn} border-terminal-border text-terminal-text-dim hover:text-terminal-gold`}>
        {count === total ? 'DESELECT ALL' : 'SELECT ALL'}
      </button>
      <span className="text-terminal-text-dim/30">|</span>
      <select
        value=""
        onChange={(e) => { if (e.target.value) onGroup(e.target.value === '__none' ? null : e.target.value) }}
        className="bg-terminal-surface border border-terminal-border text-terminal-text-bright text-2xs px-1 py-0.5"
        aria-label="Add selected to group"
      >
        <option value="">+ ADD TO GROUP</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        <option value="__none">— Ungrouped</option>
      </select>
      <span className="flex items-center gap-1 text-2xs text-terminal-text-dim">
        ⚡ alert if any moves ±
        <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ''))} className="w-10 bg-terminal-bg border border-terminal-border text-terminal-text-bright text-2xs px-1 py-0.5 text-right" aria-label="Alert move percent" />%
        <button onClick={() => Number(pct) > 0 && onAlert(Number(pct))} className={`${btn} border-terminal-gold/50 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg`}>SET ALERT</button>
      </span>
      <button
        onClick={() => (confirm ? (onRemove(), setConfirm(false)) : setConfirm(true))}
        className={`${btn} ml-auto ${confirm ? 'border-terminal-red text-terminal-red' : 'border-terminal-border text-terminal-text-dim hover:text-terminal-red'}`}
      >{confirm ? `CLICK AGAIN TO REMOVE ${count}` : '✕ REMOVE'}</button>
      <button onClick={onClear} className="text-terminal-text-dim/60 hover:text-terminal-text-bright text-xs" aria-label="Clear selection">✕</button>
    </div>
  )
}

// ─── Import ───────────────────────────────────────────────────────────────────
//
// Accepts a pasted list ("BHP.AX, CBA.AX CSL"), a CSV with a Symbol column, or
// Maddex's own watchlist export. Each symbol is checked against the quote
// service before anything is added, so a typo is reported rather than added.
function parseImport(text) {
  const lines = String(text ?? '').trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase())
  const col = header.findIndex((h) => h === 'symbol' || h === 'ticker' || h === 'code')
  const raw = col >= 0
    ? lines.slice(1).map((l) => l.split(',')[col]?.replace(/"/g, '').trim())
    : lines.join(' ').split(/[\s,;|\t]+/)
  return [...new Set(raw.filter(Boolean).map((s) => s.toUpperCase().replace(/[^A-Z0-9.^-]/g, '')).filter((s) => /^[A-Z0-9^][A-Z0-9.-]{0,11}$/.test(s)))]
}

export function ImportModal({ watchlist, limit, onImport, onClose }) {
  const [text, setText] = useState('')
  const [checks, setChecks] = useState(null) // [{ symbol, status: 'tracked'|'new'|'missing' }]
  const [busy, setBusy] = useState(false)
  const symbols = useMemo(() => parseImport(text), [text])

  const preview = async () => {
    setBusy(true)
    const out = []
    for (const s of symbols.slice(0, 60)) {
      if (watchlist.includes(s)) { out.push({ symbol: s, status: 'tracked' }); continue }
      const ok = await isKnownTicker(s)
      out.push({ symbol: s, status: ok ? 'new' : 'missing' })
    }
    setChecks(out)
    setBusy(false)
  }
  const fresh = (checks ?? []).filter((c) => c.status === 'new').map((c) => c.symbol)
  const room = Math.max(0, limit - watchlist.length)
  const toAdd = fresh.slice(0, room)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-terminal-panel border border-terminal-border-gold w-[460px] max-w-[92vw] font-mono" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Import watchlist">
        <div className="px-4 py-2.5 border-b border-terminal-border flex items-center">
          <span className="text-2xs font-bold tracking-widest text-terminal-gold">IMPORT TO WATCHLIST</span>
          <button onClick={onClose} className="ml-auto text-terminal-text-dim hover:text-terminal-text-bright" aria-label="Close">✕</button>
        </div>
        <div className="p-4 space-y-3">
          {!checks ? (
            <>
              <div className="text-2xs text-terminal-text-dim leading-relaxed">
                Paste tickers (<span className="text-terminal-text-bright">BHP.AX, CBA.AX, CSL.AX</span>), a CSV with a Symbol column, or a Maddex watchlist export.
              </div>
              <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={7}
                className="w-full bg-terminal-bg border border-terminal-border px-2 py-1.5 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold resize-none"
                placeholder={'BHP.AX, CBA.AX, CSL.AX\n— or —\nSymbol,Name\nBHP.AX,BHP Group'} />
              <div className="flex items-center gap-2">
                <span className="text-2xs text-terminal-text-dim">{symbols.length} symbol{symbols.length === 1 ? '' : 's'} found</span>
                <button onClick={preview} disabled={!symbols.length || busy} className="ml-auto btn-primary btn-sm disabled:opacity-40">{busy ? 'CHECKING…' : 'CHECK & PREVIEW'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-2xs text-terminal-text-bright">Importing {checks.length} stock{checks.length === 1 ? '' : 's'}:</div>
              <div className="max-h-56 overflow-y-auto border border-terminal-border/60">
                {checks.map((c) => (
                  <div key={c.symbol} className="flex items-center gap-2 px-2 py-1 text-2xs border-b border-terminal-border/30 last:border-b-0">
                    <span className="font-bold text-terminal-text-bright w-20">{c.symbol}</span>
                    {c.status === 'new' && <span className="text-terminal-green">✓ will be added</span>}
                    {c.status === 'tracked' && <span className="text-terminal-text-dim">✓ already tracked</span>}
                    {c.status === 'missing' && <span className="text-terminal-red">✗ not found</span>}
                  </div>
                ))}
              </div>
              {fresh.length > room && (
                <div className="text-2xs text-terminal-gold">Your plan&apos;s watchlist has room for {room} more — the first {room} will be added.</div>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => setChecks(null)} className="btn-secondary btn-sm">BACK</button>
                <button onClick={onClose} className="btn-secondary btn-sm">CANCEL</button>
                <button onClick={() => onImport(toAdd)} disabled={!toAdd.length} className="ml-auto btn-primary btn-sm disabled:opacity-40">IMPORT {toAdd.length} NEW</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
