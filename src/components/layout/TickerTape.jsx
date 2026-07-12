import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCryptoMarkets, transformCryptoMarkets,
  fetchYFBatch, YF_INDICES,
  fetchFxRates, transformFxRates,
  fetchMetalsRates, extractMetals,
} from '../../services/api'
import { useStore } from '../../store/useStore'
import { fmt, formatMarketCap } from '../../utils/format'

const INDEX_SYMS  = ['^AXJO', '^GSPC', '^IXIC']
const INDEX_LABELS = { '^AXJO':'ASX 200', '^GSPC':'S&P 500', '^IXIC':'NASDAQ' }
const CRYPTO_COINS = ['BTC','ETH','SOL','BNB','XRP']

const fmtAUD  = (v) => `A$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pctCls  = (p) => (p > 0 ? 'text-terminal-green' : p < 0 ? 'text-terminal-red' : 'text-terminal-text-dim')
const arrow   = (p) => (p > 0 ? '▲' : p < 0 ? '▼' : '—')

// Inline style tokens for sub-element colouring (layout handled by CSS classes)
const S = {
  pipe:   { color: '#c8a84b', opacity: 0.7 },
  dlabel: { color: '#c8a84b', fontWeight: 700, letterSpacing: '0.08em', fontSize: 10 },
  sym:    { color: '#d4dce8', fontWeight: 600 },
  dash:   { color: '#2d4a6a' },
  price:  { color: '#a8b8cc' },
  gain:   { color: '#22c55e', fontWeight: 600 },
  loss:   { color: '#ef4444', fontWeight: 600 },
  flat:   { color: '#6b7280' },
}

function Divider({ label }) {
  return (
    <span className="ticker-divider">
      <span style={S.pipe}>│</span>
      <span style={S.dlabel}>{label}</span>
    </span>
  )
}

function TapeItem({ sym, price, pct, marketCap, onClick }) {
  const tooltip = [price, pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : null, marketCap ? `MKT CAP ${formatMarketCap(marketCap)}` : null].filter(Boolean).join(' · ')
  const pctStyle = pct == null ? null : pct > 0 ? S.gain : pct < 0 ? S.loss : S.flat
  return (
    <span className="ticker-item" title={tooltip || undefined} onClick={onClick}>
      <span style={S.sym}>{sym}</span>
      <span style={S.dash}>—</span>
      {price != null && <span style={S.price}>{price}</span>}
      {pct != null && (
        <span style={pctStyle}>
          {arrow(pct)} {Math.abs(pct).toFixed(2)}%
        </span>
      )}
    </span>
  )
}

export default function TickerTape() {
  const { openModal } = useStore()
  const qc = useQueryClient()

  const { data: rawMarkets } = useQuery({
    queryKey:  ['cryptoMarkets', 'aud'],
    queryFn:   () => fetchCryptoMarkets('aud'),
    staleTime: 60_000,
    retry: 1,
  })

  const { data: indexQuotes, error: indexError } = useQuery({
    queryKey:  ['yfBatch', 'indices'],
    queryFn:   () => fetchYFBatch(YF_INDICES.map(i => i.symbol)),
    staleTime: 60_000,
    retry: 1,
  })

  const { data: rawFx } = useQuery({
    queryKey:  ['fxRates'],
    queryFn:   () => fetchFxRates('AUD'),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const { data: metalsRates } = useQuery({
    queryKey:  ['metalsRates'],
    queryFn:   fetchMetalsRates,
    staleTime: 10 * 60_000,
    retry: 1,
  })

  // ── Build section items ─────────────────────────────────────────────────────

  const sectionBlocks = []

  // ▲▼ MOVERS — top 3 gainers + top 3 losers from CoinGecko
  if (rawMarkets) {
    const { data: coinList, currency: coinCcy } = rawMarkets
    const markets = transformCryptoMarkets(coinList, coinCcy)
    const sorted = markets.filter(c => c.pct24h != null).sort((a, b) => b.pct24h - a.pct24h)
    const gainers = sorted.slice(0, 3)
    const losers  = [...sorted].reverse().slice(0, 3)
    const moverItems = [...gainers, ...losers].map(c => ({
      sym:       c.symbol,
      price:     fmtAUD(c.price),
      pct:       c.pct24h,
      marketCap: c.marketCap ?? null,
      onClick: () => openModal?.({ symbol: c.symbol, name: c.name, price: c.price, pct: c.pct24h, type: 'crypto' }),
    }))
    if (moverItems.length) sectionBlocks.push({ label: '▲▼ MOVERS', items: moverItems })
  }

  // ◆ CRYPTO — BTC/ETH/SOL/BNB/XRP AUD prices
  if (rawMarkets) {
    const { data: coinList, currency: coinCcy } = rawMarkets
    const markets = transformCryptoMarkets(coinList, coinCcy)
    const cryptoItems = CRYPTO_COINS.map(sym => {
      const coin = markets.find(c => c.symbol === sym)
      if (!coin) return null
      return {
        sym,
        price:     fmtAUD(coin.price),
        pct:       coin.pct24h,
        marketCap: coin.marketCap ?? null,
        onClick: () => openModal?.({ symbol: sym, name: coin.name, price: coin.price, pct: coin.pct24h, type: 'crypto' }),
      }
    }).filter(Boolean)
    if (cryptoItems.length) sectionBlocks.push({ label: '◆ CRYPTO', items: cryptoItems })
  }

  // 📊 INDICES — ASX200/S&P500/NASDAQ via Stooq
  if (indexQuotes) {
    const indexItems = INDEX_SYMS.map(sym => {
      const q = indexQuotes[sym]
      if (!q || isNaN(q.last)) return null
      return {
        sym:   INDEX_LABELS[sym],
        price: `${Number(q.last).toLocaleString('en-AU', { maximumFractionDigits: 0 })} pts`,
        pct:   q.pct,
      }
    }).filter(Boolean)
    if (indexItems.length) sectionBlocks.push({ label: '📊 INDICES', items: indexItems })
  }

  // 💱 FX — AUD/USD, AUD/EUR, AUD/JPY, AUD/GBP
  if (rawFx) {
    const FX_PAIRS = ['AUD/USD', 'AUD/EUR', 'AUD/JPY', 'AUD/GBP']
    const pairs = transformFxRates(rawFx)
    const fxItems = FX_PAIRS.map(pair => {
      const p = pairs.find(x => x.pair === pair)
      if (!p) return null
      const dec = pair.includes('JPY') ? 2 : 4
      return { sym: pair, price: p.mid?.toFixed(dec), pct: null }
    }).filter(Boolean)
    if (fxItems.length) sectionBlocks.push({ label: '💱 FX', items: fxItems })
  }

  // 🛢 COMMODITIES — Gold / Silver AUD
  if (metalsRates) {
    const metals = extractMetals(metalsRates)
    const commItems = metals.map(m => ({
      sym:   m.name.includes('GOLD') ? 'GOLD' : 'SILVER',
      price: fmtAUD(parseFloat(m.price)),
      pct:   null,
    }))
    if (commItems.length) sectionBlocks.push({ label: '🛢 COMMODITIES', items: commItems })
  }

  // Placeholder while data loads — keeps tape moving and never empty
  const PLACEHOLDERS = [
    { label: '◆ CRYPTO', items: [{ sym: 'BTC', price: '—', pct: null }, { sym: 'ETH', price: '—', pct: null }] },
    { label: '📊 INDICES', items: [{ sym: 'ASX 200', price: '—', pct: null }, { sym: 'S&P 500', price: '—', pct: null }] },
    { label: '💱 FX', items: [{ sym: 'AUD/USD', price: '—', pct: null }] },
  ]
  const blocks = sectionBlocks.length ? sectionBlocks : PLACEHOLDERS

  // Flatten then duplicate for seamless -50% loop.
  // Keys must be unique across both halves so React doesn't see duplicates
  // and remount nodes during data refresh (which would reset the animation).
  const content = blocks.flatMap((block, bi) => [
    { type: 'div', key: `d${bi}`, label: block.label },
    ...block.items.map((item, ii) => ({ type: 'item', key: `${bi}-${ii}`, ...item })),
  ])

  return (
    <div className="ticker-container">
      <div className="ticker-content">
        {content.map(el =>
          el.type === 'div'
            ? <Divider key={`a-${el.key}`} label={el.label} />
            : <TapeItem key={`a-${el.key}`} sym={el.sym} price={el.price} pct={el.pct} marketCap={el.marketCap} onClick={el.onClick} />
        )}
        {content.map(el =>
          el.type === 'div'
            ? <Divider key={`b-${el.key}`} label={el.label} />
            : <TapeItem key={`b-${el.key}`} sym={el.sym} price={el.price} pct={el.pct} marketCap={el.marketCap} onClick={el.onClick} />
        )}
      </div>
    </div>
  )
}
