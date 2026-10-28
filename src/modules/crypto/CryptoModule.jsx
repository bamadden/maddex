import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import DefiPanel from './DefiPanel'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCoinHistory, fetchFearGreed, fetchCryptoGlobal,
  transformCryptoMarkets, transformCoinHistory, transformFearGreed,
  COIN_IDS,
} from '../../services/api'
import { fetchCryptoMarketsUnified } from '../../services/dataService'
import { HalvingCard, MyCryptoPanel } from './CryptoExtras'
import { calculateCryptoMomentumIndex, scoreToColor } from '../../services/maddenAiScoring'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt } from '../../utils/format'
import { dispatchAskAI, askMaddenAI, todayAEST } from '../../utils/askAI'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { StaleBadge, Viz3DLoader } from '../../components/ui/ModuleStates'
import { SkeletonCoinRow } from '../../components/ui/Skeleton'
import ModuleHeader from '../../components/ui/ModuleHeader'
import PriceChange from '../../components/ui/PriceChange'
import { Area, Bar, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts'
import SafeChart from '../../components/ui/SafeChart'

// Code-split — three.js/@react-three pull in a large bundle only needed
// once the user actually switches to the 3D view.
const CryptoLandscape3D = lazy(() => import('../../components/visualisations/CryptoLandscape3D'))

// ── Coin colour circle (deterministic hash, not a real logo — Bloomberg-
// terminal-style abstract avatar rather than brand marks) ──────────────────
const CIRCLE_PALETTE = ['#f7931a', '#627eea', '#9945ff', '#00d4ff', '#f0b90b', '#26a17b', '#e84142', '#2775ca', '#8247e5', '#C9A84C']
// Real (approximate) brand colours for the coins that actually show up in
// the top-20 list — hash-based colour is only a fallback for the long tail.
const COIN_COLORS = {
  BTC: '#F7931A', ETH: '#627EEA', XRP: '#00AAE4', SOL: '#9945FF', BNB: '#F3BA2F',
  ADA: '#0033ad', AVAX: '#e84142', DOGE: '#c2a633', DOT: '#e6007a', LINK: '#2a5ada',
  MATIC: '#8247e5', POL: '#8247e5', LTC: '#345d9d', TRX: '#ff060a', TON: '#0098ea',
  USDT: '#26a17b', USDC: '#2775ca', SHIB: '#ffa409', ATOM: '#2e3148', UNI: '#ff007a',
  XLM: '#08b5e5', ETC: '#328332', BCH: '#8dc351', NEAR: '#00c08b', ICP: '#f15a24',
  APT: '#2dd8a7', ARB: '#28a0f0', OP: '#ff0420', FIL: '#0090ff', HBAR: '#000000',
}
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function coinColor(symbol) {
  return COIN_COLORS[symbol] ?? CIRCLE_PALETTE[hashStr(symbol) % CIRCLE_PALETTE.length]
}
function CoinCircle({ symbol, size = 22 }) {
  const color = coinColor(symbol)
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `${color}26`, border: `1px solid ${color}66`, color, fontSize: size * 0.42 }}
    >
      {symbol?.[0] ?? '?'}
    </span>
  )
}


// ── Sparkline ──────────────────────────────────────────────────────────────────

function Sparkline({ prices, w = 60, h = 28 }) {
  if (!prices?.length) return <span style={{ display: 'inline-block', width: w }} />
  const sampled = prices.filter((_, i) => i % 4 === 0)
  const min = Math.min(...sampled), max = Math.max(...sampled)
  const range = max - min || 1
  const pts = sampled.map((p, i) =>
    `${(i / (sampled.length - 1)) * w},${h - ((p - min) / range) * (h - 2) - 1}`
  ).join(' ')
  // Gold when the price is above where it started the window, red below —
  // read off the series itself, so it always agrees with the line's shape.
  const up = sampled.at(-1) >= sampled[0]
  const color = up ? '#C9A84C' : 'var(--color-loss)'
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'middle', width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', opacity: 0.8 }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
  )
}

// ── Chart tooltip ──────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  // The detail chart carries volume bars too; the tooltip reports the price.
  const val = (payload.find((p) => p.dataKey === 'price') ?? payload[0]).value
  const formatted = currency === 'AUD'
    ? fmt.aud(val)
    : `US$${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="text-terminal-gold font-semibold">{formatted}</div>
    </div>
  )
}

// ── Top 5 by volume (left column) ───────────────────────────────────────────

function TopVolumeList({ markets, currPrefix, selectedCoin, onSelect }) {
  const top5 = useMemo(() => {
    if (!markets?.length) return []
    return [...markets].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5)
  }, [markets])
  return (
    <div style={P.wrap}>
      <div style={P.title}>TOP 5 BY VOLUME</div>
      {!top5.length ? <div style={P.empty}>LOADING...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {top5.map((c, i) => (
            <div
              key={c.symbol}
              onClick={() => onSelect(c.symbol)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                opacity: selectedCoin === c.symbol ? 1 : 0.85,
              }}
            >
              <span style={{ fontSize: 9, color: 'rgba(100,130,160,0.5)', width: 10, flexShrink: 0 }}>{i + 1}</span>
              <CoinCircle symbol={c.symbol} size={16} />
              <span style={{ fontSize: 10, fontWeight: 700, color: selectedCoin === c.symbol ? '#C9A84C' : '#e8ecf0' }}>{c.symbol}</span>
              <span style={{ fontSize: 9, color: 'rgba(100,130,160,0.6)', marginLeft: 'auto' }}>{currPrefix}{c.vol24h}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sector performance (left column) — grouped from live 24h % changes of
// whichever top-20 coins fall into each rough bucket; buckets with none of
// their members present in the current top-20 are simply omitted. ─────────

const SECTOR_MAP = {
  'Layer 1':  ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'DOT', 'TRX', 'NEAR', 'ATOM', 'ETC', 'TON'],
  'DeFi':     ['UNI', 'LINK', 'MATIC', 'POL'],
  'Payments': ['XRP', 'LTC', 'BCH', 'XLM'],
  'Exchange': ['BNB'],
  'Meme':     ['DOGE', 'SHIB'],
}
function SectorPerformanceList({ markets }) {
  const sectors = useMemo(() => {
    if (!markets?.length) return []
    const bySymbol = Object.fromEntries(markets.map(c => [c.symbol, c]))
    return Object.entries(SECTOR_MAP)
      .map(([name, syms]) => {
        const coins = syms.map(s => bySymbol[s]).filter(Boolean)
        if (!coins.length) return null
        const avg = coins.reduce((sum, c) => sum + (c.pct24h ?? 0), 0) / coins.length
        return { name, avg, count: coins.length }
      })
      .filter(Boolean)
      .sort((a, b) => b.avg - a.avg)
  }, [markets])
  return (
    <div style={P.wrap}>
      <div style={P.title}>SECTOR PERFORMANCE (24H)</div>
      {!sectors.length ? <div style={P.empty}>LOADING...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sectors.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'rgba(100,130,160,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {s.name} <span style={{ color: 'rgba(100,130,160,0.4)' }}>({s.count})</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: s.avg >= 0 ? 'var(--color-gain)' : 'var(--color-loss)', flexShrink: 0 }}>
                {s.avg >= 0 ? '▲' : '▼'}{Math.abs(s.avg).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 4-Panel dashboard shared styles ───────────────────────────────────────────

// flexShrink:0 (not flex:1) is deliberate — these sections now stack
// vertically in a scrollable column (post crypto-module 3-column redesign),
// not side by side in a fixed-height row like they originally did. flex:1
// on a scrollable flex-col's children makes them fight over height and
// squish/clip (the "cramped and cutoff" bug); each section should just take
// its natural content height and let the column scroll.
const P = {
  wrap:  { flexShrink:0, display:'flex', flexDirection:'column', padding:'12px 10px', marginBottom:16, boxSizing:'border-box' },
  title: { fontSize:9, fontWeight:700, color:'#C9A84C', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' },
  empty: { display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'rgba(100,130,160,0.5)', minHeight:60 },
}

function MaddenAIPanel({ momentum }) {
  if (!momentum) return <div style={P.wrap}><div style={P.title}>MADDENAI MOMENTUM</div><div style={P.empty}>CALCULATING...</div></div>
  const color = scoreToColor(momentum.score)
  const { bullish = 33, neutral = 34, bearish = 33 } = momentum.breakdown ?? {}
  return (
    <div style={P.wrap}>
      <div style={P.title}>MADDENAI MOMENTUM</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:5 }}>
        <span style={{ fontSize:36, fontWeight:700, lineHeight:1, color, fontFamily:'IBM Plex Mono' }}>{momentum.score}</span>
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <span style={{ fontSize:9, color:'rgba(100,130,160,0.5)' }}>/ 100</span>
          <span style={{ fontSize:11, fontWeight:700, color }}>{momentum.label.toUpperCase()}</span>
        </div>
      </div>
      <div style={{ height:6, display:'flex', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${bullish}%`, background:'var(--color-gain)', transition:'width 0.5s' }} />
        <div style={{ width:`${neutral}%`, background:'var(--color-neutral)', transition:'width 0.5s' }} />
        <div style={{ width:`${bearish}%`, background:'var(--color-loss)', transition:'width 0.5s' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, marginTop:2 }}>
        <span style={{ color:'var(--color-gain)' }}>{bullish}% BULL</span>
        <span style={{ color:'var(--color-neutral)' }}>{neutral}% NEUT</span>
        <span style={{ color:'var(--color-loss)' }}>{bearish}% BEAR</span>
      </div>
    </div>
  )
}

