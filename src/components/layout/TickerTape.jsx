import { memo } from 'react'
import { useLivePrice } from '../../hooks/useLivePrice'
import { useQuery } from '@tanstack/react-query'
import {
  transformCryptoMarkets,
  YF_INDICES,
  transformFxRates,
  fetchMetalsRates, extractMetals,
  ASX_STOCKS, US_STOCKS, toAUD,
} from '../../services/api'
import { fetchEquityQuotes, fetchIndexQuotesUnified, fetchFxRatesUnified, fetchCryptoMarketsUnified } from '../../services/dataService'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt, formatMarketCap } from '../../utils/format'

// All 10 benchmark indices — same set/order as IndicesTable's benchmark bar —
// shown at the start of the tape, ahead of individual stocks.
const INDEX_SYMS = [
  '^AXJO', '^AORD', '^GSPC', '^IXIC', '^DJI', '^FTSE', '^N225', '^HSI', '^GDAXI', '000001.SS',
]
const INDEX_LABELS = {
  '^AXJO': 'ASX 200', '^AORD': 'All Ords', '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ',
  '^DJI': 'Dow Jones', '^FTSE': 'FTSE 100', '^N225': 'Nikkei 225', '^HSI': 'Hang Seng',
  '^GDAXI': 'DAX', '000001.SS': 'Shanghai',
}
const CRYPTO_COINS = ['BTC','ETH','SOL','BNB','XRP']

