import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { Viz3DLoader } from '../../components/ui/ModuleStates'
import SafeChart from '../../components/ui/SafeChart'
import {
  rbaRateOn, eventOn, generateReplaySeries, generateReplayMovers, addDays,
} from '../../services/replayService'
import { SCENARIOS, CATEGORY_STYLE } from '../../services/replayScenarios'
import ScenarioPlayer, { FactPill } from './ScenarioPlayer'

// Code-split — three.js/@react-three pull in a large bundle only needed once
// the user actually switches to the 3D view.
const ReplayViewer3D = lazy(() => import('./ReplayViewer3D'))

const TODAY = new Date().toISOString().slice(0, 10)
const SPEEDS = [
  { label: '0.5x', ms: 2000 },
  { label: '1x', ms: 1000 },
  { label: '2x', ms: 500 },
  { label: '4x', ms: 250 },
]

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="text-terminal-gold font-semibold">{payload[0].value.toFixed(1)}</div>
    </div>
  )
}

const DIFFICULTY_COLOUR = { BEGINNER: '#2D8A50', INTERMEDIATE: '#C9A84C', ADVANCED: '#A83232' }

function ScenarioCard({ s, onPlay }) {
  const st = CATEGORY_STYLE[s.category]
  return (
    <div className="border border-terminal-border flex flex-col hover:border-terminal-gold/50 transition-colors" style={{ background: 'rgba(7,20,40,0.6)' }}>
      <div style={{ height: 3, background: st.colour }} />
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-widest" style={{ fontSize: 8, color: st.colour }}>{s.category}</span>
          <span className="font-mono tracking-widest px-1.5 py-px" style={{ fontSize: 7, color: DIFFICULTY_COLOUR[s.difficulty], border: `1px solid ${DIFFICULTY_COLOUR[s.difficulty]}55` }}>{s.difficulty}</span>
        </div>
        <div className="font-bold text-terminal-text-bright" style={{ fontSize: 16, lineHeight: 1.2 }}>{s.title}</div>
        <div className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{s.dateLabel} · {s.duration}</div>
        <div className="text-2xs text-terminal-text-dim leading-snug line-clamp-2">{s.description}</div>
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {s.facts.slice(0, 3).map((f) => <FactPill key={f.label} f={f} />)}
        </div>
        <button
          onClick={onPlay}
          className="mt-1 text-2xs font-bold tracking-widest border border-terminal-gold/60 text-terminal-gold py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >▶ REPLAY THIS</button>
      </div>
    </div>
  )
}

