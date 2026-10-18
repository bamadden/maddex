import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ALERT_TYPES, ALERTS_CHANGED, loadAlerts, createAlert, deleteAlert, updateAlert, clearTriggered,
  loadAlertHistory, clearAlertHistory, proximity, proximityTone, distancePct, get52WeekRange, avgVolume20,
} from '../../services/alertsService'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS, MOCK_CRYPTO, getMockFMPRow } from '../../services/mockData'
import { fetchEquityQuotes } from '../../services/dataService'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { useStore } from '../../store/useStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'

// ─── Alert centre ────────────────────────────────────────────────────────────
//
// Every alert in one place, grouped by ticker, from BOTH stores: the simple
// price alerts the watchlist, detail view and command bar create
// (useStore 'madden_alerts'), and the alert engine's richer types
// (alertsService). Each row says how close it is to firing, and can be
// edited, paused or deleted. Opened from the bell (ALERT CENTRE) and from
// Settings → Alerts.
//
// Proximity is a ratio where 100% = at the trigger: price ÷ target for an
// "above" level, target ÷ price for "below", today's move ÷ threshold for a %
// move, volume ÷ (multiplier × 20-day average) for volume. News, events and
// RSI have no meaningful distance, so they show none rather than a made-up one.

const ALL_SYMBOLS = [
  ...Object.keys(MOCK_ASX_STOCKS),
  ...Object.keys(MOCK_US_STOCKS),
  ...MOCK_CRYPTO.map((c) => c.symbol.toUpperCase()),
]

const ICON = { PRICE: '⚡', SESSION_MOVE: '±', VOLUME_SPIKE: '▮', RANGE_52W: '⤒', NEWS_MENTION: '≡', RSI_EXTREME: '∿', ECONOMIC_EVENT: '◈', PORTFOLIO_PNL: '◆' }
const TONE = {
  far:   { bar: '#4A6080', text: '#637899' },
  close: { bar: '#C9A84C', text: '#C9A84C' },
  near:  { bar: '#F59E0B', text: '#F59E0B' },
  fired: { bar: '#22C55E', text: '#22C55E' },
  none:  { bar: 'transparent', text: '#637899' },
}
const TYPE_NAME = {
  PRICE_ABOVE: 'Price above', PRICE_BELOW: 'Price below', PRICE: 'Price', SESSION_MOVE: '% move', VOLUME_SPIKE: 'Volume',
  RANGE_52W: '52-week', NEWS_MENTION: 'News', RSI_EXTREME: 'RSI', ECONOMIC_EVENT: 'Event', PORTFOLIO_PNL: 'Portfolio P&L',
}