const fmtAUD  = (v) => `A$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const arrow   = (p) => (p > 0 ? '▲' : p < 0 ? '▼' : '—')

// Inline style tokens for sub-element colouring not covered by Tailwind classes
const S = {
  pipe:   { color: '#C9A84C', opacity: 0.7 },
  dlabel: { color: '#C9A84C', fontWeight: 700, letterSpacing: '0.08em', fontSize: 10 },
}

function pctColor(p) {
  if (p > 0) return 'var(--color-gain)'
  if (p < 0) return 'var(--color-loss)'
  return '#6b7280'
}

// Both memoised — the tape is rebuilt (and duplicated for the seamless
// -50% loop) on every quote refresh, so without this every one of the
// ~40-80 rendered items/dividers would re-render each tick even when its
// own props are unchanged.
const Divider = memo(function Divider({ label }) {
  return (
    <span className="ticker-divider">
      <span style={S.pipe}>│</span>
      <span style={S.dlabel}>{label}</span>
    </span>
  )
})

// liveSymbol (ASX-only, e.g. 'BHP.AX') opts an item into the simulated
// price stream — its price/change tick every 3s independent of the real
// data refetch, with a brief flash-highlight on each tick. Non-ASX/index/
// FX/commodity items pass no liveSymbol and just render their static props
// as before (useLivePrice itself is null-safe, so the hook call is always
// made — required since hooks can't be conditional).
const TapeItem = memo(function TapeItem({ sym, price, pct, marketCap, onClick, liveSymbol }) {
  const { quote, flash } = useLivePrice(liveSymbol)
  const livePrice = liveSymbol && quote ? `A$${fmt.price(quote.regularMarketPrice)}` : price
  const livePct = liveSymbol && quote ? quote.regularMarketChangePercent : pct
  const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''
  const tooltip = [livePrice, livePct != null ? `${livePct >= 0 ? '+' : ''}${livePct.toFixed(2)}%` : null, marketCap ? `MKT CAP ${formatMarketCap(marketCap)}` : null].filter(Boolean).join(' · ')
  return (
    <span className={`ticker-item ${flashClass}`} title={tooltip || undefined} onClick={onClick}>
      <span className="text-terminal-gold font-semibold">{sym}</span>
      {livePrice != null && <span className="text-terminal-text">{livePrice}</span>}
      {livePct != null && (
        <span className="font-semibold" style={{ color: pctColor(livePct) }}>
          {arrow(livePct)}{livePct >= 0 ? '+' : ''}{livePct.toFixed(2)}%
        </span>
      )}
      {marketCap != null && (
        <>
          <span style={S.pipe}>│</span>
          <span className="text-terminal-text-dim">{formatMarketCap(marketCap)}</span>
        </>
      )}
    </span>
  )
})

export default function TickerTape() {
  const { openModal } = useStore()
  const { audUsd } = useAudRates()

  const { data: rawMarkets } = useQuery({
    queryKey:  ['cryptoMarkets', 'aud'],
    queryFn:   () => fetchCryptoMarketsUnified('aud'),
    staleTime: 60_000,
    retry: 1,
  })

  const { data: indexResult } = useQuery({
    queryKey:  ['yfBatch', 'indices'],
    queryFn:   () => fetchIndexQuotesUnified(YF_INDICES.map(i => i.symbol)),
    staleTime: 60_000,
    retry: 1,
  })
  const indexQuotes = indexResult?.data

  const { data: fxResult } = useQuery({
    queryKey:  ['fxRates'],
    queryFn:   () => fetchFxRatesUnified('AUD'),
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const rawFx = fxResult?.data

  const { data: metalsRates } = useQuery({
    queryKey:  ['metalsRates'],
    queryFn:   fetchMetalsRates,
    staleTime: 10 * 60_000,
    retry: 1,
  })

  // Same queryKeys as TopMovers/MarketSentimentBanner — shares their cached
  // fetch rather than firing a second batch of requests for the same data.
  const { data: asxResult } = useQuery({
    queryKey:  ['yahooMoversBatch', 'asx'],
    queryFn:   () => fetchEquityQuotes(ASX_STOCKS),
    staleTime: 60_000,
    retry: 1,
  })
  const { data: usResult } = useQuery({
    queryKey:  ['yahooMoversBatch', 'us'],
    queryFn:   () => fetchEquityQuotes(US_STOCKS),
    staleTime: 60_000,
    retry: 1,
  })
  const asxQuotes = asxResult?.data
  const usQuotes  = usResult?.data

  // ── Build section items ─────────────────────────────────────────────────────

  const sectionBlocks = []

  // ▲▼ MOVERS — top 3 gainers + top 3 losers from CoinGecko
  if (rawMarkets) {
    const coinList = rawMarkets.data
    const markets = transformCryptoMarkets(coinList, 'aud')
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
    const coinList = rawMarkets.data
    const markets = transformCryptoMarkets(coinList, 'aud')
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

  // 📊 INDICES — all 10 benchmark indices, shown first so the tape leads with
  // the broad market before individual stocks. Via Yahoo Finance v7 quote.
  if (indexQuotes) {
    const indexItems = INDEX_SYMS.map(sym => {
      const q = indexQuotes[sym]
      if (!q || isNaN(q.last)) return null
      return {
        sym:   INDEX_LABELS[sym],
        price: Number(q.last).toLocaleString('en-AU', { maximumFractionDigits: 0 }),
        pct:   q.pct,
      }
    }).filter(Boolean)
    if (indexItems.length) sectionBlocks.push({ label: '📊 INDICES', items: indexItems })
  }

  // 📈 STOCKS — ASX + US, shares TopMovers'/MarketSentimentBanner's cached
  // fetch (same queryKeys above) rather than issuing its own requests.
  if (asxQuotes || usQuotes) {
    const stockItems = [
      ...(asxQuotes ? Object.values(asxQuotes) : []),
      ...(usQuotes  ? Object.values(usQuotes)  : []),
    ].map(q => {
      const priceAud = toAUD(q.price, q.currency, audUsd)
      const capAud   = q.marketCap != null ? toAUD(q.marketCap, q.currency, audUsd) : null
      const ticker   = q.symbol.replace('.AX', '')
      return {
        sym:       ticker,
        price:     fmtAUD(priceAud),
        pct:       q.dayChangePct,
        marketCap: capAud,
        liveSymbol: q.symbol.endsWith('.AX') ? q.symbol : null,
        onClick: () => openModal?.({
          symbol: q.symbol,
          name:   ticker,
          price:  priceAud,
          pct:    q.dayChangePct,
          change: toAUD(q.dayChange, q.currency, audUsd),
          type:   q.symbol.endsWith('.AX') ? 'asx' : 'us',
        }),
      }
    })
    if (stockItems.length) sectionBlocks.push({ label: '📈 STOCKS', items: stockItems })
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
    <div className="ticker-container" title="Press SPACE to pause or resume the ticker">
      <div className="ticker-content">
        {content.map(el =>
          el.type === 'div'
            ? <Divider key={`a-${el.key}`} label={el.label} />
            : <TapeItem key={`a-${el.key}`} sym={el.sym} price={el.price} pct={el.pct} marketCap={el.marketCap} onClick={el.onClick} liveSymbol={el.liveSymbol} />
        )}
        {content.map(el =>
          el.type === 'div'
            ? <Divider key={`b-${el.key}`} label={el.label} />
            : <TapeItem key={`b-${el.key}`} sym={el.sym} price={el.price} pct={el.pct} marketCap={el.marketCap} onClick={el.onClick} liveSymbol={el.liveSymbol} />
        )}
      </div>
    </div>
  )
}
