import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCoinHistory, fetchFearGreed, fetchCryptoGlobal,
  transformCryptoMarkets, transformCoinHistory, transformFearGreed,
  COIN_IDS,
} from '../../services/api'
import { fetchCryptoMarketsUnified } from '../../services/dataService'
import { calculateCryptoMomentumIndex, scoreToColor } from '../../services/maddenAiScoring'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt } from '../../utils/format'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { DataUnavailable } from '../../components/ui/DataUnavailable'
import { ModuleLoader, StaleBadge } from '../../components/ui/ModuleStates'
import ModuleHeader from '../../components/ui/ModuleHeader'
import PriceChange from '../../components/ui/PriceChange'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ── Coin colour circle (deterministic hash, not a real logo — Bloomberg-
// terminal-style abstract avatar rather than brand marks) ──────────────────
const CIRCLE_PALETTE = ['#f7931a', '#627eea', '#9945ff', '#00d4ff', '#f0b90b', '#26a17b', '#e84142', '#2775ca', '#8247e5', '#c8a84b']
// Real (approximate) brand colours for the coins that actually show up in
// the top-20 list — hash-based colour is only a fallback for the long tail.
const COIN_COLORS = {
  BTC: '#f7931a', ETH: '#627eea', XRP: '#0d3b66', SOL: '#9945ff', BNB: '#f0b90b',
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

function Sparkline({ prices, pct, w = 60, h = 28 }) {
  if (!prices?.length) return <span style={{ display: 'inline-block', width: w }} />
  const sampled = prices.filter((_, i) => i % 4 === 0)
  const min = Math.min(...sampled), max = Math.max(...sampled)
  const range = max - min || 1
  const pts = sampled.map((p, i) =>
    `${(i / (sampled.length - 1)) * w},${h - ((p - min) / range) * (h - 2) - 1}`
  ).join(' ')
  const color = (pct ?? 0) >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
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
  const val = payload[0].value
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
              <span style={{ fontSize: 10, fontWeight: 700, color: selectedCoin === c.symbol ? '#c8a84b' : '#e8ecf0' }}>{c.symbol}</span>
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
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, color: 'rgba(100,130,160,0.7)' }}>
                {s.name} <span style={{ color: 'rgba(100,130,160,0.4)' }}>({s.count})</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: s.avg >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
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

const P = {
  wrap:  { flex:1, display:'flex', flexDirection:'column', padding:'8px 10px', overflow:'hidden', boxSizing:'border-box' },
  title: { fontSize:9, fontWeight:700, color:'#c8a84b', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' },
  empty: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'rgba(100,130,160,0.5)' },
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
  const getColor = (v) =>
    v >= 75 ? 'var(--color-gain-bright)' : v >= 55 ? 'var(--color-neutral)' :
    v >= 45 ? '#f0c040' : v >= 25 ? '#ff8c00' : 'var(--color-loss-bright)'
  if (!data) return <div style={P.wrap}><div style={P.title}>FEAR &amp; GREED</div><div style={P.empty}>LOADING...</div></div>
  const { value, label, prev, weekAgo } = data
  const color = getColor(value)
  return (
    <div style={P.wrap}>
      <div style={P.title}>FEAR &amp; GREED</div>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <svg viewBox="0 0 100 66" style={{ width:120, height:80, flexShrink:0 }}>
          <path d="M 8 54 A 42 42 0 0 1 92 54" fill="none" stroke="#0d2244" strokeWidth="9" />
          <path d="M 8 54 A 42 42 0 0 1 92 54" fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={`${(value / 100) * 131.9} 131.9`} strokeLinecap="butt" />
          <text x="50" y="48" textAnchor="middle" fill={color} fontSize="26" fontFamily="IBM Plex Mono" fontWeight="700">{value}</text>
          <text x="10" y="64" textAnchor="start" fill="var(--color-loss)" fontSize="6" fontFamily="IBM Plex Mono" letterSpacing="0.05em">FEAR</text>
          <text x="50" y="64" textAnchor="middle" fill="#c8a84b" fontSize="6" fontFamily="IBM Plex Mono" letterSpacing="0.05em">NEUTRAL</text>
          <text x="90" y="64" textAnchor="end" fill="var(--color-gain)" fontSize="6" fontFamily="IBM Plex Mono" letterSpacing="0.05em">GREED</text>
        </svg>
        <div style={{ fontSize:9 }}>
          <div style={{ fontSize:12, fontWeight:700, color, marginBottom:4 }}>{label.toUpperCase()}</div>
          <div style={{ color:'rgba(100,130,160,0.5)', marginBottom:2 }}>PREV: <span style={{ color:getColor(prev) }}>{prev}</span></div>
          <div style={{ color:'rgba(100,130,160,0.5)' }}>7D: <span style={{ color:getColor(weekAgo) }}>{weekAgo}</span></div>
        </div>
      </div>
    </div>
  )
}

function MarketPulsePanel({ globalData, currency, capSparkline }) {
  if (!globalData) return <div style={P.wrap}><div style={P.title}>TOTAL MARKET CAP</div><div style={P.empty}>LOADING...</div></div>
  const ccy = currency === 'AUD' ? 'aud' : 'usd'
  const sym = currency === 'AUD' ? 'A$' : 'US$'
  const cap = globalData.total_market_cap?.[ccy]
  const vol = globalData.total_volume?.[ccy]
  const chg = globalData.market_cap_change_percentage_24h_usd
  const coins = globalData.active_cryptocurrencies
  const fmtB = (v) => {
    if (!v) return '—'
    if (v >= 1e12) return `${sym}${(v/1e12).toFixed(2)}T`
    if (v >= 1e9)  return `${sym}${(v/1e9).toFixed(1)}B`
    return `${sym}${v.toFixed(0)}`
  }
  const chgColor = chg >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  return (
    <div style={P.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={P.title}>TOTAL MARKET CAP</div>
        {capSparkline?.length > 1 && <Sparkline prices={capSparkline} pct={chg} />}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#e8ecf0', fontFamily: 'IBM Plex Mono', marginBottom: 2 }}>
        {fmtB(cap)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: chgColor, marginBottom: 6 }}>
        {chg != null ? `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}% (24h)` : '—'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px', fontSize:9 }}>
        {[
          { label:'VOLUME', value: fmtB(vol), color:'#d4dce8' },
          { label:'COINS', value: coins?.toLocaleString() ?? '—', color:'#d4dce8' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ color:'rgba(100,130,160,0.55)', fontSize:8 }}>{label}</div>
            <div style={{ color, fontWeight:600 }}>{value}</div>
          </div>
        ))}
      </div>
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

function DominanceArc({ pct, color, size = 56 }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0d2244" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size * 0.22} fontFamily="IBM Plex Mono" fontWeight="700">
        {pct.toFixed(0)}%
      </text>
    </svg>
  )
}

function DominancePanel({ globalData }) {
  const btcYesterday = btcDomYesterday()

  useEffect(() => {
    const btc = globalData?.market_cap_percentage?.btc
    if (btc != null) writeBtcDomHistory(btc)
  }, [globalData])

  if (!globalData) return <div style={P.wrap}><div style={P.title}>BTC DOMINANCE</div><div style={P.empty}>LOADING...</div></div>
  const pct = globalData.market_cap_percentage ?? {}
  const btc = pct.btc ?? 0
  const eth = pct.eth ?? 0
  const sol = pct.sol ?? 0
  const others = Math.max(0, 100 - btc - eth - sol)
  const bars = [
    { label:'BTC', pct:btc,    color:'#f7931a' },
    { label:'ETH', pct:eth,    color:'#627eea' },
    { label:'SOL', pct:sol,    color:'#9945ff' },
    { label:'OTHERS', pct:others, color:'rgba(100,130,160,0.35)' },
  ]
  const delta = btcYesterday != null ? btc - btcYesterday : null
  return (
    <div style={P.wrap}>
      <div style={P.title}>BTC DOMINANCE</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <DominanceArc pct={btc} color="#f7931a" />
        <div>
          <div style={{ fontSize: 9, color: 'rgba(100,130,160,0.6)' }}>of total mkt cap</div>
          {delta != null && (
            <div style={{ fontSize: 10, fontWeight: 600, color: delta >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}pp vs yday
            </div>
          )}
        </div>
      </div>
      <div style={{ height:6, display:'flex', borderRadius:2, overflow:'hidden', marginBottom:5 }}>
        {bars.map(b => <div key={b.label} style={{ width:`${b.pct}%`, background:b.color, transition:'width 0.5s' }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px' }}>
        {bars.map(b => (
          <div key={b.label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9 }}>
            <span style={{ width:6, height:6, borderRadius:1, background:b.color, flexShrink:0 }} />
            <span style={{ color:'rgba(100,130,160,0.6)', fontSize:8 }}>{b.label}</span>
            <span style={{ color:'#d4dce8', fontWeight:600, marginLeft:'auto' }}>{b.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
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

function CoinDetailPanel({ coin, currPrefix, usdToAud, chartData, chartLoading, historyError, onRetryHistory, timeframe, onTimeframeChange, btcCorrelation, onAskAI, onExpand, onClose }) {
  if (!coin) return null
  const audPrice = usdToAud(coin.price)
  const statRows = [
    ['MCap',        `${currPrefix}${coin.mktCap}`],
    ['Vol 24H',     `${currPrefix}${coin.vol24h}`],
    ['Circ Supply', coin.circulatingSupply ? coin.circulatingSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'],
    ['Max Supply',  coin.maxSupply ? coin.maxSupply.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '∞'],
    ['ATH',         coin.ath != null ? `US$${coin.ath.toLocaleString(undefined, { maximumFractionDigits: coin.ath < 1 ? 4 : 2 })}` : '—'],
    ['From ATH',    coin.athPct != null ? `${coin.athPct.toFixed(1)}%` : '—'],
    ['ATL',         coin.atl != null ? `US$${coin.atl.toLocaleString(undefined, { maximumFractionDigits: coin.atl < 1 ? 4 : 2 })}` : '—'],
    ['From ATL',    coin.atlPct != null ? `+${coin.atlPct.toFixed(0)}%` : '—'],
  ]
  return (
    <div className="flex flex-col h-full overflow-y-auto hide-scrollbar panel-slide-in">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <CoinCircle symbol={coin.symbol} size={32} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-terminal-text-bright truncate">{coin.name}</div>
            <div className="text-2xs text-terminal-text-dim">{coin.symbol} · Rank #{coin.rank}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text text-sm flex-shrink-0">✕</button>
      </div>

      <div className="px-3 py-3 border-b border-terminal-border/50">
        <div className="text-xl font-bold text-terminal-text-bright font-mono">
          US${coin.price.toLocaleString('en-US', { maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
        </div>
        <div className="text-2xs text-terminal-text-dim mt-0.5">{fmt.aud(audPrice)}</div>
        <div className={`text-xs font-semibold mt-1 ${coin.pct24h >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {coin.pct24h >= 0 ? '▲' : '▼'} {Math.abs(coin.pct24h).toFixed(2)}% (24h)
        </div>
      </div>

      <div className="px-3 py-2.5 border-b border-terminal-border/50 grid grid-cols-2 gap-x-3 gap-y-2">
        {statRows.map(([label, value]) => (
          <div key={label}>
            <div className="text-[9px] text-terminal-text-dim uppercase tracking-wide">{label}</div>
            <div className="text-2xs text-terminal-text-bright font-semibold mt-0.5">{value}</div>
          </div>
        ))}
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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c8a84b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#c8a84b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 7 }} interval="preserveStartEnd" />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip currency="USD" />} />
                <Area type="monotone" dataKey="price" stroke="#c8a84b" strokeWidth={1.5}
                  fill="url(#detailGrad)" dot={false} isAnimationActive={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
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

// ── Shared cell styles ─────────────────────────────────────────────────────────

const CELL = { padding: '5px 8px', fontSize: '10px', verticalAlign: 'middle', position: 'static' }
const HEAD = { padding: '6px 8px', fontSize: '9px', color: '#c8a84b', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#071428', verticalAlign: 'middle' }

// ── Main Module ────────────────────────────────────────────────────────────────

export default function CryptoModule() {
  const [selectedCoin, setSelectedCoin] = useState('BTC')
  const [timeframe, setTimeframe]       = useState('3M')
  const [titleBarHeight, setTitleBarHeight] = useState(28)
  // Mobile only (<768px) — the overview/table/detail columns stack instead
  // of sitting side by side, so a small screen needs an explicit switcher.
  const [mobilePanel, setMobilePanel] = useState('table')
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

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ── LEFT: market overview sidebar, 240px ── */}
        <div className={`${mobilePanel === 'overview' ? 'flex' : 'hidden'} md:flex w-full md:w-[240px] md:min-w-[240px] flex-shrink-0 border-r border-terminal-border overflow-y-auto hide-scrollbar flex-col divide-y divide-terminal-border`}>
          <MaddenAIPanel momentum={momentum} />
          <MarketPulsePanel globalData={globalData} currency={currency} capSparkline={capSparkline} />
          <FearGreedPanel data={fearGreed} />
          <DominancePanel globalData={globalData} />
          <TopVolumeList markets={markets} currPrefix={currPrefix} selectedCoin={selectedCoin} onSelect={(s) => { setSelectedCoin(s); setMobilePanel('detail') }} />
          <SectorPerformanceList markets={markets} />
        </div>

        {/* ── CENTRE: elite coin table ── */}
        <div className={`${mobilePanel === 'table' ? 'block' : 'hidden'} md:block flex-1 min-w-0 overflow-auto`} style={{ background: '#071428', position: 'relative' }}>
          <div ref={titleBarRef} className="panel-header crypto-title-bar flex items-center gap-2 flex-wrap"
            style={{ position: 'sticky', top: 0, zIndex: 20, background: '#071428', borderBottom: '1px solid #0d2244', margin: 0 }}>
            <span>TOP 20 BY MKT CAP ({currency})</span>
            {rawMarkets && marketsDelayed && <StaleBadge cachedAt={rawMarketsResult?.cachedAt} />}
            {rawMarkets && !marketsDelayed
              ? <span className="text-terminal-green text-2xs font-normal normal-case">● LIVE · {updatedTime}</span>
              : !rawMarkets && !marketsError && <span className="text-terminal-text-dim text-2xs font-normal animate-pulse">LOADING...</span>
            }
            {!rawMarkets && marketsError && <span className="text-terminal-red text-2xs font-normal">⚠ UNAVAILABLE</span>}
          </div>
          <div style={{ position: 'sticky', top: titleBarHeight, zIndex: 15, height: 2, background: '#071428', margin: 0, padding: 0 }} />

          {marketsError ? (
            <DataUnavailable label="CRYPTO MARKETS UNAVAILABLE" onRetry={refetchMarkets} />
          ) : markets ? (
            <SortableCoinTable
              markets={markets}
              currPrefix={currPrefix}
              usdToAud={usdToAud}
              titleBarHeight={titleBarHeight}
              selectedCoin={selectedCoin}
              onRowClick={(coin) => { setSelectedCoin(coin.symbol); setMobilePanel('detail') }}
              onAskAI={askAI}
            />
          ) : <ModuleLoader name="CRYPTO" />}
        </div>

        {/* ── RIGHT: coin detail slide-in, 280px ── */}
        {selectedCoinObj && (
          <div className={`${mobilePanel === 'detail' ? 'block' : 'hidden'} md:block w-full md:w-[280px] md:min-w-[280px] flex-shrink-0 border-l border-terminal-border overflow-hidden`}>
            <CoinDetailPanel
              coin={selectedCoinObj}
              currPrefix={currPrefix}
              usdToAud={usdToAud}
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
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sortable coin table ────────────────────────────────────────────────────
const COIN_COLUMNS = [
  { key: 'rank',       label: '#',         align: 'right', width: 28 },
  { key: 'symbol',     label: 'COIN',      align: 'left' },
  { key: 'price',      label: 'PRICE (USD/AUD)', align: 'right' },
  { key: 'pct24h',     label: '24H%',      align: 'right' },
  { key: 'pct7d',      label: '7D%',       align: 'right', cell: 'sm' },
  { key: 'marketCap',  label: 'MKT CAP',   align: 'right', cell: 'md' },
  { key: 'volume',     label: 'VOLUME 24H', align: 'right', cell: 'lg' },
  { key: 'supply',     label: 'SUPPLY',    align: 'right', cell: 'lg', width: 100 },
  { key: 'sparkline',  label: '7D CHART',  align: 'right', cell: 'xl' },
]

function SortableCoinTable({ markets, currPrefix, usdToAud, titleBarHeight, selectedCoin, onRowClick }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

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

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead style={{ position: 'sticky', top: titleBarHeight + 2, zIndex: 10 }}>
        <tr style={{ background: '#071428', borderBottom: '1px solid #c8a84b' }}>
          {COIN_COLUMNS.map(col => (
            <th
              key={col.key}
              onClick={() => toggleSort(col.key)}
              style={{ ...HEAD, textAlign: col.align, width: col.width, minWidth: col.width, cursor: 'pointer' }}
              className={col.cell === 'sm' ? 'hidden sm:table-cell' : col.cell === 'md' ? 'hidden md:table-cell' : col.cell === 'lg' ? 'hidden lg:table-cell' : col.cell === 'xl' ? 'hidden xl:table-cell' : ''}
            >
              {col.label}
              {sortKey === col.key && <span style={{ color: '#c8a84b', marginLeft: 3 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(coin => {
          const audPrice = usdToAud(coin.price)
          const supplyPct = coin.maxSupply ? Math.min(100, (coin.circulatingSupply / coin.maxSupply) * 100) : null
          const isSelected = coin.symbol === selectedCoin
          return (
            <tr key={coin.symbol}
              style={{
                height: 36, borderBottom: '1px solid rgba(13,34,68,0.4)', cursor: 'pointer',
                background: isSelected ? 'rgba(201,168,76,0.08)' : 'transparent',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(26,127,232,0.08)' }}
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
                  US${coin.price.toLocaleString('en-US', { maximumFractionDigits: coin.price < 1 ? 4 : 2 })}
                </div>
                <div style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>
                  {fmt.aud(audPrice)}
                </div>
              </td>
              <td style={{ ...CELL, textAlign: 'right' }}>
                <PriceChange pct={coin.pct24h} className="justify-end" />
              </td>
              <td style={{ ...CELL, textAlign: 'right' }} className="hidden sm:table-cell">
                <PriceChange pct={coin.pct7d} className="justify-end" />
              </td>
              <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }} className="hidden md:table-cell">
                {currPrefix}{coin.mktCap}
              </td>
              <td style={{ ...CELL, textAlign: 'right', color: 'var(--color-text-dim)' }} className="hidden lg:table-cell">
                {currPrefix}{coin.vol24h}
              </td>
              {/* Supply bar — circulating/max, gold fill */}
              <td style={{ ...CELL, textAlign: 'right' }} className="hidden lg:table-cell">
                {supplyPct != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <div style={{ width: 44, height: 4, background: 'rgba(100,120,160,0.2)', borderRadius: 2, flexShrink: 0 }}>
                      <div style={{ width: `${supplyPct}%`, height: '100%', borderRadius: 2, background: '#c8a84b' }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--color-text-dim)', width: 28, textAlign: 'right' }}>{supplyPct.toFixed(0)}%</span>
                  </div>
                ) : <span style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>∞</span>}
              </td>
              <td style={{ ...CELL, textAlign: 'right' }} className="hidden xl:table-cell">
                <Sparkline prices={coin.sparkline} pct={coin.pct7d} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