const money = (v) => (v == null ? '—' : `A$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
const quoteKey = (sym) => toYahooSymbol(sym, detectAssetType(sym))

// One shape for both stores.
function normalise(simple, engine) {
  return [
    ...simple.map((a) => ({
      id: `s:${a.id}`, rawId: a.id, store: 'simple', type: 'PRICE', symbol: a.sym,
      condition: a.direction ?? 'above', value: a.price, paused: !!a.paused, triggered: false,
    })),
    ...engine.map((a) => ({
      id: `e:${a.id}`, rawId: a.id, store: 'engine', type: a.type, symbol: a.symbol,
      condition: a.condition, value: a.value, paused: !!a.paused, triggered: !!a.triggered, triggeredAt: a.triggeredAt,
    })),
  ]
}

function describe(a) {
  switch (a.type) {
    case 'PRICE':          return `${a.condition === 'below' ? 'Below' : 'Above'} ${money(a.value)}`
    case 'SESSION_MOVE':   return `${a.condition === 'up' ? 'Up' : a.condition === 'down' ? 'Down' : 'Moves'} ${a.condition === 'up' || a.condition === 'down' ? 'by ' : '±'}${a.value}% in a day`
    case 'VOLUME_SPIKE':   return `Volume > ${a.value}× 20-day average`
    case 'RANGE_52W':      return `Hits a 52-week ${a.condition === 'low' ? 'low' : 'high'}`
    case 'NEWS_MENTION':   return 'In the news'
    case 'RSI_EXTREME':    return `RSI ${a.condition ?? 'above'} ${a.value}`
    case 'ECONOMIC_EVENT': return `${a.value || 1}h before AU/US events`
    case 'PORTFOLIO_PNL':  return `Portfolio down ${a.value}%`
    default:               return a.type
  }
}

function editLabel(a) {
  if (a.type === 'PRICE') return `${a.condition === 'below' ? 'Below' : 'Above'} A$`
  return { SESSION_MOVE: 'Move %', VOLUME_SPIKE: 'Volume ×', RSI_EXTREME: `RSI ${a.condition ?? 'above'}`, ECONOMIC_EVENT: 'Hours before', PORTFOLIO_PNL: 'Down %' }[a.type] ?? 'Level'
}

function historyLevel(h) {
  if (typeof h.level !== 'number') return h.level ?? '—'
  if (h.type.startsWith('PRICE')) return money(h.level)
  return { VOLUME_SPIKE: `${h.level}×`, SESSION_MOVE: `±${h.level}%`, PORTFOLIO_PNL: `−${h.level}%`, ECONOMIC_EVENT: `${h.level}h`, RSI_EXTREME: `RSI ${h.level}` }[h.type] ?? String(h.level)
}

// { pct, note } — pct is the proximity ratio, note the plain-words distance.
function measure(a, price) {
  if (!a.symbol) return { pct: null, note: null }
  if (a.type === 'PRICE') {
    const pct = proximity(a.condition, a.value, price)
    const d = distancePct(a.value, price)
    return { pct, note: d == null ? null : pct >= 100 ? 'at target' : `${Math.abs(d).toFixed(1)}% away` }
  }
  if (a.type === 'RANGE_52W') {
    const r = get52WeekRange(a.symbol)
    const target = a.condition === 'low' ? r.low : r.high
    const pct = proximity(a.condition === 'low' ? 'below' : 'above', target, price)
    const d = distancePct(target, price)
    return { pct, note: target == null || d == null ? null : `${a.condition === 'low' ? 'low' : 'high'} ${money(target)} · ${Math.abs(d).toFixed(1)}% away` }
  }
  if (a.type === 'SESSION_MOVE' && a.value > 0) {
    const chg = getMockFMPRow(a.symbol)?.regularMarketChangePercent
    if (chg == null) return { pct: null, note: null }
    const signed = a.condition === 'up' ? chg : a.condition === 'down' ? -chg : Math.abs(chg)
    return { pct: Math.max(0, (signed / a.value) * 100), note: `today ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%` }
  }
  if (a.type === 'VOLUME_SPIKE' && a.value > 0) {
    const vol = getMockFMPRow(a.symbol)?.regularMarketVolume
    const avg = avgVolume20(a.symbol)
    if (!vol || !avg) return { pct: null, note: null }
    return { pct: (vol / avg / a.value) * 100, note: `today ${(vol / avg).toFixed(1)}× avg` }
  }
  return { pct: null, note: null }
}

function ProximityBar({ pct, fired }) {
  const tone = TONE[fired ? 'fired' : proximityTone(pct)]
  if (pct == null && !fired) return <span className="w-16 flex-shrink-0" />
  return (
    <span className="w-16 flex-shrink-0 flex items-center gap-1" title={pct == null ? 'Fired' : `${pct.toFixed(0)}% of the way to firing`}>
      <span className="relative h-1.5 flex-1 bg-terminal-border/50 overflow-hidden">
        <span className={`absolute inset-y-0 left-0 ${proximityTone(pct) === 'near' && !fired ? 'animate-pulse' : ''}`}
          style={{ width: `${fired ? 100 : Math.min(100, pct)}%`, background: tone.bar }} />
      </span>
      {(fired || pct >= 100) && <span style={{ color: TONE.fired.text, fontSize: 10 }}>✓</span>}
    </span>
  )
}

function Toggle({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} title={on ? 'Active — click to pause' : 'Paused — click to resume'}
      onClick={onChange}
      className={`relative w-6 h-3 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-terminal-gold/80' : 'bg-terminal-border'}`}>
      <span className="absolute top-0.5 w-2 h-2 rounded-full bg-terminal-bg transition-all" style={{ left: on ? 14 : 2 }} />
    </button>
  )
}

