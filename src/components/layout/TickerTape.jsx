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

function Divider({ label }) {
  return (
    <span className="inline-flex items-center gap-1 mx-4 text-terminal-gold font-bold tracking-wider whitespace-nowrap">
      <span className="text-terminal-border/50 mr-1">│</span>
      {label}
    </span>
  )
}

function TapeItem({ sym, price, pct, marketCap, onClick }) {
  const cls     = pctCls(pct)
  const tooltip = [price, pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : null, marketCap ? `MKT CAP ${formatMarketCap(marketCap)}` : null].filter(Boolean).join(' · ')
  return (
    <span
      title={tooltip || undefined}
      className={`inline-flex items-center gap-1.5 mr-6 whitespace-nowrap ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      <span className="text-terminal-text-bright font-semibold">{sym}</span>
      <span className="text-terminal-text-dim">—</span>
      {price != null && <span className="text-terminal-text">{price}</span>}
      {pct != null && (
        <span className={`font-semibold ${cls}`}>
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

  if (!sectionBlocks.length) {
    return (
      <div className="bg-terminal-header border-b border-terminal-border py-0.5 overflow-hidden flex-shrink-0">
        <div className="px-3 py-0.5 text-2xs text-terminal-text-dim animate-pulse">LOADING LIVE PRICES...</div>
      </div>
    )
  }

  // Flatten into a single ordered list then duplicate for seamless loop.
  // The outer .ticker-content div is never remounted on data refresh,
  // so the CSS animation plays uninterrupted when React updates children.
  const content = sectionBlocks.flatMap((block, bi) => [
    { type: 'div', key: `d${bi}`, label: block.label },
    ...block.items.map((item, ii) => ({ type: 'item', key: `${bi}-${ii}`, ...item })),
  ])
  const doubled = [...content, ...content]

  return (
    <div className="bg-terminal-header border-b border-terminal-border py-0.5 overflow-hidden flex-shrink-0">
      <div className="ticker-wrap">
        <div className="ticker-content text-2xs">
          {doubled.map(el =>
            el.type === 'div'
              ? <Divider key={el.key} label={el.label} />
              : <TapeItem key={el.key} sym={el.sym} price={el.price} pct={el.pct} marketCap={el.marketCap} onClick={el.onClick} />
          )}
        </div>
      </div>
    </div>
  )
}
