import { useState, useEffect, useMemo, useCallback } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { dispatchAskAI } from '../../utils/askAI'
import { fmt } from '../../utils/format'
import {
  scanBreakouts, scanOversold, scanOverbought, scanVolume, scanGaps,
  getPatternCandidates, detectPattern,
} from '../../services/scannerService'

const TABS = [
  { key: 'breakouts',   label: 'BREAKOUTS' },
  { key: 'oversold',    label: 'OVERSOLD' },
  { key: 'overbought',  label: 'OVERBOUGHT' },
  { key: 'volume',      label: 'VOLUME' },
  { key: 'gaps',        label: 'GAPS' },
  { key: 'patterns',    label: 'PATTERNS' },
]

const SCAN_INTERVAL_MS = 2 * 60_000

function tickerOf(symbol) { return symbol.replace('.AX', '') }
function priceStr(symbol, price) { return `${symbol.endsWith('.AX') ? 'A$' : 'US$'}${fmt.price(price)}` }

function timeAgo(ms) {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function ResultCard({ badge, badgeColor, symbol, name, metricLabel, metricValue, price, changePct, onAnalyse }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-terminal-border/50 hover:bg-terminal-accent/5 transition-colors">
      <span className={`text-2xs font-bold tracking-widest px-1.5 py-0.5 border flex-shrink-0 ${badgeColor}`}>{badge}</span>
      <div className="min-w-0 w-28 flex-shrink-0">
        <div className="text-2xs font-bold text-terminal-text-bright">{tickerOf(symbol)}</div>
        <div className="text-2xs text-terminal-text-dim truncate">{name}</div>
      </div>
      <div className="flex-1 min-w-0 text-2xs text-terminal-text-dim">
        {metricLabel}: <span className="text-terminal-text">{metricValue}</span>
      </div>
      <div className="text-right flex-shrink-0 w-24">
        <div className="text-2xs font-bold text-terminal-text-bright">{priceStr(symbol, price)}</div>
        <div className={`text-2xs font-bold ${changePct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      </div>
      <button
        onClick={onAnalyse}
        className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors flex-shrink-0"
      >ANALYSE</button>
    </div>
  )
}

function EmptyState({ label }) {
  return <div className="px-3 py-8 text-2xs text-terminal-text-dim/60 text-center">No {label} signals detected right now</div>
}

function analyseSignal(symbol, name, instruction) {
  dispatchAskAI({ ticker: symbol, name, instruction }, { rawPrompt: true })
}

function BreakoutsTab({ tick }) {
  const results = useMemo(() => scanBreakouts(tick), [tick])
  if (!results.length) return <EmptyState label="breakout" />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge="BREAKOUT" badgeColor="border-terminal-green/50 text-terminal-green"
          symbol={r.symbol} name={r.name}
          metricLabel="Above resistance" metricValue={priceStr(r.symbol, r.breakoutLevel)}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} is breaking above its resistance level of ${priceStr(r.symbol, r.breakoutLevel)} with ${r.volumeRatio.toFixed(1)}x average volume, now trading at ${priceStr(r.symbol, r.price)}. Is this breakout likely to hold, and what's the next level to watch?`)}
        />
      ))}
    </div>
  )
}

function OversoldTab({ label, results, badge, badgeColor, verb }) {
  if (!results.length) return <EmptyState label={label} />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge={badge} badgeColor={badgeColor}
          symbol={r.symbol} name={r.name}
          metricLabel="RSI (14)" metricValue={r.rsi.toFixed(1)}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} has an RSI of ${r.rsi.toFixed(1)}, technically ${verb}, trading at ${priceStr(r.symbol, r.price)} (${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}% today). Is this a genuine reversal setup or a stock that's ${verb} for a reason?`)}
        />
      ))}
    </div>
  )
}

function VolumeTab({ tick }) {
  const results = useMemo(() => scanVolume(tick), [tick])
  if (!results.length) return <EmptyState label="unusual volume" />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge="VOLUME" badgeColor="border-terminal-gold/50 text-terminal-gold"
          symbol={r.symbol} name={r.name}
          metricLabel={`${r.volumeRatio.toFixed(1)}x average`} metricValue={r.explanation}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} volume is ${r.volumeRatio.toFixed(1)}x its average with price ${r.changePct >= 0 ? 'up' : 'down'} ${Math.abs(r.changePct).toFixed(2)}% today. What's the most likely explanation, and is this worth acting on?`)}
        />
      ))}
    </div>
  )
}

