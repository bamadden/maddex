import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { spreadOn, spreadSeries, spreadStats } from '../../data/policySpread'
import SafeChart from '../../components/ui/SafeChart'

// ─── AU – US policy spread monitor ─────────────────────────────────────────
//
// The cash-rate gap between the RBA and the Fed, which is the one that moves
// the AUD on decision days. Current level, its twelve-month path and the
// five-year context are all computed in data/policySpread.js from the two
// verified decision histories — including the average, which the brief
// suggested showing as an AI estimate. See that file for why it isn't one.

const signedBp = (bp) => `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${Math.abs(Math.round(bp))}bp`
const monthYear = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
const dayMonth = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })

function SparkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{dayMonth(p.date)}</div>
      <div className="font-bold text-terminal-text-bright">{signedBp(p.bp)}</div>
      <div className="text-terminal-text-dim">RBA {p.au.toFixed(2)}% · Fed {p.us.toFixed(2)}%</div>
    </div>
  )
}

export default function PolicySpreadMonitor() {
  const { rba, fed } = VERIFIED_CONSTANTS
  const [now] = useState(() => Date.now())

  const { today, series, five } = useMemo(() => {
    const day = new Date(now).toISOString().slice(0, 10)
    return {
      today: spreadOn(day),
      series: spreadSeries(now - 365 * 86400000, now),
      five: spreadStats(5, now),
    }
  }, [now])

  if (today == null) return null
  const premium = today >= 0
  const yearAgo = series[0]?.bp
  const atHigh = five && today >= five.hi

  return (
    <div className="border border-terminal-border">
      <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-terminal-border">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">AU / US POLICY SPREAD</span>
        <span className="text-[9px] text-terminal-text-dim">RBA − Fed upper bound</span>
      </div>

      <div className="px-3 py-2 grid grid-cols-3 gap-2">
        <div>
          <div className="text-[9px] text-terminal-text-dim tracking-wider">AU POLICY RATE</div>
          <div className="text-sm font-bold text-terminal-text-bright tabular-nums">{rba.cashRate.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-[9px] text-terminal-text-dim tracking-wider">US POLICY RATE</div>
          <div className="text-sm font-bold text-terminal-text-bright tabular-nums">{fed.rateRange}</div>
          <div className="text-[9px] text-terminal-text-dim">upper {fed.cashRate.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-[9px] text-terminal-text-dim tracking-wider">SPREAD</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: premium ? '#2D8A50' : '#CC4444' }}>{signedBp(today)}</div>
          <div className="text-[9px] text-terminal-text-dim">{premium ? 'AU premium' : 'AU discount'}</div>
        </div>
      </div>

      <div className="px-3">
        <div className="flex items-baseline justify-between text-[9px] text-terminal-text-dim tracking-wider">
          <span>LAST 12 MONTHS</span>
          {yearAgo != null && <span>{signedBp(yearAgo)} → {signedBp(today)}</span>}
        </div>
        <div style={{ height: 70 }}>
          <SafeChart width="100%" height="100%">
            <LineChart data={series} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
              <YAxis domain={['dataMin - 15', 'dataMax + 15']} hide />
              <ReferenceLine y={0} stroke="rgba(201,168,76,0.35)" strokeDasharray="2 3" />
              <Tooltip content={<SparkTooltip />} />
              <Line type="stepAfter" dataKey="bp" stroke="#C9A84C" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </SafeChart>
        </div>
        <div className="flex justify-between text-[9px] text-terminal-text-dim/60 -mt-0.5">
          <span>{monthYear(series[0].date)}</span><span>dashed = parity</span><span>{monthYear(series[series.length - 1].date)}</span>
        </div>
      </div>

      {five && (
        <div className="px-3 py-2 mt-1 border-t border-terminal-border/50 text-[10px] text-terminal-text-dim leading-relaxed">
          Over the five years from {monthYear(five.from)} the spread averaged{' '}
          <b className="text-terminal-text-bright tabular-nums">{signedBp(five.mean)}</b>, ranging from{' '}
          <span className="tabular-nums">{signedBp(five.lo)}</span> ({monthYear(five.loDay)}) to{' '}
          <span className="tabular-nums">{signedBp(five.hi)}</span>. Through the 2022–25 cycle the Fed sat well above the RBA;
          {' '}{atHigh
            ? `today's ${signedBp(today)} is the widest AU premium in that window, first reached in ${monthYear(five.hiDay)}.`
            : `today's ${signedBp(today)} compares with that average.`}
          {' '}A wider AU premium is, all else equal, supportive for the AUD.
          <div className="text-terminal-text-dim/50 mt-1">
            Computed daily from the verified RBA and FOMC decision histories (effective dates). Not an estimate.
          </div>
        </div>
      )}
    </div>
  )
}
