import { useState, useEffect, useMemo, useCallback } from 'react'
import { takeModuleIntent } from '../../services/moduleIntent'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { DemoBadge } from '../../components/ui/ModuleStates'
import { EmptyState as SharedEmptyState } from '../../components/ui/EmptyState'
import { dispatchAskAI } from '../../utils/askAI'
import { fmt } from '../../utils/format'
import TabBar from '../../components/ui/TabBar'
import {
  scanBreakouts, scanOversold, scanOverbought, scanVolume, scanGaps,
  scanMomentum, scanDivergence, getPatternCandidates, detectPattern,
} from '../../services/scannerService'
import {
  loadScanSettings, saveScanSettings, applyScanFilters,
  SCAN_UNIVERSES, MIN_VOLUME_OPTIONS, MIN_MCAP_OPTIONS, INTERVAL_OPTIONS,
} from '../../services/scannerSettings'

const TABS = [
  { key: 'breakouts',   label: 'BREAKOUTS' },
  { key: 'oversold',    label: 'OVERSOLD' },
  { key: 'overbought',  label: 'OVERBOUGHT' },
  { key: 'volume',      label: 'VOLUME' },
  { key: 'gaps',        label: 'GAPS' },
  { key: 'momentum',    label: 'MOMENTUM' },
  { key: 'patterns',    label: 'PATTERNS' },
]

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

// Signal tone, keyed off the badge text.
//
// The badge colour arrived as a Tailwind class string, which is fine for a
// border but useless for anything computed — a tint, a left rule, a glow. This
// maps the same signal types to real colours so the row can be built around
// one accent instead of six unrelated utility classes.
const SIGNAL_TONE = {
  BREAKOUT:   '#2D8A50',
  OVERSOLD:   '#2D7DD2',
  OVERBOUGHT: '#A83232',
  VOLUME:     '#C9A84C',
  MOMENTUM:   '#6FA34A',
  PATTERN:    '#7C6BC4',
}
const toneFor = (badge) => {
  const key = String(badge ?? '').split(' ')[0].toUpperCase()
  if (SIGNAL_TONE[key]) return SIGNAL_TONE[key]
  if (key === 'GAP') return '#9B6BC4'
  return '#637899'
}