export default function MarketReplayModule() {
  const [scenarioId, setScenarioId] = useState(null)
  const [activeDate, setActiveDate] = useState(null) // null = not in replay mode
  const [scenarioEnd, setScenarioEnd] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [speedMs, setSpeedMs] = useState(1000)
  const [pickerValue, setPickerValue] = useState('2020-03-01')
  const [dismissedEvent, setDismissedEvent] = useState(null)
  const [view3D, setView3D] = useState(false)
  const intervalRef = useRef(null)

  const series = useMemo(() => (activeDate ? generateReplaySeries('^AXJO', activeDate, 90) : []), [activeDate])
  const movers = useMemo(() => (activeDate ? generateReplayMovers(activeDate) : []), [activeDate])
  const rate = activeDate ? rbaRateOn(activeDate) : null
  const event = activeDate ? eventOn(activeDate) : null

  useEffect(() => {
    if (!playing || !activeDate) return
    intervalRef.current = setInterval(() => {
      setActiveDate((d) => {
        const next = addDays(d, 1)
        const cap = scenarioEnd ?? TODAY
        if (next > cap) { setPlaying(false); return d }
        return next
      })
    }, speedMs)
    return () => clearInterval(intervalRef.current)
  }, [playing, activeDate, speedMs, scenarioEnd])

  const startReplay = (date, endDate = null) => {
    setActiveDate(date)
    setScenarioEnd(endDate)
    setDismissedEvent(null)
  }

  const exitReplay = () => {
    setActiveDate(null)
    setPlaying(false)
    setScenarioEnd(null)
  }

  const stepDay = (delta) => {
    setPlaying(false)
    setActiveDate((d) => {
      const next = addDays(d, delta)
      return next > TODAY ? TODAY : next
    })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader title="MARKET REPLAY" subtitle="Replay real market episodes · sourced figures, reconstructed paths" moduleId="replay" />

      {activeDate && !scenarioId && (
        <div className="bg-terminal-gold text-terminal-bg px-3 py-1.5 flex items-center justify-between flex-shrink-0">
          <span className="text-2xs font-bold tracking-widest">VIEWING: {fmtDate(activeDate)} — REPLAY MODE</span>
          <button onClick={exitReplay} className="text-2xs font-bold underline">EXIT REPLAY</button>
        </div>
      )}

      {scenarioId ? (
        <ScenarioPlayer key={scenarioId} scenario={SCENARIOS.find((x) => x.id === scenarioId)} onExit={() => setScenarioId(null)} />
      ) : !activeDate ? (
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-terminal-gold text-sm font-bold tracking-widest">SCENARIO LIBRARY</div>
                <div className="text-2xs text-terminal-text-dim mt-0.5">Replay real market episodes. Every figure is sourced; the path between sourced points is reconstructed and labelled as such.</div>
              </div>
              <span className="text-2xs text-terminal-text-dim/60">{SCENARIOS.length} scenarios</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {SCENARIOS.map((s) => <ScenarioCard key={s.id} s={s} onPlay={() => setScenarioId(s.id)} />)}
            </div>
          </div>

          <div className="border-t border-terminal-border pt-5 flex flex-col items-center gap-3">
            <div className="text-center max-w-md">
              <div className="text-terminal-text-dim text-2xs font-bold tracking-widest mb-1">OR BROWSE ANY DATE</div>
              <div className="text-2xs text-terminal-text-dim/70">Free browse shows the RBA cash rate as at the date with an illustrative index path — not sourced prices.</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={pickerValue}
                max={TODAY}
                onChange={(e) => setPickerValue(e.target.value)}
                className="bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2 py-1.5"
              />
              <button
                onClick={() => startReplay(pickerValue)}
                className="text-2xs text-terminal-gold border border-terminal-gold px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-widest"
              >VIEW THIS DATE</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
          {/* Educational annotation overlay */}
          {event && dismissedEvent !== event.date && (
            <div className="fixed top-20 right-6 z-50 max-w-xs bg-terminal-panel border border-terminal-gold shadow-2xl p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xs text-terminal-gold font-bold tracking-widest">ON THIS DAY</span>
                <button onClick={() => setDismissedEvent(event.date)} className="text-terminal-text-dim hover:text-terminal-red text-xs leading-none">✕</button>
              </div>
              <div className="text-2xs text-terminal-text mt-1">{event.text}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-text-dim">RBA CASH RATE (as at this date)</div>
              <div className="text-lg font-bold text-terminal-gold">{rate?.toFixed(2)}%</div>
            </div>
            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-text-dim">ASX 200 (illustrative index level)</div>
              <div className="text-lg font-bold text-terminal-text-bright">{series[series.length - 1]?.level.toFixed(1)}</div>
            </div>
            <div className="border border-terminal-border p-3">
              <div className="text-2xs text-terminal-text-dim">SCENARIO</div>
              <div className="text-2xs text-terminal-text-bright font-semibold">{scenarioEnd ? 'Custom range' : 'Free browse'}</div>
            </div>
          </div>

          <div className="border border-terminal-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xs text-terminal-gold font-bold tracking-widest">90D · ASX 200 INDEX LEVEL (ILLUSTRATIVE)</span>
              <div className="ml-auto flex items-center border border-terminal-border rounded-full overflow-hidden">
                <button
                  onClick={() => setView3D(false)}
                  className={`text-2xs px-2.5 py-0.5 font-bold transition-colors ${!view3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                >CHART VIEW</button>
                <button
                  onClick={() => setView3D(true)}
                  className={`text-2xs px-2.5 py-0.5 font-bold transition-colors ${view3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                >3D REPLAY</button>
              </div>
            </div>
            {view3D ? (
              <div style={{ height: 340 }}>
                <Suspense fallback={<Viz3DLoader />}>
                  <ReplayViewer3D series={series} event={event && dismissedEvent !== event.date ? event : null} />
                </Suspense>
              </div>
            ) : (
              <div style={{ height: 220 }}>
                <SafeChart width="100%" height="100%">
                  <AreaChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 9 }} stroke="var(--t-text-dim)" domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="level" stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.15} />
                  </AreaChart>
                </SafeChart>
              </div>
            )}
          </div>

          <div className="border border-terminal-border p-3">
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">MOVERS ON THIS DAY (ILLUSTRATIVE)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {movers.map((m) => (
                <div key={m.symbol} className="flex items-center justify-between border border-terminal-border/50 px-2 py-1.5">
                  <span className="text-2xs font-bold text-terminal-text-bright">{m.symbol.replace('.AX', '')}</span>
                  <span className={`text-2xs font-bold ${m.pct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>{m.pct >= 0 ? '+' : ''}{m.pct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-2xs text-terminal-text-dim/50 text-center tracking-widest">
            APPROXIMATE HISTORICAL DATA · FOR EDUCATIONAL PURPOSES ONLY
          </div>
        </div>
      )}

      {activeDate && !scenarioId && (
        <div className="border-t border-terminal-border px-4 py-2.5 flex items-center justify-center gap-4 flex-shrink-0 flex-wrap">
          <button onClick={() => stepDay(-1)} className="text-2xs text-terminal-text border border-terminal-border px-2.5 py-1 hover:border-terminal-gold hover:text-terminal-gold transition-colors">⏮ PREV DAY</button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="text-2xs text-terminal-gold border border-terminal-gold px-4 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold"
          >{playing ? '⏸ PAUSE' : '▶ PLAY'}</button>
          <button onClick={() => stepDay(1)} className="text-2xs text-terminal-text border border-terminal-border px-2.5 py-1 hover:border-terminal-gold hover:text-terminal-gold transition-colors">⏭ NEXT DAY</button>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-2xs text-terminal-text-dim">SPEED:</span>
            {SPEEDS.map((s) => (
              <button
                key={s.label}
                onClick={() => setSpeedMs(s.ms)}
                className={`text-2xs px-1.5 py-0.5 border ${speedMs === s.ms ? 'border-terminal-gold text-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:text-terminal-text'}`}
              >{s.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
