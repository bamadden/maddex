import { useEffect, useState } from 'react'
import { EXCHANGES, isExchangeOpen } from './intelMapData'
import { getMockFMPRow } from '../../services/mockData'
import { askMaddenAI } from '../../utils/askAI'

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
      <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.08em' }}>{d.name}</div>
      <div style={{ ...mono, fontSize: 8, color: '#637899', letterSpacing: '0.18em', marginBottom: 10 }}>FINANCIAL DISTRICT</div>

      <div style={{ ...mono, fontSize: 8, color: '#4A6080', letterSpacing: '0.15em', marginBottom: 4 }}>KEY INSTITUTIONS</div>
      {d.institutions.map((i) => (
        <div key={i} style={{ ...mono, fontSize: 10, color: '#C8D3E0', lineHeight: 1.6 }}><span style={{ color: '#C9A84C' }}>●</span> {i}</div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(99,120,153,0.25)' }}>
        <span style={{ ...mono, fontSize: 11, color: '#E8EDF5' }}>{time} {zone}</span>
        {open != null && (
          <span style={{ ...mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: open ? '#2D8A50' : '#637899' }}>
            {open ? '● MARKET OPEN' : '○ MARKET CLOSED'}
          </span>
        )}
      </div>
      {q && pct != null && (
        <div style={{ ...mono, fontSize: 10, color: '#8BA3C4', marginTop: 4 }}>
          Today&apos;s {d.indexLabel}: <span style={{ color: pct >= 0 ? '#2D8A50' : '#CC4444', fontWeight: 700 }}>{pct >= 0 ? '▲ +' : '▼ '}{pct.toFixed(2)}%</span>
          <span style={{ color: '#4A6080', fontSize: 8, marginLeft: 6 }}>DEMO</span>
        </div>
      )}

      <button
        onClick={() => askMaddenAI(`What's driving ${d.indexLabel ? `the ${d.indexLabel} and ` : ''}the financial markets centred on ${d.name.toLowerCase()} right now, and what does it mean for Australian investors?`)}
        className="btn-secondary btn-sm"
        style={{ width: '100%', marginTop: 10 }}
      >ASK MADDENAI ABOUT {d.name.split(/[ ,/]/)[0]} MARKETS</button>
    </div>
  )
}