function FearGreedPanel({ data }) {
  if (!data) return <div style={P.wrap}><div style={P.title}>FEAR &amp; GREED</div><div style={P.empty}>LOADING...</div></div>
  const { value, label, prev, weekAgo, monthAgo } = data
  // The arc runs red → amber → gold → green across 0–100. The five zone NAMES
  // sit along it in order; alternative.me publishes no numeric cut-offs, so
  // none are drawn — the reading's own label (from the API) is the one shown
  // large, which is why 51 reads NEUTRAL rather than a guessed band.
  const colourAt = (v) => (v >= 75 ? '#2D8A50' : v >= 55 ? '#7BC47F' : v > 45 ? '#C9A84C' : v >= 25 ? '#E8A33D' : '#C0504D')
  const color = colourAt(value)
  const cx = 100, cy = 84, r = 64
  const pt = (v, rr = r) => { const a = Math.PI * (1 - v / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] }
  const [nx, ny] = pt(value, r - 4)
  const zones = [['EXTREME FEAR', 6], ['FEAR', 28], ['NEUTRAL', 50], ['GREED', 72], ['EXTREME GREED', 94]]
  return (
    <div style={{ ...P.wrap, minHeight: 190 }}>
      <div style={P.title}>FEAR &amp; GREED</div>
      <svg viewBox="-30 0 260 132" style={{ width: '100%', maxWidth: 280, alignSelf: 'center' }} role="img" aria-label={`Fear and Greed ${value}, ${label}`}>
        <defs>
          <linearGradient id="fgArc" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#C0504D" /><stop offset="30%" stopColor="#E8A33D" />
            <stop offset="50%" stopColor="#C9A84C" /><stop offset="72%" stopColor="#7BC47F" /><stop offset="100%" stopColor="#2D8A50" />
          </linearGradient>
        </defs>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#fgArc)" strokeWidth="12" opacity="0.85" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#E8EDF5" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="#E8EDF5" />
        {zones.map(([z, v]) => {
          const [x, y] = pt(v, r + 14)
          return <text key={z} x={x} y={y + 2} textAnchor={v < 20 ? 'end' : v > 80 ? 'start' : 'middle'} fill={colourAt(v)} fontSize="6.5" fontFamily="IBM Plex Mono" letterSpacing="0.04em">{z}</text>
        })}
        {/* The reading sits under the pivot, clear of the needle. */}
        <text x={cx} y={cy + 30} textAnchor="middle" fill={color} fontSize="28" fontFamily="IBM Plex Mono" fontWeight="700">{value}</text>
        <text x={cx} y={cy + 44} textAnchor="middle" fill={color} fontSize="9" fontFamily="IBM Plex Mono" fontWeight="700" letterSpacing="0.12em">{label.toUpperCase()}</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 9, marginTop: 4 }}>
        {[['YESTERDAY', prev], ['7D AGO', weekAgo], ['30D AGO', monthAgo]].map(([k, v]) => (
          <div key={k} style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(100,130,160,0.55)', fontSize: 8 }}>{k}</div>
            <div style={{ color: colourAt(v), fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: 'rgba(100,130,160,0.5)', marginTop: 4, textAlign: 'center' }}>alternative.me · classification is the index&apos;s own</div>
    </div>
  )
}

// ── Market metrics — the four numbers that frame the market, full width ────
//
// Total market cap, BTC dominance, Fear & Greed and 24h volume, from
// CoinGecko /global and alternative.me — the feeds the sidebar used to show
// them from, stacked one under another where they could not be compared.
function MetricCard({ label, value, sub, subTone, children, title }) {
  return (
    <div className="px-4 py-2.5 min-w-0 border-r border-terminal-border last:border-r-0" title={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] tracking-widest text-terminal-gold font-bold">{label}</span>
        {children}
      </div>
      <div className="font-mono font-bold tabular-nums text-terminal-text-bright mt-1" style={{ fontSize: 20 }}>{value}</div>
      <div className="font-mono text-[10px] mt-0.5" style={{ color: subTone ?? 'var(--color-text-dim)' }}>{sub}</div>
    </div>
  )
}

function CryptoMetricRow({ globalData, fearGreed, currency, capSparkline }) {
  const ccy = currency === 'AUD' ? 'aud' : 'usd'
  const sym = currency === 'AUD' ? 'A$' : 'US$'
  const big = (v) => (v == null ? '—' : v >= 1e12 ? `${sym}${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `${sym}${(v / 1e9).toFixed(1)}B` : `${sym}${Math.round(v).toLocaleString()}`)
  const chg = globalData?.market_cap_change_percentage_24h_usd
  const btc = globalData?.market_cap_percentage?.btc
  const yday = btcDomYesterday()
  const dDom = btc != null && yday != null ? btc - yday : null
  const fg = fearGreed
  const fgTone = fg == null ? undefined : fg.value >= 55 ? 'var(--color-gain)' : fg.value <= 45 ? 'var(--color-loss)' : '#C9A84C'
  const up = (v) => (v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)')
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-terminal-border flex-shrink-0" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <MetricCard label="TOTAL CRYPTO MARKET CAP" value={big(globalData?.total_market_cap?.[ccy])}
        sub={chg != null ? `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}% 24h` : 'CoinGecko'} subTone={chg != null ? up(chg) : undefined}
        title="CoinGecko /global">
        {capSparkline?.length > 1 && <Sparkline prices={capSparkline} w={70} h={20} />}
      </MetricCard>
      <MetricCard label="BTC DOMINANCE" value={btc != null ? `${btc.toFixed(1)}%` : '—'}
        sub={dDom != null ? `${dDom >= 0 ? '▲' : '▼'} ${Math.abs(dDom).toFixed(2)}pp vs yesterday` : 'share of total market cap'} subTone={dDom != null ? up(dDom) : undefined}
        title="Bitcoin's share of total crypto market cap (CoinGecko). Yesterday's reading is the one this browser last saw." />
      <MetricCard label="FEAR & GREED" value={fg ? fg.value : '—'}
        sub={fg ? `${fg.label.toUpperCase()} · yesterday ${fg.prev}` : 'alternative.me'} subTone={fgTone}
        title="alternative.me Crypto Fear & Greed Index, 0–100, with its own classification" />
      <MetricCard label="24H VOLUME" value={big(globalData?.total_volume?.[ccy])}
        sub={globalData?.active_cryptocurrencies ? `${globalData.active_cryptocurrencies.toLocaleString()} coins tracked` : 'CoinGecko'} />
    </div>
  )
}

// Yesterday's BTC dominance isn't in CoinGecko's /global snapshot — persisted
// locally (same pattern as MarketSentimentBanner's score history) so a
// "vs yesterday" delta can be shown without an extra API call.
const BTC_DOM_KEY = 'maddex_btc_dominance_history'
function readBtcDomHistory() {
  try { return JSON.parse(localStorage.getItem(BTC_DOM_KEY) ?? '[]') } catch { return [] }
}
function writeBtcDomHistory(pct) {
  try {
    const hist = readBtcDomHistory()
    const today = new Date().toISOString().slice(0, 10)
    if (hist[hist.length - 1]?.date === today) return
    hist.push({ date: today, pct })
    if (hist.length > 90) hist.splice(0, hist.length - 90)
    localStorage.setItem(BTC_DOM_KEY, JSON.stringify(hist))
  } catch { /* ignore */ }
}
function btcDomYesterday() {
  const hist = readBtcDomHistory()
  return hist.length ? hist[hist.length - 1].pct : null
}

function DominancePanel({ globalData }) {
  // Bars grow from zero on first paint — one frame at 0%, then the real
  // width, so the CSS transition animates them in.
  const [ready, setReady] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id) }, [])
  useEffect(() => {
    const btc = globalData?.market_cap_percentage?.btc
    if (btc != null) writeBtcDomHistory(btc)
  }, [globalData])

  if (!globalData) return <div style={P.wrap}><div style={P.title}>MARKET SHARE</div><div style={P.empty}>LOADING...</div></div>
  const pct = globalData.market_cap_percentage ?? {}
  const btc = pct.btc ?? 0
  const eth = pct.eth ?? 0
  const bars = [
    { label: 'BTC', pct: btc, color: '#F7931A' },
    { label: 'ETH', pct: eth, color: '#627EEA' },
    { label: 'OTHERS', pct: Math.max(0, 100 - btc - eth), color: 'rgba(139,163,196,0.55)' },
  ]
  return (
    <div style={P.wrap}>
      <div style={P.title}>MARKET SHARE</div>
      <div className="space-y-2">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between font-mono" style={{ fontSize: 9 }}>
              <span style={{ color: b.color, fontWeight: 700 }}>{b.label}</span>
              <span className="tabular-nums" style={{ color: '#d4dce8', fontWeight: 600 }}>{b.pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-sm overflow-hidden mt-0.5" style={{ background: 'rgba(100,130,160,0.15)' }}>
              <div className="h-full rounded-sm" style={{ width: ready ? `${b.pct}%` : '0%', background: b.color, transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="font-mono mt-1.5" style={{ fontSize: 8, color: 'rgba(100,130,160,0.6)' }}>Share of total crypto market cap · CoinGecko</div>
    </div>
  )
}

// Pearson correlation of daily returns — used for the detail panel's "vs
// BTC" bar. Needs at least 3 return points to mean anything.
function pearsonCorrelation(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 3) return null
  const ra = [], rb = []
  for (let i = 1; i < n; i++) {
    ra.push((a[i] - a[i - 1]) / a[i - 1])
    rb.push((b[i] - b[i - 1]) / b[i - 1])
  }
  const meanA = ra.reduce((s, v) => s + v, 0) / ra.length
  const meanB = rb.reduce((s, v) => s + v, 0) / rb.length
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < ra.length; i++) {
    const da = ra[i] - meanA, db = rb[i] - meanB
    num += da * db; denA += da * da; denB += db * db
  }
  const den = Math.sqrt(denA * denB)
  return den === 0 ? null : num / den
}

// ── RIGHT: coin detail slide-in ─────────────────────────────────────────────

function CoinDetailPanel({ coin, currPrefix, usdToAud, audToUsd, chartData, chartLoading, historyError, onRetryHistory, timeframe, onTimeframeChange, btcCorrelation, onAskAI, onExpand, onClose }) {
  if (!coin) return null
  // Rows arrive in the module's selected currency (AUD by default) — every
  // figure below is in that currency. The panel used to label them all "US$"
  // and then convert the AUD price to AUD a second time.
  const isAud = currPrefix === 'A$'
  const dp = (v) => (v != null && v < 1 ? 4 : 2)
  const money = (v) => (v == null ? '—' : `${currPrefix}${v.toLocaleString('en-AU', { minimumFractionDigits: dp(v), maximumFractionDigits: dp(v) })}`)
  const other = isAud ? audToUsd?.(coin.price) : usdToAud?.(coin.price)
  const otherLabel = other != null ? `≈ ${isAud ? 'US$' : 'A$'}${other.toLocaleString('en-AU', { maximumFractionDigits: dp(other) })}` : null

  const lo = coin.low24h, hi = coin.high24h
  const rangePct = lo != null && hi != null && hi > lo ? Math.min(100, Math.max(0, ((coin.price - lo) / (hi - lo)) * 100)) : null
  const minted = coin.maxSupply && coin.circulatingSupply ? (coin.circulatingSupply / coin.maxSupply) * 100 : null
  const compact = (n) => n == null ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString('en-AU', { maximumFractionDigits: 0 })

  const statRows = [
    ['MCap',        `${currPrefix}${coin.mktCap}`],
    ['Vol 24H',     `${currPrefix}${coin.vol24h}`],
    ['ATL',         money(coin.atl)],
    ['Above ATL',   coin.atlPct != null ? `+${Math.round(coin.atlPct).toLocaleString('en-AU')}%` : '—'],
  ]
  // Where the price sits between its all-time low and high, linearly.
  const recovery = coin.ath != null && coin.atl != null && coin.ath > coin.atl
    ? Math.min(100, Math.max(0, ((coin.price - coin.atl) / (coin.ath - coin.atl)) * 100)) : null
  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar panel-slide-in">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <CoinCircle symbol={coin.symbol} size={32} />
          <div className="min-w-0">
            <div className="font-mono text-[9px] text-terminal-gold tracking-widest">#{coin.rank} {coin.name.toUpperCase()}</div>
            <div className="text-sm font-bold text-terminal-text-bright truncate">{coin.symbol}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text text-sm flex-shrink-0">✕</button>
      </div>

      <div className="px-3 py-3 border-b border-terminal-border/50">
        <div className="text-xl font-bold text-terminal-text-bright font-mono tabular-nums">{money(coin.price)}</div>
        {otherLabel && <div className="text-2xs text-terminal-text-dim mt-0.5">{otherLabel}</div>}
        <div className={`text-xs font-semibold mt-1 ${coin.pct24h >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {coin.pct24h >= 0 ? '▲' : '▼'} {Math.abs(coin.pct24h).toFixed(2)}% (24h)
        </div>
        {rangePct != null && (
          <div className="mt-2.5">
            <div className="flex justify-between text-[9px] text-terminal-text-dim mb-1"><span>24H LOW</span><span>24H HIGH</span></div>
            <div className="relative h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(168,50,50,0.5), rgba(45,138,80,0.5))' }}>
              <span className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2" style={{ left: `calc(${rangePct}% - 5px)`, background: '#E8EDF5', borderColor: '#040d1a' }} />
            </div>
            <div className="flex justify-between text-[9px] font-mono tabular-nums text-terminal-text mt-1"><span>{money(lo)}</span><span>{money(hi)}</span></div>
          </div>
        )}
      </div>

      {coin.ath != null && (
        <div className="px-3 py-2.5 border-b border-terminal-border/50">
          <div className="text-[9px] text-terminal-text-dim uppercase tracking-wide">All-time high</div>
          <div className="text-2xs text-terminal-text-bright font-semibold mt-0.5 tabular-nums">
            {money(coin.ath)}{coin.athPct != null && <span className="text-terminal-red"> — {Math.abs(coin.athPct).toFixed(1)}% below ATH</span>}
          </div>
          {recovery != null && (
            <>
              <div className="relative h-1.5 rounded-full mt-2" style={{ background: 'rgba(100,130,160,0.2)' }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${recovery}%`, background: 'linear-gradient(90deg, rgba(168,50,50,0.6), #C9A84C)' }} />
                <span className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ left: `calc(${recovery}% - 4px)`, background: '#E8EDF5' }} />
              </div>
              <div className="flex justify-between text-[9px] text-terminal-text-dim mt-1">
                <span>ATL</span><span>{recovery.toFixed(0)}% of the way from ATL to ATH</span><span>ATH</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="px-3 py-2.5 border-b border-terminal-border/50 grid grid-cols-2 gap-x-3 gap-y-2">
        {statRows.map(([label, value]) => (
          <div key={label}>
            <div className="text-[9px] text-terminal-text-dim uppercase tracking-wide">{label}</div>
            <div className="text-2xs text-terminal-text-bright font-semibold mt-0.5 tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2.5 border-b border-terminal-border/50">
        <div className="text-[9px] text-terminal-text-dim uppercase tracking-wide mb-1">Supply</div>
        {minted != null ? (
          <>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(100,130,160,0.2)' }}>
              <div className="h-full bg-terminal-gold" style={{ width: `${minted}%` }} />
            </div>
            <div className="text-2xs text-terminal-text mt-1 tabular-nums">
              {compact(coin.circulatingSupply)} / {compact(coin.maxSupply)} {coin.symbol} <span className="text-terminal-text-dim">({minted.toFixed(1)}% minted)</span>
            </div>
          </>
        ) : (
          <>
            <div className="h-1.5 rounded-full" style={{ background: 'repeating-linear-gradient(90deg, rgba(168,50,50,0.55) 0 6px, rgba(168,50,50,0.2) 6px 10px)' }} title="No maximum supply — new coins can keep being issued" />
            <div className="text-2xs text-terminal-text tabular-nums mt-1">
              {compact(coin.circulatingSupply)} {coin.symbol} circulating <span className="text-terminal-red">· no max supply (inflationary)</span>
            </div>
          </>
        )}
        {coin.id && (
          <a href={`https://www.coingecko.com/en/coins/${coin.id}`} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-2 text-[9px] font-bold tracking-widest text-terminal-gold/80 hover:text-terminal-gold">VIEW ON COINGECKO ↗</a>
        )}
      </div>

      <div className="px-3 py-2.5 border-b border-terminal-border/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] text-terminal-gold tracking-widest font-bold">PRICE HISTORY</span>
          <div className="flex gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => onTimeframeChange(tf)}
                className={`px-1 py-0 text-[9px] transition-colors ${
                  timeframe === tf ? 'border border-terminal-gold text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'
                }`}>{tf}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 120 }}>
          {historyError && !chartData ? (
            <DataUnavailable label="CHART UNAVAILABLE" onRetry={onRetryHistory} className="h-full" />
          ) : chartLoading ? (
            <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">LOADING...</div>
          ) : chartData?.length > 1 ? (
            <SafeChart width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                <YAxis yAxisId="p" hide domain={['auto', 'auto']} />
                {/* Volume on its own axis, scaled so the tallest bar reaches a
                    quarter of the chart and sits under the price line. */}
                <YAxis yAxisId="v" hide domain={[0, (max) => (max || 1) * 4]} />
                <Tooltip content={<ChartTooltip currency={isAud ? 'AUD' : 'USD'} />} />
                <Bar yAxisId="v" dataKey="volume" fill="rgba(99,120,153,0.35)" isAnimationActive={false} />
                <Area yAxisId="p" type="monotone" dataKey="price" stroke="#C9A84C" strokeWidth={1.5}
                  fill="url(#detailGrad)" dot={false} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </SafeChart>
          ) : (
            <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim">NO DATA</div>
          )}
        </div>
      </div>

      {coin.symbol !== 'BTC' && (
        <div className="px-3 py-2.5 border-b border-terminal-border/50">
          <div className="text-[9px] text-terminal-gold tracking-widest font-bold mb-1.5">BTC CORRELATION</div>
          {btcCorrelation != null ? (
            <div>
              <div className="flex items-center justify-between text-2xs mb-1">
                <span className="text-terminal-text-dim">-1</span>
                <span className={`font-bold ${btcCorrelation >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>{btcCorrelation.toFixed(2)}</span>
                <span className="text-terminal-text-dim">+1</span>
              </div>
              <div className="relative w-full h-1.5 bg-terminal-surface2 rounded-full">
                <div className="absolute top-0 bottom-0 w-px bg-terminal-border-gold left-1/2" />
                <div className="absolute top-1/2 w-1.5 h-1.5 rounded-full bg-terminal-gold"
                  style={{ left: `${((btcCorrelation + 1) / 2) * 100}%`, transform: 'translate(-50%, -50%)' }} />
              </div>
            </div>
          ) : (
            <div className="text-2xs text-terminal-text-dim/60">Calculating...</div>
          )}
        </div>
      )}

      <div className="px-3 py-3 flex flex-col gap-2">
        <button
          onClick={() => onAskAI(coin)}
          className="w-full text-2xs font-bold tracking-wide bg-terminal-gold text-terminal-bg py-2 hover:bg-terminal-gold-bright transition-colors"
        >ASK MADDENAI ABOUT {coin.symbol} →</button>
        <button
          onClick={() => onExpand(coin)}
          className="w-full text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border hover:border-terminal-gold/40 py-1.5 transition-colors"
        >VIEW FULL DETAIL ⤢</button>
      </div>
    </div>
  )
}

// ── Timeframe config ───────────────────────────────────────────────────────────

const TIMEFRAMES = ['1D', '7D', '1M', '3M', '1Y']
const TF_DAYS    = { '1D': 1, '7D': 7, '1M': 30, '3M': 90, '1Y': 365 }

// ── Resizable panel — drag the edge handle to resize, persisted to
// localStorage. Width only applies at md+ (via a CSS custom property fed
// into a Tailwind arbitrary-value class); below md the panel is full-width
// and stacked per the existing mobile panel-switcher, same as before this
// was made resizable. ────────────────────────────────────────────────────

function ResizablePanel({ children, defaultWidth, minWidth, maxWidth, storageKey, side, mobileVisible, className = '' }) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(storageKey), 10)
      return Number.isFinite(saved) ? Math.min(maxWidth, Math.max(minWidth, saved)) : defaultWidth
    } catch { return defaultWidth }
  })
  const latestWidth = useRef(width)

  const onMouseDown = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width

    const onMouseMove = (ev) => {
      const delta = side === 'right' ? ev.clientX - startX : startX - ev.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))
      latestWidth.current = newWidth
      setWidth(newWidth)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      try { localStorage.setItem(storageKey, String(latestWidth.current)) } catch { /* best-effort */ }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      className={`${mobileVisible ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[var(--panel-w)] md:min-w-[var(--panel-w)] flex-shrink-0 relative ${className}`}
      style={{ '--panel-w': `${width}px` }}
    >
      {children}
      <div
        onMouseDown={onMouseDown}
        title="Drag to resize"
        className="hidden md:block absolute top-0 bottom-0 z-20 hover:bg-terminal-gold/40 transition-colors"
        style={{ [side]: 0, width: 6, cursor: 'col-resize' }}
      />
    </div>
  )
}

// ── Shared cell styles ─────────────────────────────────────────────────────────

const CELL = { padding: '5px 8px', fontSize: '10px', verticalAlign: 'middle', position: 'static' }
const HEAD = { padding: '6px 8px', fontSize: '9px', color: '#C9A84C', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#0B1628', verticalAlign: 'middle' }

// ── Main Module ────────────────────────────────────────────────────────────────

// ── Crypto in Australia ──────────────────────────────────────────────────────
//
// Four facts, each with its source, checked 28 Oct 2026. The brief offered
// "~25% own crypto" and "ASIC regulates exchanges since 2024"; the latest
// survey says about 31%, and exchanges have registered with AUSTRAC since 2018
// while ASIC licensing arrives under the 2026 Digital Assets Framework.
const AU_CRYPTO_FACTS = [
  ['About 3 in 10 Australian adults own or have owned crypto', 'Independent Reserve Cryptocurrency Index 2025 (31%)'],
  ['Exchanges must register with AUSTRAC (since 2018); the Digital Assets Framework passed in April 2026 brings platforms that hold crypto for customers under ASIC financial services licensing', 'AUSTRAC; Corporations Amendment (Digital Assets Framework) Act 2026'],
  ['Crypto is a CGT asset: disposing of it — selling, swapping or spending — can trigger capital gains tax', 'ATO'],
  ['Capital losses on crypto offset capital gains (this year or carried forward) — not salary or other income', 'ATO'],
]

function AuCryptoContext() {
  return (
    <div style={P.wrap}>
      <div style={P.title}>CRYPTO IN AUSTRALIA</div>
      <ul className="space-y-2">
        {AU_CRYPTO_FACTS.map(([fact, src]) => (
          <li key={fact} className="text-[10px] leading-snug text-terminal-text">
            {fact}
            <div className="text-[8px] text-terminal-text-dim/60 mt-0.5">{src}</div>
          </li>
        ))}
      </ul>
      <button
        onClick={() => askMaddenAI('What do Australian investors need to know about crypto tax and regulation? Cover capital gains tax and losses, record-keeping, AUSTRAC registration of exchanges and the 2026 Digital Assets Framework. General information, not personal tax advice.')}
        className="mt-2.5 text-2xs font-bold tracking-wide border border-terminal-gold/50 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors py-1.5"
      >ASK MADDENAI ▶</button>
      <div className="text-[8px] text-terminal-text-dim/50 mt-1.5">General information only — not tax or financial advice.</div>
    </div>
  )
}

export default function CryptoModule() {
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  // 7D by default: the detail chart pairs price with daily-ish volume bars,
  // and a week is the window the table's sparkline and 7D% already describe.
  const [timeframe, setTimeframe]       = useState('7D')
  const [titleBarHeight, setTitleBarHeight] = useState(28)
  // Mobile only (<768px) — the overview/table/detail columns stack instead
  // of sitting side by side, so a small screen needs an explicit switcher.
  const [mobilePanel, setMobilePanel] = useState('table')
  const [view3D, setView3D] = useState(false)
  const [showDefi, setShowDefi] = useState(false)
  const [showMine, setShowMine] = useState(false)
  const titleBarRef = useRef(null)
  const { openModal, currency } = useStore()
  const { usdToAud, audToUsd } = useAudRates()

  useEffect(() => {
    if (titleBarRef.current) {
      const h = titleBarRef.current.offsetHeight
      console.log('Crypto title bar height:', h)
      setTitleBarHeight(h)
    }
  }, [])
  const vsCurrency = currency.toLowerCase()
  const currPrefix = currency === 'AUD' ? 'A$' : 'US$'

  const { data: rawMarketsResult, isError: marketsError, isFetching: marketsFetching, refetch: refetchMarkets } = useQuery({
    queryKey: ['cryptoMarkets', vsCurrency],
    queryFn:  () => fetchCryptoMarketsUnified(vsCurrency),
    staleTime: 60_000,
    retry: 1,
  })
  const marketsDelayed = rawMarketsResult?.stale === true

  const { data: rawFearGreed } = useQuery({
    queryKey: ['fearGreed'],
    queryFn:  fetchFearGreed,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const { data: globalData } = useQuery({
    queryKey: ['cryptoGlobal'],
    queryFn:  fetchCryptoGlobal,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const days = TF_DAYS[timeframe] ?? 90
  const { data: rawHistory, isFetching: chartLoading, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['coinHistory', selectedCoin, vsCurrency, days],
    queryFn:  () => fetchCoinHistory(COIN_IDS[selectedCoin] ?? selectedCoin.toLowerCase(), vsCurrency, days),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rawMarkets = rawMarketsResult?.data
  const markets    = rawMarkets   ? transformCryptoMarkets(rawMarkets, vsCurrency) : null
  const fearGreed  = rawFearGreed ? transformFearGreed(rawFearGreed)               : null
  const chartData  = rawHistory   ? transformCoinHistory(rawHistory)               : null

  const momentum = useMemo(() => {
    if (!rawMarkets) return null
    const coins = rawMarkets.map((c) => ({
      symbol: c.symbol?.toUpperCase(),
      change24h: c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d_in_currency,
      volume24h: c.total_volume,
      marketCap: c.market_cap,
    }))
    return calculateCryptoMomentumIndex({ coins, fearGreed })
  }, [rawMarkets, fearGreed])

  // Approximate total-market-cap 7d trend from constituent coins' own 7d
  // sparklines (already fetched with the markets batch) — avoids a separate
  // /global market-cap-chart call just for a tiny trend line.
  const capSparkline = useMemo(() => {
    if (!rawMarkets?.length) return []
    const withSpark = rawMarkets.filter(c => c.sparkline_in_7d?.price?.length && c.market_cap && c.current_price)
    if (!withSpark.length) return []
    const len = Math.min(...withSpark.map(c => c.sparkline_in_7d.price.length))
    const totals = new Array(len).fill(0)
    for (const c of withSpark) {
      const weight = c.market_cap / c.current_price
      const prices = c.sparkline_in_7d.price
      const offset = prices.length - len
      for (let i = 0; i < len; i++) totals[i] += prices[offset + i] * weight
    }
    return totals
  }, [rawMarkets])

  // BTC price history at the same timeframe as the selected coin, fetched
  // only when a non-BTC coin is selected — feeds the detail panel's
  // correlation bar. Skipped for BTC itself (correlation with itself is
  // trivially 1 and not worth showing).
  const { data: rawBtcHistory } = useQuery({
    queryKey: ['coinHistory', 'BTC', vsCurrency, days],
    queryFn:  () => fetchCoinHistory(COIN_IDS.BTC, vsCurrency, days),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: selectedCoin !== 'BTC',
  })

  const btcCorrelation = useMemo(() => {
    if (selectedCoin === 'BTC' || !rawHistory?.prices?.length || !rawBtcHistory?.prices?.length) return null
    return pearsonCorrelation(rawHistory.prices.map(p => p[1]), rawBtcHistory.prices.map(p => p[1]))
  }, [selectedCoin, rawHistory, rawBtcHistory])

  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  // modalAsset.price is always AUD (DetailModal's primary display expects
  // AUD universally, same convention equities use); nativePrice/currency
  // carry the USD figure for the dual-display sub-line regardless of which
  // unit the table itself is currently showing.
  const handleOpenModal = (coin) => {
    const isAudTable = currency === 'AUD'
    const audPrice = isAudTable ? coin.price : usdToAud(coin.price)
    const usdPrice = isAudTable ? audToUsd(coin.price) : coin.price
    openModal?.({
      symbol: coin.symbol, name: coin.name, price: audPrice,
      pct: coin.pct24h, change: null, type: 'crypto', coinId: COIN_IDS[coin.symbol],
      extra: { currency: 'USD', nativePrice: usdPrice },
    })
  }

  const askAI = (coin) => {
    dispatchAskAI({
      name:   coin.name,
      ticker: coin.symbol,
      price:  `${currPrefix}${coin.price.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`,
      change: `${coin.pct24h >= 0 ? '+' : ''}${coin.pct24h.toFixed(2)}% (24h)`,
      sector: 'Crypto',
      date:   todayAEST(),
    })
  }

  const selectedCoinObj = markets?.find(c => c.symbol === selectedCoin) ?? null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="CRYPTO"
        subtitle="Bitcoin · Ethereum · Top 20 by Market Cap"
        moduleId="crypto"
        isFetching={marketsFetching}
        lastUpdated={rawMarketsResult?.cachedAt}
        onRefresh={refetchMarkets}
      />

      {/* Mobile-only panel switcher (<768px) — the three columns stack
          full-width instead of sitting side by side. */}
      <div className="flex md:hidden border-b border-terminal-border flex-shrink-0">
        {[
          { id:'overview', label:'OVERVIEW' },
          { id:'table',    label:'COINS'    },
          { id:'detail',   label:'DETAIL'   },
        ].map(p => (
          <button key={p.id} onClick={() => setMobilePanel(p.id)}
            className={`flex-1 font-mono text-2xs font-bold tracking-widest py-2 uppercase transition-colors border-b-2 ${
              mobilePanel === p.id ? 'text-terminal-gold border-b-terminal-gold' : 'text-terminal-text-dim border-b-transparent'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      <CryptoMetricRow globalData={globalData} fearGreed={fearGreed} currency={currency} capSparkline={capSparkline} />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ── LEFT: market overview sidebar, resizable (drag right edge),
            scrolls independently of the coin table ── */}
        <ResizablePanel
          defaultWidth={280} minWidth={200} maxWidth={360}
          storageKey="maddex_crypto_left_width" side="right"
          mobileVisible={mobilePanel === 'overview'}
          className="border-r border-terminal-border overflow-y-auto overflow-x-hidden flex-col divide-y divide-terminal-border"
        >
          <MaddenAIPanel momentum={momentum} />
          <HalvingCard />
          <FearGreedPanel data={fearGreed} />
          <DominancePanel globalData={globalData} />
          <TopVolumeList markets={markets} currPrefix={currPrefix} selectedCoin={selectedCoin} onSelect={(s) => { setSelectedCoin(s); setMobilePanel('detail') }} />
          <SectorPerformanceList markets={markets} />
          <AuCryptoContext />
        </ResizablePanel>

        {/* ── CENTRE: elite coin table ── */}
        <div className={`${mobilePanel === 'table' ? 'block' : 'hidden'} md:block flex-1 min-w-0 overflow-auto`} style={{ background: '#0B1628', position: 'relative' }}>
          <div ref={titleBarRef} className="panel-header crypto-title-bar flex items-center gap-2 flex-wrap"
            style={{ position: 'sticky', top: 0, zIndex: 20, background: '#0B1628', borderBottom: '1px solid #0F1E35', margin: 0 }}>
            <span>TOP 20 BY MKT CAP ({currency})</span>
            {rawMarkets && marketsDelayed && <StaleBadge cachedAt={rawMarketsResult?.cachedAt} />}
            {rawMarkets && !marketsDelayed
              ? <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE · {updatedTime}</span>
              : !rawMarkets && !marketsError && <span className="text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>
            }
            {!rawMarkets && marketsError && <span className="text-terminal-red text-2xs font-normal">⚠ UNAVAILABLE</span>}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => { setShowMine((v) => !v); setShowDefi(false); setView3D(false) }}
                className={`text-2xs px-2.5 py-0.5 rounded-full border font-bold tracking-wide transition-colors ${
                  showMine ? 'bg-terminal-gold text-terminal-bg border-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                }`}
              >{showMine ? 'COINS' : 'MY CRYPTO'}</button>
              <button
                onClick={() => { setShowDefi((v) => !v); setView3D(false); setShowMine(false) }}
                className={`text-2xs px-2.5 py-0.5 rounded-full border font-bold tracking-wide transition-colors ${
                  showDefi ? 'bg-terminal-gold text-terminal-bg border-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                }`}
              >{showDefi ? 'COINS' : 'DEFI / ON-CHAIN'}</button>
              <button
                onClick={() => { setView3D((v) => !v); setShowDefi(false); setShowMine(false) }}
                className={`text-2xs px-2.5 py-0.5 rounded-full border font-bold tracking-wide transition-colors ${
                  view3D ? 'bg-terminal-gold text-terminal-bg border-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                }`}
              >{view3D ? '2D TABLE' : '3D VIEW'}</button>
            </div>
          </div>
          <div style={{ position: 'sticky', top: titleBarHeight, zIndex: 15, height: 2, background: '#0B1628', margin: 0, padding: 0 }} />

          {showMine ? (
            <div className="absolute inset-0" style={{ top: titleBarHeight + 2 }}>
              <MyCryptoPanel markets={markets} currPrefix={currPrefix} colorFor={coinColor} />
            </div>
          ) : showDefi ? (
            // Absolutely positioned for the same reason the 3D canvas is —
            // it owns the remaining height below the sticky title bar.
            <div className="absolute inset-0" style={{ top: titleBarHeight + 2 }}>
              <DefiPanel />
            </div>
          ) : marketsError ? (
            <DataUnavailable label="CRYPTO MARKETS UNAVAILABLE" onRetry={refetchMarkets} />
          ) : markets ? (
            view3D ? (
              // Absolute-positioned against the table container's own
              // `position: relative` (set above) rather than a percentage
              // height off titleBarHeight — R3F's Canvas sizes itself via
              // ResizeObserver on its immediate parent, and a %/calc height
              // computed through a flex chain doesn't reliably resolve
              // before that first measurement, leaving the canvas stuck at
              // the browser's intrinsic 300x150 default.
              <div className="absolute inset-0" style={{ top: titleBarHeight + 2 }}>
                <Suspense fallback={<Viz3DLoader />}>
                  <CryptoLandscape3D coins={markets.slice(0, 20)} />
                </Suspense>
              </div>
            ) : (
            <SortableCoinTable
              markets={markets}
              currPrefix={currPrefix}
              usdToAud={usdToAud}
              audToUsd={audToUsd}
              titleBarHeight={titleBarHeight}
              selectedCoin={selectedCoin}
              onRowClick={(coin) => { setSelectedCoin(coin.symbol); setMobilePanel('detail') }}
              onAskAI={askAI}
            />
            )
          ) : (
            <div>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCoinRow key={i} />)}
            </div>
          )}
        </div>

        {/* ── RIGHT: coin detail slide-in, resizable (drag left edge) ── */}
        {selectedCoinObj && (
          <ResizablePanel
            defaultWidth={300} minWidth={240} maxWidth={420}
            storageKey="maddex_crypto_right_width" side="left"
            mobileVisible={mobilePanel === 'detail'}
            className="border-l border-terminal-border overflow-hidden"
          >
            <CoinDetailPanel
              coin={selectedCoinObj}
              currPrefix={currPrefix}
              usdToAud={usdToAud}
              audToUsd={audToUsd}
              chartData={chartData}
              chartLoading={chartLoading}
              historyError={historyError}
              onRetryHistory={refetchHistory}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              btcCorrelation={btcCorrelation}
              onAskAI={askAI}
              onExpand={handleOpenModal}
              onClose={() => { setSelectedCoin(null); setMobilePanel('table') }}
            />
          </ResizablePanel>
        )}
      </div>
    </div>
  )
}

// ── Sortable coin table ────────────────────────────────────────────────────
const COIN_COLUMNS = [
  { key: 'rank',       label: '#',         align: 'right', width: 28,  hideable: false },
  { key: 'symbol',     label: 'COIN',      align: 'left',              hideable: false },
  { key: 'price',      label: 'PRICE', align: 'right',       hideable: false },
  { key: 'pct24h',     label: '24H%',      align: 'right',             hideable: true },
  { key: 'pct7d',      label: '7D%',       align: 'right', cell: 'sm', hideable: true },
  { key: 'marketCap',  label: 'MKT CAP',   align: 'right', cell: 'md', hideable: true },
  { key: 'volume',     label: 'VOLUME 24H', align: 'right', cell: 'lg', hideable: true },
  { key: 'supply',     label: 'SUPPLY',    align: 'right', cell: 'lg', width: 100, hideable: true },
  { key: 'sparkline',  label: '7D CHART',  align: 'right', cell: 'xl', width: 80,  hideable: true },
]

const VISIBLE_COLS_KEY = 'maddex_crypto_visible_cols'
function loadVisibleCols() {
  try {
    const saved = JSON.parse(localStorage.getItem(VISIBLE_COLS_KEY) ?? 'null')
    if (Array.isArray(saved)) return new Set(saved)
  } catch { /* fall through to default */ }
  return new Set(COIN_COLUMNS.map(c => c.key))
}
function saveVisibleCols(set) {
  try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify([...set])) } catch { /* best-effort */ }
}

// Gear-icon dropdown checklist — shows/hides table columns, persisted.
function ColumnSelector({ visibleCols, onToggle }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])
  return (
    <div ref={ref} className="relative ml-auto flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        title="Show/hide columns"
        className="text-terminal-text-dim hover:text-terminal-gold text-2xs px-1.5 py-0.5 border border-terminal-border hover:border-terminal-gold/40 transition-colors"
      >⚙</button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-terminal-panel border border-terminal-border-gold py-1 shadow-lg" style={{ minWidth: 160 }}>
          {COIN_COLUMNS.filter(c => c.hideable).map(c => (
            <label key={c.key} className="flex items-center gap-2 px-2.5 py-1 text-2xs text-terminal-text hover:bg-terminal-surface2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleCols.has(c.key)}
                onChange={() => onToggle(c.key)}
                className="accent-terminal-gold"
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function SortableCoinTable({ markets, currPrefix, usdToAud, audToUsd, titleBarHeight, selectedCoin, onRowClick }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [visibleCols, setVisibleCols] = useState(loadVisibleCols)

  const toggleColumn = (key) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      saveVisibleCols(next)
      return next
    })
  }

  const toggleSort = (key) => {
    if (!['rank', 'symbol', 'price', 'pct24h', 'pct7d', 'marketCap', 'volume'].includes(key)) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = sortKey ? [...markets].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortDir === 'asc' ? cmp : -cmp
  }) : markets

  const cols = COIN_COLUMNS.filter(c => !c.hideable || visibleCols.has(c.key))
  const show = (key) => !COIN_COLUMNS.find(c => c.key === key)?.hideable || visibleCols.has(key)

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead style={{ position: 'sticky', top: titleBarHeight + 2, zIndex: 10 }}>
        <tr style={{ background: '#0B1628', borderBottom: '1px solid #C9A84C' }}>
          {cols.map(col => (
            <th
              key={col.key}
              onClick={() => toggleSort(col.key)}
              style={{ ...HEAD, textAlign: col.align, width: col.width, minWidth: col.width, cursor: 'pointer' }}
              className={col.cell === 'sm' ? 'hidden sm:table-cell' : col.cell === 'md' ? 'hidden md:table-cell' : col.cell === 'lg' ? 'hidden lg:table-cell' : col.cell === 'xl' ? 'hidden xl:table-cell' : ''}
            >
              {col.label}
              {sortKey === col.key && <span style={{ color: '#C9A84C', marginLeft: 3 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </th>
          ))}
          <th style={{ ...HEAD, textAlign: 'right', width: 28, cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
            <ColumnSelector visibleCols={visibleCols} onToggle={toggleColumn} />
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(coin => {
          // Rows are priced in the selected currency (currPrefix). The second
          // line is the other currency, converted once — this used to label an
          // AUD price "US$" and then convert it to AUD again, overstating every
          // AUD figure by the exchange rate.
          const isAud = currPrefix === 'A$'
          const otherPrice = isAud ? audToUsd?.(coin.price) : usdToAud?.(coin.price)
          const supplyPct = coin.maxSupply ? Math.min(100, (coin.circulatingSupply / coin.maxSupply) * 100) : null
          const isSelected = coin.symbol === selectedCoin
          return (
            <tr key={coin.symbol}
              // At (within 0.1% of) its 24h high: one green pulse on render.
              className={coin.high24h != null && coin.price >= coin.high24h * 0.999 ? 'high-pulse-once' : undefined}
              title={coin.high24h != null && coin.price >= coin.high24h * 0.999 ? 'Trading at its 24h high' : undefined}
              style={{
                height: 36, borderBottom: '1px solid rgba(13,34,68,0.4)', cursor: 'pointer',
                background: isSelected ? 'rgba(201,168,76,0.08)' : 'transparent',
                boxShadow: isSelected ? 'inset 3px 0 0 #C9A84C' : 'none',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(201,168,76,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(201,168,76,0.08)' : 'transparent' }}
              onClick={() => onRowClick(coin)}>
              <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }}>{coin.rank}</td>
              <td style={{ ...CELL, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CoinCircle symbol={coin.symbol} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-bright)' }}>{coin.symbol}</div>
                    <div style={{ fontSize: 9, color: 'var(--color-text-dim)' }} className="hidden xl:block">{coin.name}</div>
                  </div>
                </div>
              </td>
              <td style={{ ...CELL, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 700, fontFamily: 'IBM Plex Mono' }}>
                  {currPrefix}{coin.price.toLocaleString('en-AU', { minimumFractionDigits: coin.price < 1 ? 4 : 2, maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                </div>
                <div style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>
                  {otherPrice != null ? `${isAud ? 'US$' : 'A$'}${otherPrice.toLocaleString('en-AU', { maximumFractionDigits: otherPrice < 1 ? 4 : 2 })}` : ''}
                </div>
              </td>
              {show('pct24h') && (
                <td style={{ ...CELL, textAlign: 'right' }}>
                  <PriceChange pct={coin.pct24h} className="justify-end" />
                </td>
              )}
              {show('pct7d') && (
                <td style={{ ...CELL, textAlign: 'right' }} className="hidden sm:table-cell">
                  <PriceChange pct={coin.pct7d} className="justify-end" />
                </td>
              )}
              {show('marketCap') && (
                <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }} className="hidden md:table-cell">
                  {currPrefix}{coin.mktCap}
                </td>
              )}
              {show('volume') && (
                <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }} className="hidden lg:table-cell">
                  {currPrefix}{coin.vol24h}
                </td>
              )}
              {/* Supply bar — circulating/max, gold fill */}
              {show('supply') && (
                <td style={{ ...CELL, textAlign: 'right' }} className="hidden lg:table-cell">
                  {supplyPct != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <div style={{ width: 44, height: 4, background: 'rgba(100,120,160,0.2)', borderRadius: 2, flexShrink: 0 }}>
                        <div style={{ width: `${supplyPct}%`, height: '100%', borderRadius: 2, background: '#C9A84C' }} />
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--color-text-dim)', width: 28, textAlign: 'right' }}>{supplyPct.toFixed(0)}%</span>
                    </div>
                  ) : <span style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>∞</span>}
                </td>
              )}
              {show('sparkline') && (
                <td style={{ ...CELL, textAlign: 'right' }} className="hidden xl:table-cell">
                  <Sparkline prices={coin.sparkline} pct={coin.pct7d} w={60} h={24} />
                </td>
              )}
              <td style={{ ...CELL, width: 28 }} />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
