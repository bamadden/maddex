import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aiContentService } from '../../services/aiContentService'
import { fetchLiveTickerItems, quakeItem } from '../../services/intelTickerLive'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { GEO_RISK_INDEX, riskBand, RISK_LAST_REVIEWED } from '../../data/geopoliticalRisk'
import { INTEL_FILTERS, keepItem } from './intelFilter'

// ─── Global module: left intelligence panel pieces ─────────────────────────
//
// The ticker, the filter bar and three compact sections. GlobalModule lays
// them out; this file holds what each one shows and where its numbers come
// from. Live items refresh every five minutes; dated figures say their date.

const MONO = '"IBM Plex Mono", monospace'
// "30 Jun", "29 Sep" — three-letter months by hand: en-AU's short month is
// "June" and "Sept", which reads unevenly in a tight column.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDay = (iso) => { const [, m, d] = String(iso).split('-'); return m ? `${Number(d)} ${MON[Number(m) - 1]}` : '—' }

// ─── Filter ─────────────────────────────────────────────────────────────────

export function IntelFilterBar({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 px-3 flex-shrink-0 border-b border-terminal-border" style={{ height: 28, background: '#030912' }}>
      {INTEL_FILTERS.map((f) => (
        <button key={f} onClick={() => onChange(f)}
          className="transition-colors"
          style={{
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em', padding: '2px 6px', borderRadius: 2,
            border: `1px solid ${value === f ? '#C9A84C' : 'rgba(201,168,76,0.15)'}`,
            background: value === f ? 'rgba(201,168,76,0.15)' : 'transparent',
            color: value === f ? '#C9A84C' : '#637899',
          }}
        >{f}</button>
      ))}
    </div>
  )
}

// ─── Ticker ─────────────────────────────────────────────────────────────────
//
// Live items (FX, crypto, sentiment, DeFi, the next event, the RBA rate, the
// latest M5+ quake) interleaved with the day's AI lines, each prefixed with
// its category. Duplicated content translated by exactly −50% keeps the loop
// seamless; it pauses on hover.

const TAG_COLOUR = { FX: '#4A7FB5', CRYPTO: '#D69E2E', DEFI: '#9A7AB5', MACRO: '#C9A84C', EVENT: '#C9A84C', SEISMIC: '#CC6A44', AI: '#637899' }

