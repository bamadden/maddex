import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import VERIFIED_CONSTANTS, { daysSinceVerified, pendingRbaDecision, rbaDecisionAt } from '../../data/verifiedConstants'
import { useOfficialCheck } from '../../hooks/useOfficialCheck'
import { runOfficialCheck } from '../../services/officialStats'

// DATA HEALTH — the top of Settings → Data Sources: every feed's age, the
// official-statistics check, today's AI content, what is due next, and the
// two actions (check everything now; see which constants need a human).
// Every time shown is read from the cache the service itself wrote.

const FEEDS = [
  ['FX rates', 'maddex_live_fx_rates', 'timestamp', 60],
  ['Crypto', 'maddex_live_crypto_prices', 'timestamp', 30],
  ['Fear & Greed', 'maddex_live_fear_greed', 'timestamp', 24 * 60],
  ['Gold', 'maddex_live_gold_price', 'timestamp', 60],
  ['DeFi TVL', 'maddex_defi_protocols_25', 'at', 120],
  ['BTC mempool', 'maddex_defi_btc_onchain_v2', 'at', 60],
  ['Earthquakes', 'maddex_live_earthquakes_4.5', 'timestamp', 180],
]

const ago = (ms, now) => {
  if (ms == null) return null
  const m = Math.round((now - ms) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') } catch { return null } }
const sydDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

function Row({ ok, label, value }) {
  const tone = ok === true ? '#2D8A50' : ok === false ? '#D9773B' : '#4A6080'
  return (
    <div className="flex items-baseline gap-2 text-2xs py-0.5">
      <span style={{ color: tone }}>{ok === true ? '●' : ok === false ? '▲' : '○'}</span>
      <span className="text-terminal-text flex-1 min-w-0">{label}</span>
      <span className="font-mono text-terminal-text-dim text-right">{value}</span>
    </div>
  )
}

export default function DataHealthPanel() {
  const queryClient = useQueryClient()
  const check = useOfficialCheck()
  const [now, setNow] = useState(() => Date.now())
  const tick = now
  const [busy, setBusy] = useState(false)
  const [showStale, setShowStale] = useState(false)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id) }, [])

  const feeds = useMemo(() => FEEDS.map(([label, key, field, freshMins]) => {
    const at = read(key)?.[field] ?? null
    return { label, at, fresh: at != null && now - at < freshMins * 60_000 * 3 }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tick, busy])
  const news = queryClient.getQueryState(['news'])
  const newsData = queryClient.getQueryData(['news'])

  const ai = useMemo(() => {
    const day = sydDay()
    const keys = (() => { try { return Object.keys(localStorage) } catch { return [] } })()
    const has = (prefix) => keys.some((k) => k.startsWith(prefix) && k.endsWith(day))
    const brief = read(`maddex_morning_brief_${new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })}`)
    const t = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' }) : null)
    return [
      { label: 'Macro themes', ok: has('macro_themes_v2_'), value: has('macro_themes_v2_') ? 'generated today' : 'not yet today' },
      { label: 'Intel ticker & map narrative', ok: has('maddex_ai_content_'), value: has('maddex_ai_content_') ? 'generated today' : 'not yet today' },
      { label: 'Morning brief', ok: !!brief, value: brief ? `${t(brief.generatedAt)}` : 'weekdays from 7am' },
      { label: 'Weekly review', ok: null, value: 'after the Friday close' },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const c = VERIFIED_CONSTANTS
  const nd = pendingRbaDecision(now)
  const ndDays = nd ? Math.ceil((rbaDecisionAt(nd.date, nd.time) - now) / 86_400_000) : null

  const stale = useMemo(() => Object.entries(c)
    .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && v.lastVerified)
    .map(([k, v]) => ({ key: k, label: v.label ?? k, days: daysSinceVerified(k), date: v.lastVerified }))
    .filter((x) => x.days != null && x.days > 30)
    .sort((a, b) => b.days - a.days), [c])

  const checkAll = async () => {
    setBusy(true)
    try {
      const { refreshAllData } = await import('../../services/refreshAll')
      await Promise.allSettled([refreshAllData(queryClient), runOfficialCheck({ force: true })])
    } finally { setBusy(false); setNow(Date.now()) }
  }

  return (
    <div className="border border-terminal-border-gold p-3 space-y-3" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-terminal-gold font-bold tracking-widest">DATA HEALTH</span>
        <button onClick={checkAll} disabled={busy}
          className="ml-auto text-2xs font-bold border border-terminal-gold/50 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg disabled:opacity-50">
          {busy ? 'CHECKING…' : 'CHECK ALL NOW'}</button>
        <button onClick={() => setShowStale((v) => !v)}
          className="text-2xs font-bold border border-terminal-border text-terminal-text-dim px-2 py-0.5 hover:text-terminal-gold">
          UPDATE CONSTANTS{stale.length ? ` (${stale.length})` : ''}</button>
      </div>

      {showStale && (
        <div className="border border-terminal-border p-2 text-2xs">
          <div className="text-terminal-text-dim mb-1">Verified figures are updated by hand in <span className="font-mono">src/data/verifiedConstants.js</span> after each release, then <span className="font-mono">npm run check-stats</span>. Not re-checked in 30+ days:</div>
          {stale.length ? stale.map((s) => <div key={s.key} className="flex justify-between"><span className="text-terminal-text">{s.label}</span><span className="font-mono text-terminal-text-dim">{s.days}d · {fmtDay(s.date)}</span></div>)
            : <div className="text-terminal-green">Everything verified within the last 30 days.</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <div className="font-mono text-terminal-text-dim tracking-widest mb-1" style={{ fontSize: 8 }}>LIVE FEEDS</div>
          {feeds.map((f) => <Row key={f.label} ok={f.at == null ? null : f.fresh} label={f.label} value={f.at ? ago(f.at, now) : 'not loaded yet'} />)}
          <Row ok={news?.status === 'success' ? true : news?.status === 'error' ? false : null} label="News"
            value={news?.dataUpdatedAt ? `${ago(news.dataUpdatedAt, now)} · ${newsData?.articles?.length ?? 0} articles` : 'not loaded yet'} />
        </div>
        <div>
          <div className="font-mono text-terminal-text-dim tracking-widest mb-1" style={{ fontSize: 8 }}>
            OFFICIAL STATS{check?.fetchedAt ? ` · checked ${ago(check.fetchedAt, now)}` : ''}
          </div>
          {(check?.rows ?? []).map((r) => (
            <Row key={`${r.group}.${r.field}`} ok={r.status === 'match' ? true : r.status === 'drift' ? false : null} label={r.label}
              value={r.status === 'match' ? `${Number(r.constant).toFixed(r.dp)}% — matches` : r.status === 'drift' ? `${r.constant} vs official ${r.official}` : 'source unavailable'} />
          ))}
          {!check?.rows?.length && <div className="text-2xs text-terminal-text-dim">Not checked yet this session.</div>}
        </div>
        <div>
          <div className="font-mono text-terminal-text-dim tracking-widest mb-1" style={{ fontSize: 8 }}>AI CONTENT</div>
          {ai.map((a) => <Row key={a.label} ok={a.ok} label={a.label} value={a.value} />)}
        </div>
        <div>
          <div className="font-mono text-terminal-text-dim tracking-widest mb-1" style={{ fontSize: 8 }}>UPCOMING</div>
          <Row ok={null} label="Next AU CPI" value={c.au.cpiNextRelease ? fmtDay(c.au.cpiNextRelease) : '—'} />
          {nd && <Row ok={null} label="Next RBA decision" value={`${fmtDay(nd.date)}${ndDays != null && ndDays >= 0 ? ` (${ndDays} day${ndDays === 1 ? '' : 's'})` : ''}`} />}
          <Row ok={null} label="Next FOMC" value={c.fed.nextMeeting ? fmtDay(c.fed.nextMeeting) : '—'} />
        </div>
      </div>
    </div>
  )
}
