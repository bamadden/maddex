import { useEffect, useMemo, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot } from 'recharts'
import SafeChart from '../../components/ui/SafeChart'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { CATEGORY_STYLE, progressOf, reconstructPath } from '../../services/replayScenarios'

const FRAMES = 120
const SPEEDS = { '1x': 250, '5x': 50 }

const fmt = (v, dp) => v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })
const toneColour = (t) => (t === 'up' ? '#2D8A50' : t === 'down' ? '#A83232' : '#C9A84C')

export function FactPill({ f }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded-sm"
      style={{ fontSize: 9, color: toneColour(f.tone), background: `${toneColour(f.tone)}1F`, border: `1px solid ${toneColour(f.tone)}40` }}
      title={f.note}
    >
      <span className="opacity-80">{f.label}</span>
      <b className="tabular-nums">{f.value}</b>
    </span>
  )
}

function Quiz({ scenario, onAsk }) {
  const [answers, setAnswers] = useState({})
  const done = Object.keys(answers).length === scenario.quiz.length
  const score = scenario.quiz.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0)
  return (
    <div className="border border-terminal-border">
      <div className="px-3 py-2 border-b border-terminal-border flex items-center justify-between">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">QUIZ · WHAT HAPPENED?</span>
        {done && <span className="text-2xs font-bold" style={{ color: score === scenario.quiz.length ? '#2D8A50' : '#C9A84C' }}>SCORE {score}/{scenario.quiz.length}</span>}
      </div>
      <div className="p-3 space-y-3">
        {scenario.quiz.map((q, i) => {
          const picked = answers[i]
          return (
            <div key={q.q}>
              <div className="text-xs text-terminal-text-bright mb-1.5">{i + 1}. {q.q}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {q.options.map((o, j) => {
                  const isPicked = picked === j
                  const show = picked != null
                  const correct = j === q.answer
                  const colour = show && correct ? '#2D8A50' : show && isPicked ? '#A83232' : null
                  return (
                    <button
                      key={o}
                      disabled={show}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                      className="text-left text-2xs px-2 py-1.5 border transition-colors disabled:cursor-default"
                      style={{
                        borderColor: colour ?? 'rgba(99,120,153,0.35)',
                        color: colour ?? undefined,
                        background: colour ? `${colour}14` : undefined,
                      }}
                    >{o}</button>
                  )
                })}
              </div>
              {picked != null && (
                <div className="flex items-start justify-between gap-2 mt-1.5">
                  <span className="text-2xs text-terminal-text-dim">{picked === q.answer ? '✓ ' : '✕ '}{q.why}</span>
                  <button onClick={() => onAsk(`Explain the answer to this question about the ${scenario.title}: "${q.q}" The answer is "${q.options[q.answer]}" because ${q.why}`)}
                    className="text-2xs text-terminal-gold/70 hover:text-terminal-gold flex-shrink-0">ASK MADDENAI ▶</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ScenarioPlayer({ scenario, onExit }) {
  const style = CATEGORY_STYLE[scenario.category]
  const path = useMemo(() => reconstructPath(scenario, FRAMES), [scenario])
  const [frame, setFrame] = useState(0)
  const [playRequested, setPlaying] = useState(true)
  const [speed, setSpeed] = useState('1x')
  const feedRef = useRef(null)

  const complete = frame >= FRAMES
  // Derived rather than reset in an effect: reaching the end IS stopping.
  const playing = playRequested && !complete
  useEffect(() => {
    if (!playing || complete) return
    const id = setInterval(() => setFrame((f) => Math.min(FRAMES, f + 1)), SPEEDS[speed])
    return () => clearInterval(id)
  }, [playing, speed, complete])

  const p = frame / FRAMES
  const shown = path.slice(0, frame + 1)
  const current = path[frame]
  const events = scenario.timeline
    .map((e) => ({ ...e, p: progressOf(scenario.window, e.at) }))
    .filter((e) => e.p <= p + 1e-9)

  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }) }, [events.length])

  const { series } = scenario
  const start = path[0].value
  const changePct = ((current.value - start) / start) * 100
  const yVals = path.map((d) => d.value)
  const pad = (Math.max(...yVals) - Math.min(...yVals)) * 0.12 || Math.abs(start) * 0.002
  const domain = [Math.min(...yVals) - pad, Math.max(...yVals) + pad]

  const ask = (instruction) => dispatchAskAI({
    name: scenario.title, sector: 'Market history', date: todayAEST(),
    instruction: `${instruction}\n\nSourced facts for this scenario: ${scenario.facts.map((f) => `${f.label} ${f.value}${f.note ? ` (${f.note})` : ''}`).join('; ')}. Timeline: ${scenario.timeline.map((e) => `${e.at} — ${e.text}`).join(' ')} Use only these figures; describe anything else in words.`,
  })

  const dayLabel = scenario.window.kind === 'intraday'
    ? `Day 1 of 1 · ${new Date(`${scenario.window.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} · ${current.label}`
    : current.label

  const btn = 'text-2xs px-2.5 py-1 border transition-colors font-bold tracking-wider'
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${style.colour}40`, background: style.bg }}>
        <span className={`rounded-full ${playing ? 'pulse-gold' : ''}`} style={{ width: 7, height: 7, background: playing ? '#C9A84C' : '#4A6080' }} />
        <span className="text-2xs font-bold tracking-widest text-terminal-text-bright truncate">
          {complete ? '■ REPLAYED' : playing ? '▶ REPLAYING' : '❚❚ PAUSED'}: {scenario.title}
        </span>
        <span className="text-2xs font-mono text-terminal-text-dim tabular-nums ml-auto">{dayLabel}</span>
        <button onClick={onExit} className="text-2xs text-terminal-text-dim hover:text-terminal-gold">✕ EXIT</button>
      </div>

      {/* Controls + progress */}
      <div className="px-4 py-2 flex items-center gap-1.5 flex-wrap flex-shrink-0 border-b border-terminal-border">
        <button className={`${btn} border-terminal-border text-terminal-text-dim hover:text-terminal-gold`} onClick={() => { setFrame(0); setPlaying(false) }}>⏮ RESET</button>
        <button className={`${btn} ${speed === '1x' ? 'border-terminal-gold text-terminal-gold' : 'border-terminal-border text-terminal-text-dim'}`} onClick={() => setSpeed('1x')}>⏪ 1x</button>
        <button
          className={`${btn} border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-4`}
          onClick={() => { if (complete) { setFrame(0); setPlaying(true) } else setPlaying((v) => !v) }}
        >{playing ? '❚❚ PAUSE' : '▶ PLAY'}</button>
        <button className={`${btn} ${speed === '5x' ? 'border-terminal-gold text-terminal-gold' : 'border-terminal-border text-terminal-text-dim'}`} onClick={() => setSpeed('5x')}>⏩ 5x</button>
        <button className={`${btn} border-terminal-border text-terminal-text-dim hover:text-terminal-gold`} onClick={() => { setFrame(FRAMES); setPlaying(false) }}>⏭ JUMP TO END</button>
        <div className="flex-1 min-w-[160px] ml-2 h-1.5 bg-terminal-border/60 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFrame(Math.round(((e.clientX - r.left) / r.width) * FRAMES)); setPlaying(false) }}>
          <div className="h-full bg-terminal-gold transition-[width] duration-100" style={{ width: `${p * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0">
          {/* Market view */}
          <div className="p-4 border-r border-terminal-border">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-2xs text-terminal-text-dim tracking-widest">{series.label.toUpperCase()}</span>
              <span className="font-mono font-bold text-terminal-text-bright tabular-nums" style={{ fontSize: 22 }}>
                {fmt(current.value, series.dp)}{series.unit === '%' ? '%' : ''}
              </span>
              <span className="font-mono text-xs tabular-nums" style={{ color: changePct >= 0 ? '#2D8A50' : '#A83232' }}>
                {series.step ? `${current.value - start >= 0 ? '+' : ''}${Math.round((current.value - start) * 100)}bp` : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
              </span>
              <span className="ml-auto text-2xs text-terminal-text-dim/60">{series.unit !== '%' && series.unit !== 'pts' ? series.unit : ''}</span>
            </div>
            <div style={{ height: 260 }}>
              <SafeChart width="100%" height="100%">
                <AreaChart data={shown} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="replayFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#0F1E35" vertical={false} />
                  <XAxis dataKey="p" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]}
                    tickFormatter={(v) => path[Math.round(v * FRAMES)]?.label ?? ''} tick={{ fontSize: 9 }} stroke="#4A6080" />
                  <YAxis domain={domain} tick={{ fontSize: 9 }} stroke="#4A6080" width={52} tickFormatter={(v) => fmt(v, series.dp > 1 ? 1 : series.dp)} />
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                        <div className="text-terminal-text-dim">{payload[0].payload.label}</div>
                        <div className="text-terminal-gold font-semibold">{fmt(payload[0].value, series.dp)}</div>
                        <div className="text-terminal-text-dim/70">{payload[0].payload.anchor ? `SOURCED · ${payload[0].payload.note ?? ''}` : 'reconstructed'}</div>
                      </div>
                    ) : null}
                  />
                  <Area type={series.step ? 'stepAfter' : 'monotone'} dataKey="value" stroke="#C9A84C" strokeWidth={1.75} fill="url(#replayFill)" isAnimationActive={false} />
                  {shown.filter((d) => d.anchor).map((d) => (
                    <ReferenceDot key={d.p} x={d.p} y={d.value} r={3.5} fill="#C9A84C" stroke="#040d1a" />
                  ))}
                </AreaChart>
              </SafeChart>
            </div>
            <div className="text-2xs text-terminal-text-dim/60 mt-1">
              ● Gold dots are sourced levels. The line between them is RECONSTRUCTED — it shows the direction of travel, not a recorded path.
            </div>
          </div>

          {/* Narrative */}
          <div className="flex flex-col min-h-[300px]">
            <div className="px-3 py-2 border-b border-terminal-border text-2xs text-terminal-gold font-bold tracking-widest">WHAT HAPPENED</div>
            <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: 330 }}>
              {events.length === 0 && <div className="text-2xs text-terminal-text-dim/60">Events appear as the replay reaches them.</div>}
              {events.map((e, i) => (
                <div key={`${e.at}-${i}`} className="panel-fade" style={{ borderLeft: `2px solid ${e.key ? '#C9A84C' : 'rgba(99,120,153,0.35)'}`, paddingLeft: 8 }}>
                  <div className="font-mono text-terminal-gold/80" style={{ fontSize: 9 }}>
                    {scenario.window.kind === 'intraday' ? e.at : new Date(`${e.at}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div className={`text-2xs leading-snug ${e.key ? 'text-terminal-text-bright' : 'text-terminal-text'}`}>{e.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {complete && (
          <div className="p-4 space-y-4 border-t border-terminal-border">
            <div className="border border-terminal-border">
              <div className="px-3 py-2 border-b border-terminal-border flex items-center justify-between">
                <span className="text-2xs text-terminal-gold font-bold tracking-widest">WHAT HAPPENED IN THIS SCENARIO</span>
                <button onClick={() => ask(`Walk me through the ${scenario.title} (${scenario.dateLabel}) — what drove it, how markets reacted, and what an Australian investor can learn from it.`)}
                  className="text-2xs border border-terminal-gold/50 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">ASK MADDENAI ▶</button>
              </div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                {scenario.facts.map((f) => (
                  <div key={f.label} className="border border-terminal-border/60 px-2.5 py-2">
                    <div className="text-2xs text-terminal-text-dim">{f.label}</div>
                    <div className="font-mono font-bold tabular-nums" style={{ fontSize: 16, color: toneColour(f.tone) }}>{f.value}</div>
                    {f.note && <div className="text-2xs text-terminal-text-dim/70">{f.note}</div>}
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3">
                <div className="text-2xs text-terminal-text-dim font-bold tracking-widest mb-1">KEY LESSONS</div>
                <ul className="space-y-1">
                  {scenario.lessons.map((l) => <li key={l} className="text-2xs text-terminal-text leading-snug">— {l}</li>)}
                </ul>
                <div className="text-2xs text-terminal-text-dim/50 mt-2">Sources: {scenario.sources.join(' · ')}</div>
              </div>
            </div>
            <Quiz scenario={scenario} onAsk={ask} />
          </div>
        )}
      </div>
    </div>
  )
}