export function IntelTicker({ earthquakes, filter }) {
  const [aiLines, setAiLines] = useState(null)
  const [regenerating, setRegenerating] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    aiContentService.getIntelTicker().then(({ data }) => {
      if (alive && Array.isArray(data) && data.length) setAiLines(data)
    }).catch(() => { /* live items still show */ })
    return () => { alive = false }
  }, [])
  // The quake's "3H AGO" moves on with the live refresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: live } = useQuery({
    queryKey: ['intelTickerLive'],
    queryFn: () => fetchLiveTickerItems(),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })

  const items = useMemo(() => {
    const liveItems = [...(live ?? [])]
    const q = quakeItem(earthquakes, now)
    if (q) liveItems.push(q)
    const ai = (aiLines ?? []).map((text) => ({ tag: 'AI', text: String(text), live: false }))
    // Interleave: one live item after every AI line, then whatever is left.
    const out = []
    for (let i = 0; i < Math.max(liveItems.length, ai.length); i++) {
      if (liveItems[i]) out.push(liveItems[i])
      if (ai[i]) out.push(ai[i])
    }
    return out.filter((it) => keepItem(filter, it))
  }, [live, aiLines, earthquakes, now, filter])

  const regenerate = async () => {
    setRegenerating(true)
    aiContentService.clearKey('intel_ticker')
    try {
      const { data } = await aiContentService.getIntelTicker()
      if (Array.isArray(data) && data.length) setAiLines(data)
    } catch { /* keep the existing strip */ } finally { setRegenerating(false) }
  }

  if (!items.length) return null
  const run = [...items, ...items]

  return (
    <div className="intel-ticker flex-shrink-0 overflow-hidden relative group"
      style={{ height: 40, background: '#020609', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <button onClick={regenerate} disabled={regenerating}
        title="Regenerate the AI lines — clears today's cached generation. Live items refresh every 5 minutes on their own."
        aria-label="Regenerate intelligence ticker"
        className="absolute right-0 top-0 h-full z-10 flex items-center pr-2 pl-6 opacity-30 hover:opacity-100 transition-opacity disabled:opacity-40"
        style={{ background: 'linear-gradient(to right, transparent, #020609 45%)', color: '#C9A84C', fontSize: 11, lineHeight: 1, border: 'none' }}>
        <span className={regenerating ? 'animate-spin inline-block' : 'inline-block'}>↻</span>
      </button>
      <div className="intel-ticker-track flex items-center h-full whitespace-nowrap">
        {run.map((it, i) => (
          <span key={i} className="flex-shrink-0 flex items-center gap-1.5" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', paddingLeft: 14, paddingRight: 14 }}>
            <span style={{ color: TAG_COLOUR[it.tag] ?? '#637899', fontWeight: 700 }}>[{it.tag === 'AI' ? 'AI' : it.tag}]</span>
            <span style={{ color: it.tag === 'AI' ? '#8BA3C4' : it.dir === 'up' ? '#5FBF7F' : it.dir === 'down' ? '#D46A6A' : '#C9A84C' }}>{it.text}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Market hours, compact ──────────────────────────────────────────────────
//
// Exchange hours in each exchange's own time zone, through the browser's
// time-zone database (so daylight saving moves with the calendar). Public
// holidays are not modelled; the four are the sessions an Australian investor
// trades around.
const HOURS = [
  { code: 'ASX',  tz: 'Australia/Sydney', open: 600, close: 960, lon: 151.21, lat: -33.87 },
  { code: 'TSE',  tz: 'Asia/Tokyo',       open: 540, close: 930, lon: 139.77, lat: 35.68 },
  { code: 'LSE',  tz: 'Europe/London',    open: 480, close: 990, lon: -0.09,  lat: 51.51 },
  { code: 'NYSE', tz: 'America/New_York', open: 570, close: 960, lon: -74.01, lat: 40.71 },
]
const DAY_IDX = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }

function sessionOf(ex, now) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: ex.tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(now))
  const get = (t) => parts.find((p) => p.type === t)?.value
  const dow = DAY_IDX[get('weekday')]
  const mins = (Number(get('hour')) % 24) * 60 + Number(get('minute'))
  const weekday = dow >= 1 && dow <= 5
  if (weekday && mins >= ex.open && mins < ex.close) return { open: true, gap: ex.close - mins }
  // Minutes to the next weekday open.
  let gap = (weekday && mins < ex.open) ? ex.open - mins : 24 * 60 - mins + ex.open
  let d = (weekday && mins < ex.open) ? dow : (dow + 1) % 7
  while (d === 0 || d === 6) { gap += 24 * 60; d = (d + 1) % 7 }
  return { open: false, gap }
}
const fmtGap = (m) => (m >= 24 * 60 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`)

export function MarketHoursCompact({ onFocus }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col gap-0.5">
      {HOURS.map((ex) => {
        const s = sessionOf(ex, now)
        return (
          <button key={ex.code} onClick={() => onFocus?.({ longitude: ex.lon, latitude: ex.lat, zoom: 4 })}
            title={`Fly the map to ${ex.code}`}
            className="flex items-center gap-1.5 text-left hover:bg-terminal-accent/10 rounded-sm px-1 -mx-1 py-0.5 transition-colors min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.open ? 'bg-terminal-green animate-pulse' : ''}`} style={s.open ? undefined : { background: '#4A6080' }} />
            <span className="text-2xs font-bold text-terminal-text-bright w-9 flex-shrink-0">{ex.code}</span>
            <span className="text-[9px] font-bold w-12 flex-shrink-0" style={{ color: s.open ? '#2D8A50' : '#637899' }}>{s.open ? 'OPEN' : 'CLOSED'}</span>
            <span className="text-[9px] text-terminal-text-dim truncate">
              {s.open ? `closes in ${fmtGap(s.gap)}` : `opens in ${fmtGap(s.gap)}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Commodity intelligence ─────────────────────────────────────────────────
//
// The commodities that drive Australian earnings, each with its ASX exposure
// and the region that produces it. Gold is live (PAXG, with a real 24h move).
// The rest are dated settlements from verifiedConstants with the change since
// the previous dated level (30 Jun) — not a daily move, which this build has
// no feed for. The Futures module anchors its commodity rows to the same
// constants, so the two agree.

const C = VERIFIED_CONSTANTS.commodities
const changeSince = (now, prev) => (now != null && prev ? ((now - prev) / prev) * 100 : null)

const COMMODITIES = [
  { key: 'iron', name: 'IRON ORE', spec: '62% Fe, SGX', price: `US$${C.ironOreUSD.toFixed(2)}/t`, asOf: C.asOfBy?.ironOreUSD,
    chg: changeSince(C.ironOreUSD, C.previous?.ironOreUSD), exposure: 'BHP, RIO, FMG — Australia\'s largest export',
    region: { name: 'Pilbara, WA', longitude: 118.6, latitude: -22.3 } },
  { key: 'coal', name: 'THERMAL COAL', spec: 'Newcastle', price: `US$${C.thermalCoalUSD.toFixed(2)}/t`, asOf: C.asOfBy?.thermalCoalUSD,
    chg: changeSince(C.thermalCoalUSD, C.previous?.thermalCoalUSD), exposure: 'Whitehaven (WHC), New Hope (NHC)',
    region: { name: 'Hunter Valley, NSW', longitude: 150.9, latitude: -32.4 } },
  { key: 'lng', name: 'LNG', spec: 'JKM spot', price: `US$${C.lngUSDPerMMBtu.toFixed(2)}/MMBtu`, asOf: C.asOfBy?.lngUSDPerMMBtu,
    chg: changeSince(C.lngUSDPerMMBtu, C.previous?.lngUSDPerMMBtu), exposure: 'Woodside (WDS), Santos (STO)',
    region: { name: 'North West Shelf, WA', longitude: 116.7, latitude: -20.6 } },
  { key: 'gold', name: 'GOLD', spec: 'PAXG proxy, live', live: true, exposure: 'Newmont (NEM), Northern Star (NST), Evolution (EVN)',
    region: { name: 'Kalgoorlie, WA', longitude: 121.47, latitude: -30.75 } },
  { key: 'copper', name: 'COPPER', spec: 'LME 3-month', price: `US$${C.copperUSDPerLb.toFixed(2)}/lb`, asOf: C.asOfBy?.copperUSDPerLb,
    chg: changeSince(C.copperUSDPerLb, C.previous?.copperUSDPerLb), exposure: 'BHP (Olympic Dam), Sandfire (SFR)',
    region: { name: 'Olympic Dam, SA', longitude: 136.88, latitude: -30.44 } },
  { key: 'lithium', name: 'LITHIUM', spec: 'carbonate, GFEX', price: `CNY${C.lithiumCNYPerTonne.toLocaleString('en-AU')}/t`, asOf: C.asOfBy?.lithiumCNYPerTonne,
    chg: null, exposure: 'PLS, Mineral Resources (MIN), IGO',
    region: { name: 'Greenbushes, WA', longitude: 116.06, latitude: -33.86 } },
]

export function CommodityIntel({ gold, onFocus }) {
  return (
    <div className="flex flex-col gap-1.5">
      {COMMODITIES.map((c) => {
        const price = c.live ? (gold ? `US$${gold.USD.toLocaleString()}/oz` : '—') : c.price
        const chg = c.live ? gold?.change24h ?? null : c.chg
        const chgLabel = c.live ? '24h' : c.chg != null ? `since ${fmtDay(C.previous.asOf)}` : null
        return (
          <button key={c.key} onClick={() => onFocus?.({ ...c.region, zoom: 5 })}
            title={`${c.exposure}\nClick to fly the map to ${c.region.name}`}
            className="w-full text-left hover:bg-terminal-accent/10 rounded-sm px-1 -mx-1 py-0.5 transition-colors">
            <div className="flex items-baseline gap-2">
              <span className="text-2xs font-bold text-terminal-text-bright flex-shrink-0">{c.name}</span>
              <span className="text-[8px] text-terminal-text-dim/60 truncate flex-1 min-w-0">{c.spec}</span>
              <span className="text-2xs text-terminal-text-bright tabular-nums flex-shrink-0">{price}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-[9px] text-terminal-text-dim truncate flex-1 min-w-0">{c.exposure}</span>
              {chg != null ? (
                <span className="text-[9px] tabular-nums flex-shrink-0" style={{ color: chg >= 0 ? '#2D8A50' : '#CC4444' }}>
                  {chg >= 0 ? '▲' : '▼'}{Math.abs(chg).toFixed(1)}% <span className="text-terminal-text-dim/50">{chgLabel}</span>
                </span>
              ) : !c.live && c.asOf ? (
                <span className="text-[9px] text-terminal-text-dim/50 flex-shrink-0">as at {fmtDay(c.asOf)}</span>
              ) : null}
            </div>
          </button>
        )
      })}
      <div className="text-[8px] text-terminal-text-dim/50 leading-snug">
        Dated exchange settlements ({fmtDay(C.asOfBy?.lithiumCNYPerTonne ?? C.asOf)}–{fmtDay(C.asOf)}), not a live feed; change is since the
        previous verified level. Gold is live via PAXG. Click a row to fly to where it is produced.
      </div>
    </div>
  )
}

// ─── Geopolitical risk cards ────────────────────────────────────────────────
//
// The five regions with the highest AU IMPACT — the question an Australian
// investor is asking — each with both axes kept apart. First click flies the
// map there; a second click on the same card opens the reasoning.

export function GeoRiskCards({ onFocus }) {
  const [focused, setFocused] = useState(null)
  const [open, setOpen] = useState(null)
  const top = useMemo(() => [...GEO_RISK_INDEX].sort((a, b) => b.auImpact - a.auImpact).slice(0, 5), [])

  const click = (r) => {
    if (focused === r.id) { setOpen((o) => (o === r.id ? null : r.id)); return }
    setFocused(r.id)
    if (r.centre) onFocus?.({ longitude: r.centre[0], latitude: r.centre[1], zoom: 3.5 })
  }

  return (
    <div className="flex flex-col gap-1.5">
      {top.map((r) => {
        const band = riskBand(r.score)
        return (
          <button key={r.id} onClick={() => click(r)}
            className="w-full text-left border px-2 py-1.5 transition-colors"
            style={{ borderColor: focused === r.id ? 'rgba(201,168,76,0.45)' : 'rgba(201,168,76,0.1)', background: focused === r.id ? 'rgba(201,168,76,0.05)' : 'transparent' }}>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-terminal-text-bright uppercase truncate flex-1 min-w-0">{r.label}</span>
              <span className="text-[8px] font-bold tracking-wider px-1 flex-shrink-0" style={{ color: band.colour, border: `1px solid ${band.colour}66` }}>{band.label}</span>
            </div>
            <div className="text-[9px] text-terminal-text-dim mt-0.5 truncate">{r.summary}</div>
            <div className="grid grid-cols-[52px_1fr_22px] items-center gap-x-1.5 gap-y-0.5 mt-1">
              <span className="text-[8px] text-terminal-text-dim tracking-wider">AU IMPACT</span>
              <div className="h-[3px] bg-terminal-surface2 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${r.auImpact}%`, background: '#4A7FB5' }} /></div>
              <span className="text-[8px] text-terminal-text-bright tabular-nums text-right">{r.auImpact}</span>
              <span className="text-[8px] text-terminal-text-dim tracking-wider">GLOBAL</span>
              <div className="h-[3px] bg-terminal-surface2 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${r.score}%`, background: band.colour }} /></div>
              <span className="text-[8px] text-terminal-text-bright tabular-nums text-right">{r.score}</span>
            </div>
            {r.affects?.length > 0 && <div className="text-[9px] text-terminal-text-dim/80 mt-1">Affects: {r.affects.join(', ')}</div>}
            {open === r.id && (
              <div className="mt-1.5 pt-1.5 border-t border-terminal-border/50 text-[9px] text-terminal-text-dim leading-snug">
                <div className="mb-1">{r.auImpactNote}</div>
                {r.factors.map((f) => (
                  <div key={f.key} className="flex gap-1.5"><span className="tabular-nums text-terminal-text-bright w-5 text-right flex-shrink-0">+{f.weight}</span><span>{f.note}</span></div>
                ))}
              </div>
            )}
          </button>
        )
      })}
      <div className="text-[8px] text-terminal-text-dim/50 leading-snug">
        Maddex internal assessment, scored by a documented rubric · reviewed {fmtDay(RISK_LAST_REVIEWED)}. Top five by
        AU impact. Click to fly there, again for the reasoning.
      </div>
    </div>
  )
}