function AlertRow({ a, price, onDelete, onToggle, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(a.value ?? ''))
  const { pct, note } = measure(a, price)
  const fired = a.triggered
  const tone = TONE[fired ? 'fired' : proximityTone(pct)]
  const editable = a.value != null && a.type !== 'NEWS_MENTION'

  const save = () => {
    const v = Number(draft)
    if (draft === '' || !Number.isFinite(v) || v <= 0) return
    onEdit(v)
    setEditing(false)
  }

  return (
    <div className={`flex items-center gap-2 py-1 ${a.paused ? 'opacity-50' : ''}`}>
      <span className="w-4 text-center flex-shrink-0 text-2xs" style={{ color: fired ? TONE.fired.text : '#C9A84C' }} aria-hidden="true">
        {a.type === 'RANGE_52W' && a.condition === 'low' ? '⤓' : ICON[a.type] ?? '⚑'}
      </span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); save() }} className="flex items-center gap-1">
            <span className="text-2xs text-terminal-text-dim">{editLabel(a)}</span>
            <input autoFocus type="number" step="any" value={draft} onChange={(e) => setDraft(e.target.value)}
              aria-label="New alert level"
              className="w-20 bg-terminal-bg border border-terminal-gold/60 text-2xs text-terminal-text-bright px-1 py-0.5" />
            <button type="submit" className="text-2xs text-terminal-gold font-bold">SAVE</button>
            <button type="button" onClick={() => { setEditing(false); setDraft(String(a.value ?? '')) }} className="text-2xs text-terminal-text-dim">CANCEL</button>
          </form>
        ) : (
          <div className="text-2xs text-terminal-text truncate">
            {describe(a)}
            {fired && <span className="ml-1.5" style={{ color: TONE.fired.text }}>· fired {a.triggeredAt ? fmtDate(a.triggeredAt) : ''}</span>}
            {a.paused && <span className="ml-1.5 text-terminal-text-dim">· paused</span>}
          </div>
        )}
      </div>
      {!editing && note && <span className="text-2xs tabular-nums flex-shrink-0" style={{ color: tone.text }}>{note}</span>}
      <ProximityBar pct={pct} fired={fired} />
      <Toggle on={!a.paused} onChange={onToggle} label={`${a.paused ? 'Resume' : 'Pause'} alert`} />
      {editable && !editing && (
        <button onClick={() => setEditing(true)} className="text-2xs text-terminal-text-dim hover:text-terminal-gold flex-shrink-0">EDIT</button>
      )}
      {!editable && <span className="w-[26px] flex-shrink-0" />}
      <button onClick={onDelete} title="Delete alert" aria-label="Delete alert" className="text-2xs text-terminal-text-dim/60 hover:text-terminal-red flex-shrink-0">✕</button>
    </div>
  )
}