// A signal row with actual hierarchy.
//
// Everything here used to render at text-2xs — the smallest size in the
// system — so the ticker, its company name, the metric label and the timestamp
// all carried identical weight and nothing led the eye. On a scanner, the
// ticker and the signal ARE the content; the rest is supporting detail.
//
// So: a 3px left rule in the signal's colour, the ticker at 13px, the price at
// 12px, and everything else stepped down and dimmed. Same information, same
// density, one obvious reading order.
// badgeColor is accepted and ignored: every call site still passes the old
// Tailwind class pair, and the colour now comes from toneFor(badge) so one
// signal type cannot end up with a border in one colour and a tint in another.
// Left in the signature rather than edited out of six call sites for no
// behavioural gain.
function ResultCard({ badge, badgeColor: _badgeColor, symbol, name, metricLabel, metricValue, price, changePct, onAnalyse, detectedAt }) {
  const tone = toneFor(badge)
  const up = changePct >= 0

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2.5 border-b border-terminal-border/50 hover:bg-terminal-accent/10 transition-colors"
      style={{ borderLeft: `3px solid ${tone}` }}
    >
      <span
        className="text-2xs font-bold tracking-widest px-1.5 py-0.5 flex-shrink-0 rounded-sm"
        style={{ color: tone, background: `${tone}1F`, border: `1px solid ${tone}55` }}
      >{badge}</span>

      <div className="min-w-0 w-28 flex-shrink-0">
        <div className="font-bold text-terminal-text-bright leading-tight" style={{ fontSize: 13 }}>
          {tickerOf(symbol)}
        </div>
        <div className="text-2xs text-terminal-text-dim/70 truncate leading-tight">{name}</div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-2xs text-terminal-text-dim/60 tracking-widest leading-tight">{metricLabel}</div>
        <div className="text-2xs text-terminal-text leading-tight truncate">{metricValue}</div>
      </div>

      {detectedAt != null && (
        <div className="text-2xs text-terminal-text-dim/50 flex-shrink-0 w-20 text-right tabular-nums">
          {detectedAtStr(detectedAt)}
        </div>
      )}

      <div className="text-right flex-shrink-0 w-24">
        <div className="font-bold text-terminal-text-bright tabular-nums leading-tight" style={{ fontSize: 12 }}>
          {priceStr(symbol, price)}
        </div>
        <div
          className="text-2xs font-bold tabular-nums leading-tight"
          style={{ color: up ? '#2D8A50' : '#A83232' }}
        >
          {up ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
        </div>
      </div>

      <button
        onClick={onAnalyse}
        className="text-2xs font-bold px-2.5 py-1 flex-shrink-0 rounded-sm transition-colors opacity-60 group-hover:opacity-100"
        style={{ color: tone, border: `1px solid ${tone}66` }}
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

function BreakoutsTab({ tick, scanTime, settings }) {
  const results = useMemo(() => applyScanFilters(scanBreakouts(tick), settings), [tick, settings])
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

// settings arrives as a prop rather than being read from localStorage inside
// the memo. Read internally with an empty dep array, this computed once at
// mount and never again — changing the universe to ASX left US tickers on
// screen, which is a filter that appears to work and does not.
function DivergenceSection({ settings }) {
  const rows = useMemo(() => applyScanFilters(scanDivergence(), settings), [settings])
  if (!rows.length) return null
  return (
    <div className="border-t border-terminal-border">
      <div className="px-3 py-2 flex items-baseline gap-2">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">PRICE / VOLUME DIVERGENCE</span>
        <span className="text-[9px] text-terminal-text-dim">5-session price move against the change in participation</span>
      </div>
      {rows.map((r) => (
        <div key={r.symbol} className="px-3 py-2 border-t border-terminal-border/30 flex items-start gap-3">
          <span
            className="text-2xs font-bold px-1.5 py-0.5 border flex-shrink-0"
            style={r.kind === 'BULLISH DIV'
              ? { color: '#2D8A50', borderColor: 'rgba(45,138,80,0.5)' }
              : { color: '#C86464', borderColor: 'rgba(200,100,100,0.5)' }}
          >{r.kind}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xs font-bold text-terminal-text-bright">{tickerOf(r.symbol)}</span>
              <span className="text-2xs text-terminal-text-dim truncate">{r.name}</span>
            </div>
            <div className="text-2xs text-terminal-text-dim mt-0.5">{r.note}</div>
          </div>
          <div className="text-right flex-shrink-0 tabular-nums">
            <div className="text-2xs" style={{ color: r.pricePct >= 0 ? '#2D8A50' : '#C86464' }}>
              PRICE {r.pricePct >= 0 ? '+' : ''}{r.pricePct.toFixed(1)}%
            </div>
            <div className="text-2xs text-terminal-text-dim">
              VOL {r.volPct >= 0 ? '+' : ''}{r.volPct.toFixed(0)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MomentumTab({ settings }) {
  const rows = useMemo(() => applyScanFilters(scanMomentum(), settings).slice(0, 20), [settings])
  if (!rows.length) return <EmptyState label="momentum" />
  // Brightness carries the strength of the score, so the top of the list is
  // visibly the top rather than merely first.
  const peak = Math.max(...rows.map((r) => Math.abs(r.score)), 1)
  return (
    <div>
      <div className="px-3 py-2 text-[9px] text-terminal-text-dim">
        Score is a weighted blend of the three windows — 50% of the 5-day move, 30% of the 10-day, 20% of the 20-day.
      </div>
      <table className="w-full text-2xs">
        <thead>
          <tr className="text-terminal-text-dim border-b border-terminal-border">
            <th className="text-left font-normal px-3 py-1 w-8">#</th>
            <th className="text-left font-normal py-1">TICKER</th>
            <th className="text-right font-normal py-1">5D</th>
            <th className="text-right font-normal py-1">10D</th>
            <th className="text-right font-normal py-1">20D</th>
            <th className="text-right font-normal py-1">SCORE</th>
            <th className="text-right font-normal px-3 py-1">SIGNAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const intensity = Math.min(1, Math.abs(r.score) / peak)
            const colour = r.score >= 0
              ? `rgba(45,138,80,${0.45 + intensity * 0.55})`
              : `rgba(200,100,100,${0.45 + intensity * 0.55})`
            return (
              <tr key={r.symbol} className="border-b border-terminal-border/30 hover:bg-terminal-accent/10">
                <td className="px-3 py-1 text-terminal-text-dim tabular-nums">{i + 1}</td>
                <td className="py-1">
                  <span className="font-bold text-terminal-text-bright">{tickerOf(r.symbol)}</span>
                  {r.sector && <span className="text-terminal-text-dim/60 ml-1.5">{r.sector}</span>}
                </td>
                {[r.d5, r.d10, r.d20].map((v, j) => (
                  <td key={j} className="py-1 text-right tabular-nums" style={{ color: v >= 0 ? '#2D8A50' : '#C86464' }}>
                    {v >= 0 ? '+' : ''}{v.toFixed(1)}%
                  </td>
                ))}
                <td className="py-1 text-right tabular-nums font-bold" style={{ color: colour }}>
                  {r.score >= 0 ? '+' : ''}{r.score.toFixed(1)}
                </td>
                <td className="px-3 py-1 text-right text-terminal-text-dim">{r.signal}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function VolumeTab({ tick, scanTime, settings }) {
  const results = useMemo(() => applyScanFilters(scanVolume(tick), settings), [tick, settings])
  if (!results.length) return <><EmptyState label="unusual volume" /><DivergenceSection settings={settings} /></>
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
      <DivergenceSection settings={settings} />
    </div>
  )
}

function GapsTab({ tick, scanTime, settings }) {
  const results = useMemo(() => applyScanFilters(scanGaps(tick), settings), [tick, settings])
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

// ── Scan settings ──────────────────────────────────────────────────────────
//
// A dropdown rather than a modal: these are adjustments you make while looking
// at results, and a modal would hide the thing you are adjusting.
// Hoisted out of ScanSettings deliberately. Declared inside the parent's body
// it is a new component type on every render, so React unmounts and remounts
// the whole group each time — losing focus and any transient state, and
// throwing away the DOM for no reason.
function SettingGroup({ label, options, value, onPick }) {
  return (
    <div className="mb-2.5">
      <div className="text-[9px] text-terminal-text-dim tracking-widest mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={`text-2xs px-2 py-0.5 border transition-colors ${
              value === o.id
                ? 'bg-terminal-gold text-terminal-bg border-terminal-gold'
                : 'text-terminal-text-dim border-terminal-border hover:text-terminal-gold'
            }`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  )
}

function ScanSettings({ settings, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Scan settings"
        aria-expanded={open}
        className="text-terminal-text-dim hover:text-terminal-gold transition-colors px-1"
      >⚙</button>

      {open && (
        <>
          {/* Click-away layer. Cheaper and more reliable than a document
              listener that has to be careful not to fire on the toggle. */}
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-[81] bg-terminal-panel border border-terminal-border p-3 text-left shadow-2xl"
            style={{ width: 230 }}
          >
            <SettingGroup label="SCAN UNIVERSE" options={SCAN_UNIVERSES} value={settings.universe}
              onPick={(v) => onChange({ ...settings, universe: v })} />
            <SettingGroup label="MINIMUM VOLUME" options={MIN_VOLUME_OPTIONS} value={settings.minVolume}
              onPick={(v) => onChange({ ...settings, minVolume: v })} />
            <SettingGroup label="MINIMUM MARKET CAP" options={MIN_MCAP_OPTIONS} value={settings.minMarketCap}
              onPick={(v) => onChange({ ...settings, minMarketCap: v })} />
            <SettingGroup label="AUTO-SCAN INTERVAL" options={INTERVAL_OPTIONS} value={settings.intervalMs}
              onPick={(v) => onChange({ ...settings, intervalMs: v })} />
            <div className="text-[9px] text-terminal-text-dim/60 leading-snug pt-1 border-t border-terminal-border/50">
              Filters apply to the tracked demo universe.
            </div>
          </div>
        </>
      )}
    </span>
  )
}

export default function MarketScannerModule() {
  // The command bar can ask for a specific tab ("scan for oversold"), and it
  // has to work whether or not this module is already mounted. The intent
  // covers the cold case — read here, on mount, after the lazy chunk finally
  // arrives — and the event below covers the warm one.
  const [activeTab, setActiveTab] = useState(() => {
    const intent = takeModuleIntent('scanner')
    return TABS.some((t) => t.key === intent?.tab) ? intent.tab : 'breakouts'
  })

  useEffect(() => {
    const onTab = (e) => {
      const tab = e.detail?.tab
      if (tab && TABS.some((t) => t.key === tab)) setActiveTab(tab)
    }
    window.addEventListener('madden:scanner-tab', onTab)
    return () => window.removeEventListener('madden:scanner-tab', onTab)
  }, [])
  const [tick, setTick] = useState(0)
  const [lastScanAt, setLastScanAt] = useState(() => Date.now())
  const [scanning, setScanning] = useState(false)
  const [, forceTick] = useState(0) // re-renders "Last scan: Xm ago" every 30s
  const [settings, setSettings] = useState(loadScanSettings)

  const updateSettings = useCallback((next) => {
    setSettings(saveScanSettings(next))
  }, [])

  const runScan = useCallback(() => {
    setScanning(true)
    setTimeout(() => {
      setTick((t) => t + 1)
      setLastScanAt(Date.now())
      setScanning(false)
    }, 900)
  }, [])

  // Interval comes from settings, so changing it takes effect immediately
  // rather than at the next reload.
  useEffect(() => {
    const id = setInterval(runScan, settings.intervalMs)
    return () => clearInterval(id)
  }, [runScan, settings.intervalMs])

  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // scanOversold/scanOverbought read real RSI off the shared (page-load-stable)
  // mock history, so they don't vary with `tick` — cheap enough to just call
  // directly rather than memoize.
  const oversold = applyScanFilters(scanOversold(), settings)
  const overbought = applyScanFilters(scanOverbought(), settings)

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
            <ScanSettings settings={settings} onChange={updateSettings} />
          </span>
        }
      />

      <TabBar tabs={TABS} activeKey={activeTab} onChange={setActiveTab} className="overflow-x-auto" />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'breakouts'  && <BreakoutsTab tick={tick} scanTime={lastScanAt} settings={settings} />}
        {activeTab === 'oversold'   && <OversoldTab label="oversold" results={oversold} badge="OVERSOLD" badgeColor="border-terminal-blue-bright/50 text-terminal-blue-bright" verb="oversold" scanTime={lastScanAt} />}
        {activeTab === 'overbought' && <OversoldTab label="overbought" results={overbought} badge="OVERBOUGHT" badgeColor="border-terminal-red/50 text-terminal-red" verb="overbought" scanTime={lastScanAt} />}
        {activeTab === 'volume'     && <VolumeTab tick={tick} scanTime={lastScanAt} settings={settings} />}
        {activeTab === 'gaps'       && <GapsTab tick={tick} scanTime={lastScanAt} settings={settings} />}
        {activeTab === 'momentum'   && <MomentumTab settings={settings} />}
        {activeTab === 'patterns'   && <PatternsTab />}
      </div>
    </div>
  )
}