function GapsTab({ tick }) {
  const results = useMemo(() => scanGaps(tick), [tick])
  if (!results.length) return <EmptyState label="gap" />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge={`GAP ${r.direction}`} badgeColor={r.direction === 'UP' ? 'border-terminal-green/50 text-terminal-green' : 'border-terminal-red/50 text-terminal-red'}
          symbol={r.symbol} name={r.name}
          metricLabel="Opened at" metricValue={`${priceStr(r.symbol, r.openPrice)} (prev close ${priceStr(r.symbol, r.prevClose)})`}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} gapped ${r.direction.toLowerCase()} ${Math.abs(r.gapPct).toFixed(1)}% on open, from a prior close of ${priceStr(r.symbol, r.prevClose)} to ${priceStr(r.symbol, r.openPrice)}. What typically drives a gap like this, and is it likely to fill?`)}
        />
      ))}
    </div>
  )
}

function PatternCard({ candidate }) {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [pattern, setPattern] = useState(null)
  const [error, setError] = useState(null)

  const scan = () => {
    if (status === 'loading') return
    setStatus('loading')
    detectPattern(candidate.symbol)
      .then((p) => { setPattern(p); setStatus('ready') })
      .catch((e) => { setError(e.message); setStatus('error') })
  }

  const implColor = pattern?.implication === 'BULLISH' ? 'text-terminal-green'
    : pattern?.implication === 'BEARISH' ? 'text-terminal-red' : 'text-terminal-text-dim'

  return (
    <div className="border border-terminal-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xs font-bold text-terminal-text-bright">{tickerOf(candidate.symbol)}</span>
          <span className="text-2xs text-terminal-text-dim ml-2">{candidate.name}</span>
        </div>
        <div className="text-right">
          <div className="text-2xs font-bold text-terminal-text-bright">{priceStr(candidate.symbol, candidate.price)}</div>
          <div className={`text-2xs font-bold ${candidate.changePct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
            {candidate.changePct >= 0 ? '+' : ''}{candidate.changePct.toFixed(2)}%
          </div>
        </div>
      </div>

      {status === 'idle' && (
        <button
          onClick={scan}
          className="w-full text-2xs text-terminal-gold border border-terminal-gold/40 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >MADDENAI: DETECT PATTERN</button>
      )}
      {status === 'loading' && <div className="text-2xs text-terminal-gold animate-pulse py-1">Scanning chart for patterns...</div>}
      {status === 'error' && <div className="text-2xs text-terminal-red py-1">{error}</div>}
      {status === 'ready' && pattern && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-bold text-terminal-gold">{pattern.patternName}</span>
            <span className={`text-2xs font-bold ${implColor}`}>{pattern.implication}</span>
            <span className="text-2xs text-terminal-text-dim">· {pattern.probability} probability</span>
          </div>
          <div className="text-2xs text-terminal-text-dim">{pattern.description}</div>
          <div className="text-2xs text-terminal-text-dim">Target: <span className="text-terminal-text-bright">{priceStr(candidate.symbol, pattern.targetLevel)}</span></div>
          <button
            onClick={() => analyseSignal(candidate.symbol, candidate.name,
              `${tickerOf(candidate.symbol)} is forming a ${pattern.patternName} pattern (${pattern.implication.toLowerCase()}, ${pattern.probability.toLowerCase()} probability) with a target of ${priceStr(candidate.symbol, pattern.targetLevel)}. Walk me through this setup.`)}
            className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >ANALYSE</button>
        </div>
      )}
    </div>
  )
}

function PatternsTab() {
  const candidates = useMemo(() => getPatternCandidates(), [])
  return (
    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
      {candidates.map((c) => <PatternCard key={c.symbol} candidate={c} />)}
    </div>
  )
}

export default function MarketScannerModule() {
  const [activeTab, setActiveTab] = useState('breakouts')
  const [tick, setTick] = useState(0)
  const [lastScanAt, setLastScanAt] = useState(() => Date.now())
  const [scanning, setScanning] = useState(false)
  const [, forceTick] = useState(0) // re-renders "Last scan: Xm ago" every 30s

  const runScan = useCallback(() => {
    setScanning(true)
    setTimeout(() => {
      setTick((t) => t + 1)
      setLastScanAt(Date.now())
      setScanning(false)
    }, 900)
  }, [])

  useEffect(() => {
    const id = setInterval(runScan, SCAN_INTERVAL_MS)
    return () => clearInterval(id)
  }, [runScan])

  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // scanOversold/scanOverbought read real RSI off the shared (page-load-stable)
  // mock history, so they don't vary with `tick` — cheap enough to just call
  // directly rather than memoize.
  const oversold = scanOversold()
  const overbought = scanOverbought()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="MARKET SCANNER"
        subtitle="Automated pattern & signal detection"
        moduleId="scanner"
        right={
          <span className="flex items-center gap-2 text-2xs font-mono text-terminal-text-dim flex-shrink-0">
            {scanning
              ? <span className="text-terminal-gold animate-pulse">SCANNING...</span>
              : <span>Last scan: {timeAgo(lastScanAt)}</span>}
            <button
              onClick={runScan}
              disabled={scanning}
              className="text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-40"
            >RESCAN</button>
          </span>
        }
      />

      <div className="flex border-b border-terminal-border flex-shrink-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`text-2xs font-bold tracking-widest px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.key
                ? 'text-terminal-gold border-terminal-gold'
                : 'text-terminal-text-dim border-transparent hover:text-terminal-text'
            }`}
          >{t.label}</button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'breakouts'  && <BreakoutsTab tick={tick} />}
        {activeTab === 'oversold'   && <OversoldTab label="oversold" results={oversold} badge="OVERSOLD" badgeColor="border-terminal-green/50 text-terminal-green" verb="oversold" />}
        {activeTab === 'overbought' && <OversoldTab label="overbought" results={overbought} badge="OVERBOUGHT" badgeColor="border-terminal-red/50 text-terminal-red" verb="overbought" />}
        {activeTab === 'volume'     && <VolumeTab tick={tick} />}
        {activeTab === 'gaps'       && <GapsTab tick={tick} />}
        {activeTab === 'patterns'   && <PatternsTab />}
      </div>
    </div>
  )
}