// The add form. Price alerts go to the simple store (checked against the
// same quote path as the watchlist, with email); everything else to the engine.
function AddAlertForm({ watchlist, addAlert, onDone }) {
  const [type, setType] = useState('PRICE')
  const [symbol, setSymbol] = useState(watchlist[0] ?? '')
  const [condition, setCondition] = useState('above')
  const [value, setValue] = useState('')
  const meta = ALERT_TYPES.find((t) => t.key === type)

  const CONDITIONS = {
    PRICE: [['above', 'Above'], ['below', 'Below']],
    SESSION_MOVE: [['either', 'Either way by'], ['up', 'Up by'], ['down', 'Down by']],
    RANGE_52W: [['high', '52-week high'], ['low', '52-week low']],
    RSI_EXTREME: [['above', 'Above'], ['below', 'Below']],
  }[type]

  const pickType = (t) => {
    setType(t)
    setCondition({ SESSION_MOVE: 'either', RANGE_52W: 'high' }[t] ?? 'above')
    setValue(t === 'VOLUME_SPIKE' ? '2' : '')
  }

  const submit = (e) => {
    e.preventDefault()
    const sym = symbol.trim().toUpperCase()
    if (meta.needsSymbol === true && !sym) return
    if (!meta.noValue && type !== 'NEWS_MENTION' && (value === '' || !(Number(value) > 0))) return
    const ok = type === 'PRICE'
      ? addAlert(sym, Number(value), condition)
      : createAlert({ type, symbol: sym || null, condition: CONDITIONS ? condition : null, value: meta.noValue || type === 'NEWS_MENTION' ? null : value })
    if (ok) onDone()
  }

  const input = 'bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2 py-1 focus:border-terminal-gold/60 outline-none'
  return (
    <form onSubmit={submit} className="border border-terminal-gold/30 bg-terminal-gold/[0.03] p-3 space-y-2">
      <div className="flex flex-wrap gap-1">
        {ALERT_TYPES.map((t) => (
          <button type="button" key={t.key} onClick={() => pickType(t.key)} aria-pressed={type === t.key}
            className={`text-2xs px-2 py-0.5 border transition-colors ${type === t.key ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10' : 'border-terminal-border text-terminal-text-dim hover:text-terminal-text'}`}
          >{t.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {meta.needsSymbol !== false && (
          <label className="flex flex-col gap-1">
            <span className="text-2xs text-terminal-text-dim">Stock{meta.needsSymbol === 'optional' ? ' (blank = whole watchlist)' : ''}</span>
            <input list="alert-centre-symbols" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BHP.AX" className={`${input} w-28`} />
            <datalist id="alert-centre-symbols">
              {[...new Set([...watchlist, ...ALL_SYMBOLS])].map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>
        )}
        {CONDITIONS && (
          <label className="flex flex-col gap-1">
            <span className="text-2xs text-terminal-text-dim">When</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className={input}>
              {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        {type === 'VOLUME_SPIKE' ? (
          <label className="flex flex-col gap-1">
            <span className="text-2xs text-terminal-text-dim">Multiplier</span>
            <div className="flex gap-1">
              {['2', '3', '5'].map((m) => (
                <button type="button" key={m} onClick={() => setValue(m)} aria-pressed={value === m}
                  className={`text-2xs px-2 py-1 border ${value === m ? 'border-terminal-gold text-terminal-gold' : 'border-terminal-border text-terminal-text-dim'}`}>{m}×</button>
              ))}
            </div>
          </label>
        ) : !meta.noValue && type !== 'NEWS_MENTION' && (
          <label className="flex flex-col gap-1">
            <span className="text-2xs text-terminal-text-dim">
              {type === 'PRICE' ? 'Price (A$)' : type === 'SESSION_MOVE' || type === 'PORTFOLIO_PNL' ? 'Percent' : type === 'ECONOMIC_EVENT' ? 'Hours before' : 'Level'}
            </span>
            <input type="number" step="any" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'SESSION_MOVE' ? '3' : '0'} className={`${input} w-24`} />
          </label>
        )}
        <button type="submit" className="text-2xs font-bold tracking-widest px-3 py-1.5 bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors">SET ALERT</button>
        <button type="button" onClick={onDone} className="text-2xs text-terminal-text-dim hover:text-terminal-text px-1 py-1.5">CANCEL</button>
      </div>
      {type === 'SESSION_MOVE' && <div className="text-2xs text-terminal-text-dim/70">Fires once a day at most, and resets at midnight.</div>}
      {type === 'NEWS_MENTION' && <div className="text-2xs text-terminal-text-dim/70">Matches the ticker or company name as a whole word in news headlines.</div>}
    </form>
  )
}

export default function AlertsModule({ onClose }) {
  const { alerts: simpleAlerts, addAlert, removeAlert, updateAlert: updateSimple, watchlist } = useStore()
  const [engineAlerts, setEngineAlerts] = useState(() => loadAlerts())
  const [history, setHistory] = useState(() => loadAlertHistory())
  const [adding, setAdding] = useState(false)
  useEscapeKey(onClose)

  useEffect(() => {
    const refresh = () => { setEngineAlerts(loadAlerts()); setHistory(loadAlertHistory()) }
    window.addEventListener(ALERTS_CHANGED, refresh)
    return () => window.removeEventListener(ALERTS_CHANGED, refresh)
  }, [])

  const all = useMemo(() => normalise(simpleAlerts, engineAlerts), [simpleAlerts, engineAlerts])
  const symbols = useMemo(() => [...new Set(all.filter((a) => a.symbol).map((a) => quoteKey(a.symbol)))], [all])
  const { data: quoteResult } = useQuery({
    queryKey: ['alertCentreQuotes', symbols],
    queryFn: () => fetchEquityQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const quotes = quoteResult?.data

  const groups = useMemo(() => {
    const g = new Map()
    for (const a of all) {
      const k = a.symbol ?? 'GENERAL'
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(a)
    }
    return [...g.entries()].sort(([x], [y]) => (x === 'GENERAL') - (y === 'GENERAL') || x.localeCompare(y))
  }, [all])

  const triggeredCount = all.filter((a) => a.triggered).length

  const del = (a) => (a.store === 'simple' ? removeAlert(a.rawId) : deleteAlert(a.rawId))
  const toggle = (a) => (a.store === 'simple' ? updateSimple(a.rawId, { paused: !a.paused }) : updateAlert(a.rawId, { paused: !a.paused }))
  const edit = (a, v) => (a.store === 'simple' ? updateSimple(a.rawId, { price: v }) : updateAlert(a.rawId, { value: v, triggered: false, lastFiredDate: null }))

  return (
    <div className="modal-backdrop fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Alert centre"
        className="bg-terminal-panel border border-terminal-border w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">ALERT CENTRE</span>
          <span className="text-2xs text-terminal-text-dim">{all.length} alert{all.length === 1 ? '' : 's'}</span>
          <div className="flex-1" />
          {triggeredCount > 0 && (
            <button onClick={() => clearTriggered()} className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border px-2 py-1">
              CLEAR ALL TRIGGERED ({triggeredCount})
            </button>
          )}
          <button onClick={() => setAdding((v) => !v)} aria-expanded={adding}
            className="text-2xs font-bold tracking-widest text-terminal-gold border border-terminal-gold px-2 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">+ ADD ALERT</button>
          <button onClick={onClose} aria-label="Close" className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none ml-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {adding && <AddAlertForm watchlist={watchlist} addAlert={addAlert} onDone={() => setAdding(false)} />}

          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <span className="w-11 h-11 rounded-full border border-terminal-gold/40 text-terminal-gold flex items-center justify-center" style={{ fontSize: 18 }} aria-hidden="true">⚡</span>
              <div className="text-xs text-terminal-text-bright font-semibold mt-1">No alerts yet</div>
              <div className="text-2xs text-terminal-text-dim">Price levels, daily % moves, volume spikes, 52-week highs and news mentions.</div>
              {!adding && (
                <button onClick={() => setAdding(true)} className="mt-2 px-3 py-1.5 text-[10px] font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors">+ ADD ALERT</button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(([sym, list]) => {
                const price = sym === 'GENERAL' ? null : quotes?.[quoteKey(sym)]?.last
                return (
                  <section key={sym} className="border border-terminal-border/60">
                    <header className="flex items-baseline gap-2 px-3 py-1.5 border-b border-terminal-border/40 bg-terminal-bg/40">
                      <span className="text-xs font-bold text-terminal-text-bright">{sym === 'GENERAL' ? 'WATCHLIST & MARKET' : sym}</span>
                      <span className="text-2xs text-terminal-text-dim">({list.length} alert{list.length === 1 ? '' : 's'})</span>
                      <span className="flex-1" />
                      {sym !== 'GENERAL' && <span className="text-2xs text-terminal-text-dim tabular-nums">{price != null ? money(price) : '—'}</span>}
                    </header>
                    <div className="px-3 py-1">
                      {list.map((a) => (
                        <AlertRow key={a.id} a={a} price={price}
                          onDelete={() => del(a)} onToggle={() => toggle(a)} onEdit={(v) => edit(a, v)} />
                      ))}
                    </div>
                  </section>
                )
              })}
              <div className="flex items-center gap-3 text-2xs text-terminal-text-dim/70">
                <span>Proximity:</span>
                {[['far', 'far'], ['close', 'getting close'], ['near', 'very close'], ['fired', 'fired']].map(([k, l]) => (
                  <span key={k} className="flex items-center gap-1"><span className="w-2 h-1.5 inline-block" style={{ background: TONE[k].bar }} />{l}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center mb-1.5">
              <span className="text-2xs text-terminal-text-dim font-bold tracking-widest">RECENTLY TRIGGERED</span>
              <span className="flex-1" />
              {history.length > 0 && <button onClick={clearAlertHistory} className="text-2xs text-terminal-text-dim/60 hover:text-terminal-red">CLEAR</button>}
            </div>
            {history.length === 0 ? (
              <div className="text-2xs text-terminal-text-dim/60 py-3">Nothing has fired yet. The last 20 triggered alerts are kept here.</div>
            ) : (
              <table className="w-full text-2xs">
                <thead>
                  <tr className="border-b border-terminal-border text-terminal-text-dim text-left">
                    <th className="py-1 font-normal">Date</th>
                    <th className="py-1 font-normal">Stock</th>
                    <th className="py-1 font-normal">Type</th>
                    <th className="py-1 font-normal text-right">Level</th>
                    <th className="py-1 font-normal text-right">Price when triggered</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={`${h.at}-${i}`} className="border-b border-terminal-border/30">
                      <td className="py-1 text-terminal-text-dim tabular-nums">{new Date(h.at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-1 text-terminal-text-bright">{h.symbol ?? '—'}</td>
                      <td className="py-1 text-terminal-text">{TYPE_NAME[h.type] ?? h.type}</td>
                      <td className="py-1 text-right tabular-nums text-terminal-text">
                        {historyLevel(h)}
                      </td>
                      <td className="py-1 text-right tabular-nums text-terminal-text">{h.price != null ? money(h.price) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
