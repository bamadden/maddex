import { useState, useMemo } from 'react'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  INDICATORS, generateIndicatorHistory, consensusAccuracy, avgConsensusMiss, forecastIndicator,
} from '../../services/economicForecastService'

// Deterministic RBA-relevance sentence per indicator — kept static/templated
// (not AI-generated) since it's a mechanical statement about what a level
// vs. target implies, not an analysis.
const RBA_LINK = {
  gdp: (v) => `Growth ${v < 1.5 ? 'below trend would keep' : 'at or above trend would reduce'} the case for near-term RBA easing.`,
  inflation: (v) => `A reading ${v < 3.5 ? 'below 3.5% would increase' : 'at or above 3.5% would reduce'} the probability of an RBA cut at the next meeting.`,
  unemp: (v) => `A reading ${v > 4.3 ? 'above 4.3% would increase' : 'at or below 4.3% would reduce'} pressure on the RBA to support the labour market via cuts.`,
  cashrate: () => 'This is the RBA\'s own policy rate — moves here are decisions, not forecasts to react to.',
  wage: (v) => `Wage growth ${v > 3.5 ? 'above 3.5% keeps' : 'at or below 3.5% eases'} services-inflation pressure the RBA watches closely.`,
  retail: (v) => `${v > 0.4 ? 'Stronger-than-expected' : 'Soft'} retail sales feed directly into the RBA's read on consumer demand and inflation persistence.`,
  pmi: (v) => `A PMI ${v < 48 ? 'below 48 signals deepening contraction, supportive of RBA easing' : 'near 50 signals a stabilising manufacturing sector'}.`,
  house: () => 'Elevated house price growth is a financial-stability watch item for the RBA, separate from its inflation mandate.',
  consconf: () => 'A leading indicator for retail spending 1-2 quarters out — persistent weakness flows through to consumption data.',
  busconf: () => 'A leading indicator for investment and hiring intentions over the next 2-3 quarters.',
  trade: () => 'Feeds into GDP via net exports and into AUD via the current account — less directly RBA-relevant.',
  curracct: () => 'A structural balance-of-payments indicator — moves slowly and is not a near-term policy trigger.',
}

function Sparkline({ data, color }) {
  return (
    <div style={{ width: 80, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="actual" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.dataKey}: {p.value}</div>
      ))}
    </div>
  )
}

