import { useState, useEffect, useMemo, useCallback } from 'react'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { DemoBadge } from '../../components/ui/ModuleStates'
import { EmptyState as SharedEmptyState } from '../../components/ui/EmptyState'
import { dispatchAskAI } from '../../utils/askAI'
import { fmt } from '../../utils/format'
import TabBar from '../../components/ui/TabBar'
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

function detectedAtStr(ms) {
  return new Date(ms).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Australia/Sydney' }) + ' AEST'
}

function ResultCard({ badge, badgeColor, symbol, name, metricLabel, metricValue, price, changePct, onAnalyse, detectedAt }) {
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
      {detectedAt != null && (
        <div className="text-2xs text-terminal-text-dim/60 flex-shrink-0 w-20 text-right">{detectedAtStr(detectedAt)}</div>
      )}
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
  return (
    <SharedEmptyState
      icon="◎"
      title="No signals"
      subtitle={`No ${label} signals detected right now. The scanner checks for breakouts, volume spikes, and unusual activity every 2 minutes.`}
      className="min-h-0 py-8"
    />
  )
}

function analyseSignal(symbol, name, instruction) {
  dispatchAskAI({ ticker: symbol, name, instruction }, { rawPrompt: true })
}

function BreakoutsTab({ tick, scanTime }) {
  const results = useMemo(() => scanBreakouts(tick), [tick])
  if (!results.length) return <EmptyState label="breakout" />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge="BREAKOUT" badgeColor="border-terminal-green/50 text-terminal-green"
          symbol={r.symbol} name={r.name} detectedAt={scanTime}
          metricLabel="Signal" metricValue={r.descriptor}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} is breaking out — ${r.descriptor.toLowerCase()} — on ${r.volumeRatio.toFixed(1)}x average volume, up ${r.changePct.toFixed(2)}% today. Is a breakout on this kind of volume likely to hold, and what would confirm or invalidate it? Do not state a price or a price target.`)}
        />
      ))}
    </div>
  )
}

function OversoldTab({ label, results, badge, badgeColor, verb, scanTime }) {
  if (!results.length) return <EmptyState label={label} />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge={badge} badgeColor={badgeColor}
          symbol={r.symbol} name={r.name} detectedAt={scanTime}
          metricLabel="RSI (14)" metricValue={r.rsi.toFixed(1)}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} has an RSI of ${r.rsi.toFixed(1)}, technically ${verb}, trading at ${priceStr(r.symbol, r.price)} (${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}% today). Is this a genuine reversal setup or a stock that's ${verb} for a reason?`)}
        />
      ))}
    </div>
  )
}

function VolumeTab({ tick, scanTime }) {
  const results = useMemo(() => scanVolume(tick), [tick])
  if (!results.length) return <EmptyState label="unusual volume" />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge="VOLUME" badgeColor="border-terminal-gold/50 text-terminal-gold"
          symbol={r.symbol} name={r.name} detectedAt={scanTime}
          metricLabel={`${r.volumeRatio.toFixed(1)}x average`} metricValue={r.explanation}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} volume is ${r.volumeRatio.toFixed(1)}x its average with price ${r.changePct >= 0 ? 'up' : 'down'} ${Math.abs(r.changePct).toFixed(2)}% today. What's the most likely explanation, and is this worth acting on?`)}
        />
      ))}
    </div>
  )
}

function GapsTab({ tick, scanTime }) {
  const results = useMemo(() => scanGaps(tick), [tick])
  if (!results.length) return <EmptyState label="gap" />
  return (
    <div>
      {results.map((r) => (
        <ResultCard
          key={r.symbol}
          badge={`GAP ${r.direction === 'UP' ? '↑' : '↓'}`} badgeColor="border-purple-400/50 text-purple-400"
          symbol={r.symbol} name={r.name} detectedAt={scanTime}
          metricLabel="Gap on open" metricValue={`${r.direction === 'UP' ? '+' : '−'}${Math.abs(r.gapPct).toFixed(1)}% vs prior close`}
          price={r.price} changePct={r.changePct}
          onAnalyse={() => analyseSignal(r.symbol, r.name,
            `${tickerOf(r.symbol)} gapped ${r.direction.toLowerCase()} ${Math.abs(r.gapPct).toFixed(1)}% on the open. What typically drives a gap of that size, and is it likely to fill? Do not state a price or a price target.`)}
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
        <div className="flex items-center gap-2">
          <span className="text-2xs font-bold tracking-widest px-1.5 py-0.5 border border-cyan-400/50 text-cyan-400 flex-shrink-0">PATTERN</span>
          <span className="text-2xs font-bold text-terminal-text-bright">{tickerOf(candidate.symbol)}</span>
          <span className="text-2xs text-terminal-text-dim">{candidate.name}</span>
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
          {/* The "Target: A$47.50" line that sat here was a number the model
              invented from a DEMO price series. Confirmation and invalidation
              are what a pattern actually tells you, and they are structural —
              the model can describe them without knowing the price. */}
          {pattern.confirmation && (
            <div className="text-2xs text-terminal-text-dim">
              <span className="text-terminal-green">Confirms:</span> {pattern.confirmation}
            </div>
          )}
          {pattern.invalidation && (
            <div className="text-2xs text-terminal-text-dim">
              <span className="text-terminal-red">Invalidates:</span> {pattern.invalidation}
            </div>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => analyseSignal(candidate.symbol, candidate.name,
                `${tickerOf(candidate.symbol)} is forming a ${pattern.patternName} pattern (${pattern.implication.toLowerCase()}, ${pattern.probability.toLowerCase()} probability). Walk me through this setup. Do not state a price target.`)}
              className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >ANALYSE</button>
            <span
              title="Pattern read by MaddenAI from the shape of the recent series. No price target — chart patterns here describe structure, not a level to trade to."
              style={{
                fontFamily: '"IBM Plex Mono", monospace', fontSize: 8, letterSpacing: '0.1em',
                padding: '1px 5px', borderRadius: 2, whiteSpace: 'nowrap',
                background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C',
              }}
            >AI ESTIMATE · NO TARGET</span>
          </div>
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
            {/* Every signal on this page is computed from the DEMO price
                series — the same data Markets labels. The prices on the cards
                are that series, so the module says so once, up here, rather
                than the reader having to infer it. */}
            <DemoBadge />
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

      <TabBar tabs={TABS} activeKey={activeTab} onChange={setActiveTab} className="overflow-x-auto" />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'breakouts'  && <BreakoutsTab tick={tick} scanTime={lastScanAt} />}
        {activeTab === 'oversold'   && <OversoldTab label="oversold" results={oversold} badge="OVERSOLD" badgeColor="border-terminal-blue-bright/50 text-terminal-blue-bright" verb="oversold" scanTime={lastScanAt} />}
        {activeTab === 'overbought' && <OversoldTab label="overbought" results={overbought} badge="OVERBOUGHT" badgeColor="border-terminal-red/50 text-terminal-red" verb="overbought" scanTime={lastScanAt} />}
        {activeTab === 'volume'     && <VolumeTab tick={tick} scanTime={lastScanAt} />}
        {activeTab === 'gaps'       && <GapsTab tick={tick} scanTime={lastScanAt} />}
        {activeTab === 'patterns'   && <PatternsTab />}
      </div>
    </div>
  )
}
