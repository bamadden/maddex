import { useEffect, useState } from 'react'
import { EXCHANGES, isExchangeOpen } from './intelMapData'
import { getMockFMPRow } from '../../services/mockData'
import { askMaddenAI } from '../../utils/askAI'
import { PAL } from '../../styles/palette.js'

// The card for a financial district, shown when the map is zoomed into one
// (zoom 13+, centred within about ten kilometres). Institutions are reference
// facts from intelMapData; the clock and session come from the exchange's own
// hours; the index move is the terminal's quote layer, labelled DEMO.

const mono = { fontFamily: '"IBM Plex Mono", monospace' }

function useClock(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

export function DistrictCard({ district: d, insetL = 0 }) {
  const now = useClock()
  const ex = EXCHANGES.find((e) => e.id === d.exchange)
  const open = ex ? isExchangeOpen(ex) : null
  const q = d.index ? getMockFMPRow(d.index) : null
  const time = new Date(now).toLocaleTimeString('en-AU', { timeZone: d.tz, hour: 'numeric', minute: '2-digit' })
  const zone = new Intl.DateTimeFormat('en-AU', { timeZone: d.tz, timeZoneName: 'short' }).formatToParts(new Date(now)).find((p) => p.type === 'timeZoneName')?.value ?? ''
  const pct = q?.regularMarketChangePercent

  return (
    <div style={{
      position: 'absolute', top: 64, left: 14 + insetL, width: 300, zIndex: 10,
      background: 'rgba(6,13,26,0.92)', border: '1px solid rgba(201,168,76,0.45)', borderRadius: 2,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', padding: '12px 14px',
    }}>
      <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: PAL.gold, letterSpacing: '0.08em' }}>{d.name}</div>
      <div style={{ ...mono, fontSize: 11, color: PAL.muted, letterSpacing: '0.18em', marginBottom: 10 }}>FINANCIAL DISTRICT</div>

      <div style={{ ...mono, fontSize: 11, color: PAL.muted, letterSpacing: '0.15em', marginBottom: 4 }}>KEY INSTITUTIONS</div>
      {d.institutions.map((i) => (
        <div key={i} style={{ ...mono, fontSize: 11, color: '#C8D3E0', lineHeight: 1.6 }}><span style={{ color: PAL.gold }}>●</span> {i}</div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(99,120,153,0.25)' }}>
        <span style={{ ...mono, fontSize: 11, color: PAL.bright }}>{time} {zone}</span>
        {open != null && (
          <span style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: open ? PAL.up : PAL.muted }}>
            {open ? '● MARKET OPEN' : '○ MARKET CLOSED'}
          </span>
        )}
      </div>
      {q && pct != null && (
        <div style={{ ...mono, fontSize: 11, color: PAL.dim, marginTop: 4 }}>
          Today&apos;s {d.indexLabel}: <span style={{ color: pct >= 0 ? PAL.up : PAL.down, fontWeight: 700 }}>{pct >= 0 ? '▲ +' : '▼ '}{pct.toFixed(2)}%</span>
          <span style={{ color: PAL.muted, fontSize: 11, marginLeft: 6 }}>DEMO</span>
        </div>
      )}

      <button
        onClick={() => askMaddenAI(`Describe what has been reported today about ${d.indexLabel ? `the ${d.indexLabel} and ` : ''}the financial markets centred on ${d.name.toLowerCase()}, and how they connect to Australia. Describe only: no forecasts and no view on markets or stocks.`)}
        className="btn-secondary btn-sm"
        style={{ width: '100%', marginTop: 10 }}
      >ASK MADDENAI ABOUT {d.name.split(/[ ,/]/)[0]} MARKETS</button>
    </div>
  )
}