function IndicatorCard({ indicator, expanded, onToggle }) {
  // `indicator` is a stable reference (mapped from the module-level
  // INDICATORS const), so this is safe to recompute directly — the React
  // Compiler auto-memoizes it, and a manual useMemo here fights that.
  const history = generateIndicatorHistory(indicator.current, indicator.vol, indicator.trend, indicator.key)
  const latest = history[history.length - 1]
  const prev = history[history.length - 2]
  const trendUp = latest.actual >= prev.actual
  const vsConsensus = latest.actual > latest.consensus ? 'ABOVE' : latest.actual < latest.consensus ? 'BELOW' : 'IN LINE'
  const vsColor = vsConsensus === 'ABOVE' ? 'text-terminal-green' : vsConsensus === 'BELOW' ? 'text-terminal-red' : 'text-terminal-text-dim'
  const accuracy = consensusAccuracy(history)

  const [forecastStatus, setForecastStatus] = useState('idle') // idle | loading | ready | error
  const [forecast, setForecast] = useState(null)
  const [forecastError, setForecastError] = useState(null)

  const loadForecast = () => {
    if (forecastStatus !== 'idle') return
    setForecastStatus('loading')
    forecastIndicator(indicator, history)
      .then((f) => { setForecast(f); setForecastStatus('ready') })
      .catch((e) => { setForecastError(e.message); setForecastStatus('error') })
  }

  const handleToggle = () => {
    onToggle()
    if (!expanded) loadForecast()
  }

  return (
    <div className="border-t border-l border-terminal-border/60 -ml-px -mt-px first:ml-0">
      <button onClick={handleToggle} className="w-full text-left p-2.5 hover:bg-terminal-accent/10 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-2xs text-terminal-text-dim tracking-wide truncate">{indicator.label}</span>
          <span className={`text-2xs ${trendUp ? 'text-terminal-green' : 'text-terminal-red'}`}>{trendUp ? '▲' : '▼'}</span>
        </div>
        <div className="text-lg font-bold mt-0.5 text-terminal-text-bright">{latest.actual}{indicator.unit}</div>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-2xs font-bold ${vsColor}`}>{vsConsensus}</span>
          <Sparkline data={history.slice(-8)} color="#c8a84b" />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-terminal-border/60 p-3 space-y-3">
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 8 }} stroke="var(--t-text-dim)" tickFormatter={(v) => v.slice(0, 7)} interval={4} />
                <YAxis tick={{ fontSize: 8 }} stroke="var(--t-text-dim)" domain={['auto', 'auto']} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="actual" name="Actual" stroke="#c8a84b" fill="#c8a84b" fillOpacity={0.15} />
                <Area type="monotone" dataKey="consensus" name="Consensus" stroke="#5b7fa6" fill="none" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-2xs text-terminal-text-dim">
            Consensus was within 0.2{indicator.unit || ''} of actual in <span className="text-terminal-text-bright font-bold">{accuracy.within} of last {accuracy.total}</span> readings ({accuracy.pct}%).
          </div>

          <div className="border border-terminal-border p-2.5">
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">MADDENAI FORECAST</div>
            {forecastStatus === 'loading' && <div className="text-2xs text-terminal-gold animate-pulse">Analysing leading indicators...</div>}
            {forecastStatus === 'error' && <div className="text-2xs text-terminal-red">{forecastError}</div>}
            {forecastStatus === 'ready' && forecast && (
              <div className="space-y-1">
                <div className="text-2xs text-terminal-text-bright">
                  MaddenAI expects: <span className="font-bold text-terminal-gold">{forecast.forecastValue}{indicator.unit}</span>{' '}
                  ({forecast.vsConsensus.toLowerCase()} consensus {latest.consensus}{indicator.unit}) · confidence: {forecast.confidence}
                </div>
                <div className="text-2xs text-terminal-text-dim">{forecast.reasoning}</div>
                <div className="text-2xs text-terminal-text italic mt-1">{forecast.whatItMeans}</div>
              </div>
            )}
          </div>

          <div className="text-2xs text-terminal-text-dim/80 italic">{(RBA_LINK[indicator.key] ?? (() => ''))(latest.actual)}</div>
        </div>
      )}
    </div>
  )
}

export default function IndicatorForecaster() {
  const [expandedKey, setExpandedKey] = useState(null)

  const accuracyChartData = useMemo(() => INDICATORS.map((ind) => {
    const history = generateIndicatorHistory(ind.current, ind.vol, ind.trend, ind.key)
    return { label: ind.label, miss: avgConsensusMiss(history) }
  }), [])

  return (
    <div className="border border-terminal-border">
      <div className="panel-header flex items-center gap-2">
        <span>ECONOMIC DASHBOARD</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">12 key AU indicators · click to expand + MaddenAI forecast</span>
        <span className="ml-auto text-2xs text-terminal-gold/70">DEMO</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {INDICATORS.map((ind) => (
          <IndicatorCard
            key={ind.key}
            indicator={ind}
            expanded={expandedKey === ind.key}
            onToggle={() => setExpandedKey((k) => (k === ind.key ? null : ind.key))}
          />
        ))}
      </div>

      <div className="border-t border-terminal-border p-3">
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">FORECASTER ACCURACY</div>
        <div className="text-2xs text-terminal-text-dim mb-2">Average consensus miss vs actual, last 12 readings — consensus is often wrong by more than markets expect.</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accuracyChartData} margin={{ bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 8 }} stroke="var(--t-text-dim)" angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 8 }} stroke="var(--t-text-dim)" />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="miss" name="Avg Miss" fill="#c8a84b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
