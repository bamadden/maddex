import { dispatchAskAI } from '../../utils/askAI'
import { sessionCountdown, formatCountdown, SEVERITY_COLOUR } from './intelMapData'

// Slide-in detail panel for whatever is selected on the intelligence map.
//
// One panel with per-type bodies rather than four separate components: the
// chrome (header, close, scroll, width) is identical in every case, and the
// only thing that varies is the content block.

const S = {
  label: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 8, color: '#4A6080', letterSpacing: '0.15em', marginBottom: 3, textTransform: 'uppercase' },
  value: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, color: '#E8EDF5', marginBottom: 12 },
  gold:  { color: '#C9A84C' },
  muted: { color: '#8BA3C4', fontSize: 11, lineHeight: 1.6 },
  pill:  { display: 'inline-block', fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, padding: '2px 6px', borderRadius: 2, marginRight: 4, marginBottom: 4 },
}

// Horizontal 0-100 meter. A number alone doesn't say whether 74 is bad;
// a filled bar against a track does.
function Meter({ score, colour }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ ...S.label, marginBottom: 0 }}>Severity</span>
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 15, fontWeight: 700, color: colour }}>{score}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(99,120,153,0.2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: colour, transition: 'width .3s ease' }} />
      </div>
    </div>
  )
}

// Where "now" sits inside the trading day — a bar reads faster than a pair
// of timestamps you have to subtract in your head.
function SessionTimeline({ exchange }) {
  const { open, mins } = sessionCountdown(exchange)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: exchange.tz }))
  const hour = now.getHours() + now.getMinutes() / 60
  const span = exchange.closeHour - exchange.openHour
  const pct = Math.min(100, Math.max(0, ((hour - exchange.openHour) / span) * 100))

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={S.label}>Session</div>
      <div style={{ position: 'relative', height: 14, background: 'rgba(99,120,153,0.15)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: open ? 'rgba(45,138,80,0.25)' : 'transparent' }} />
        {open && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct}%`, width: 2, background: '#C9A84C' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"IBM Plex Mono", monospace', fontSize: 8, letterSpacing: '0.15em',
          color: open ? '#2D8A50' : '#637899' }}>
          {open ? `OPEN · CLOSES IN ${formatCountdown(mins)}` : `CLOSED · OPENS IN ${formatCountdown(mins)}`}
        </div>
      </div>
    </div>
  )
}

function TickerPills({ tickers, watchlist = [] }) {
  if (!tickers?.length) return <div style={{ ...S.muted, color: '#4A6080' }}>None identified</div>
  return (
    <div>
      {tickers.map((t) => {
        const sym = typeof t === 'string' ? t : t.ticker
        const held = watchlist.some((w) => w.toUpperCase().replace('.AX', '') === sym.toUpperCase())
        return (
          <span key={sym} title={held ? 'On your watchlist' : undefined}
            style={{ ...S.pill,
              background: held ? 'rgba(201,168,76,0.18)' : 'rgba(99,120,153,0.12)',
              border: `1px solid ${held ? 'rgba(201,168,76,0.5)' : 'rgba(99,120,153,0.25)'}`,
              color: held ? '#C9A84C' : '#8BA3C4' }}>
            {held ? '★ ' : ''}{sym}
          </span>
        )
      })}
    </div>
  )
}

// `width` is supplied by the map, which sizes it against its own measured
// width rather than the viewport's — the map is one column of three, so a
// wide window does not imply a wide map.
export default function MapDetailPanel({ object, onClose, onFlyTo, watchlist = [], width = 300 }) {
  const { type, data } = object
  const askAI = (instruction) => dispatchAskAI({ instruction }, { rawPrompt: true })

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, width, maxHeight: 'calc(100% - 24px)',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(6,13,26,0.96)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 4,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 20, backdropFilter: 'blur(12px)',
      animation: 'panelSlideIn .2s ease-out',
    }}>
      <div style={{ background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.15)',
        padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: '#C9A84C', letterSpacing: '0.15em' }}>
          {type.toUpperCase()} DETAIL
        </span>
        <button onClick={onClose} aria-label="Close"
          style={{ background: 'none', border: 'none', color: '#637899', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
      </div>

      <div className="thin-scrollbar" style={{ padding: 14, overflowY: 'auto', minHeight: 0 }}>
        {type === 'exchange' && (
          <>
            <div style={{ ...S.value, fontSize: 17, marginBottom: 4 }}>{data.flag} {data.id}</div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{data.city} · {data.index}</div>

            <div style={S.label}>Level</div>
            <div style={{ ...S.value, ...S.gold, fontSize: 22, marginBottom: 4 }}>{data.value.toLocaleString()}</div>
            <div style={{ ...S.value, fontSize: 14, color: data.change >= 0 ? '#2D8A50' : '#A83232' }}>
              {data.change >= 0 ? '▲' : '▼'} {Math.abs(data.change)}%
            </div>

            <SessionTimeline exchange={data} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={S.label}>Daily volume</div>
                <div style={{ ...S.value, marginBottom: 0, fontSize: 12 }}>A${(data.volume / 1e9).toFixed(1)}B</div>
              </div>
              <div>
                <div style={S.label}>Market cap</div>
                <div style={{ ...S.value, marginBottom: 0, fontSize: 12 }}>A${(data.marketCap / 1e12).toFixed(1)}T</div>
              </div>
            </div>

            <div style={S.label}>Top constituents</div>
            <TickerPills tickers={data.topStocks} watchlist={watchlist} />

            <button onClick={() => askAI(`What is driving the ${data.index} on the ${data.id} today? Cover the main sector moves and what an Australian investor should take from it.`)}
              className="btn-secondary btn-sm" style={{ marginTop: 12, width: '100%' }}>
              ASK MADDENAI
            </button>
          </>
        )}

        {type === 'disruption' && (
          <>
            <div style={{ color: '#A83232', fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              ⚠ {data.title}
            </div>
            <Meter score={data.severityScore} colour={`rgb(${(SEVERITY_COLOUR[data.severity] ?? [201,168,76]).join(',')})`} />
            <div style={{ ...S.muted, marginBottom: 12 }}>{data.detail}</div>

            <div style={S.label}>Market impact</div>
            <div style={{ ...S.muted, ...S.gold, marginBottom: 12 }}>{data.impact}</div>

            <div style={S.label}>Affected routes</div>
            <div style={{ marginBottom: 12 }}>
              {data.affectedRoutes.map((r) => (
                <div key={r} style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: '#8BA3C4', marginBottom: 2 }}>→ {r}</div>
              ))}
            </div>

            <div style={S.label}>Commodities in the lane</div>
            <div style={{ marginBottom: 12 }}><TickerPills tickers={data.commodities} /></div>

            <div style={S.label}>ASX exposure</div>
            <div style={{ marginBottom: 12 }}>
              {data.asxImpact?.length
                ? data.asxImpact.map((a) => (
                    <div key={a.ticker} style={{ marginBottom: 4 }}>
                      <TickerPills tickers={[a.ticker]} watchlist={watchlist} />
                      <span style={{ ...S.muted, fontSize: 10 }}>{a.why}</span>
                    </div>
                  ))
                : <div style={{ ...S.muted, color: '#4A6080' }}>No direct ASX exposure identified</div>}
            </div>

            <div style={S.label}>Active since</div>
            <div style={S.value}>{data.startDate}</div>

            <button onClick={() => onFlyTo?.({ longitude: data.coordinates[0], latitude: data.coordinates[1], zoom: 5, pitch: 40, bearing: 0 })}
              className="btn-secondary btn-sm" style={{ width: '100%' }}>
              ZOOM TO ZONE
            </button>
          </>
        )}

        {type === 'geopolitical' && (
          <>
            <div style={{ color: '#A83232', fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              {data.title}
            </div>
            <span style={{ ...S.pill, background: 'rgba(99,120,153,0.15)', border: '1px solid rgba(99,120,153,0.3)', color: '#8BA3C4' }}>
              {data.type}
            </span>
            <div style={{ marginTop: 10 }}>
              <Meter score={data.riskScore} colour={`rgb(${(SEVERITY_COLOUR[data.severity] ?? [201,168,76]).join(',')})`} />
            </div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{data.summary}</div>

            <div style={S.label}>Market impact</div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{data.marketImpact}</div>

            <div style={S.label}>Australian trade dependence</div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ ...S.pill,
                background: data.auTrade.level === 'HIGH' ? 'rgba(168,50,50,0.18)' : data.auTrade.level === 'MEDIUM' ? 'rgba(201,168,76,0.18)' : 'rgba(45,138,80,0.18)',
                border: `1px solid ${data.auTrade.level === 'HIGH' ? 'rgba(168,50,50,0.5)' : data.auTrade.level === 'MEDIUM' ? 'rgba(201,168,76,0.5)' : 'rgba(45,138,80,0.5)'}`,
                color: data.auTrade.level === 'HIGH' ? '#A83232' : data.auTrade.level === 'MEDIUM' ? '#C9A84C' : '#2D8A50' }}>
                {data.auTrade.level}
              </span>
              <div style={{ ...S.muted, fontSize: 10, marginTop: 4 }}>{data.auTrade.note}</div>
            </div>

            <div style={S.label}>Alliance context</div>
            <div style={{ marginBottom: 12 }}>
              {data.alliances.map((a) => (
                <div key={a} style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: '#8BA3C4', marginBottom: 2 }}>→ {a}</div>
              ))}
            </div>

            <div style={S.label}>ASX exposure</div>
            <div style={{ ...S.muted, ...S.gold, marginBottom: 12 }}>{data.asxExposure}</div>

            <button onClick={() => askAI(`Explain the current state of "${data.title}" and what it means for Australian investors — which ASX sectors and stocks are most exposed, and what would change the picture.`)}
              className="btn-secondary btn-sm" style={{ width: '100%' }}>
              ASK MADDENAI
            </button>
          </>
        )}

        {type === 'commodity' && (
          <>
            <div style={{ ...S.gold, fontFamily: '"IBM Plex Mono", monospace', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              {data.commodity}
            </div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{data.country}</div>

            <div style={S.label}>Annual production</div>
            <div style={{ ...S.value, ...S.gold, fontSize: 18, marginBottom: 8 }}>{data.production} {data.unit}</div>

            <div style={S.label}>Share of global output</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 4, background: 'rgba(99,120,153,0.2)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                <div style={{ width: `${data.globalSharePct}%`, height: '100%', background: `rgb(${data.color.join(',')})` }} />
              </div>
              <span style={{ ...S.muted, fontSize: 10 }}>{data.globalSharePct}% of world supply</span>
            </div>

            {data.auRank && (
              <>
                <div style={S.label}>Australia&apos;s global rank</div>
                <div style={{ ...S.value, ...S.gold, fontSize: 15 }}>#{data.auRank} producer</div>
              </>
            )}

            <div style={S.label}>Major producers</div>
            <div style={{ marginBottom: 12 }}>
              {data.companies.map((c) => (
                <div key={c} style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: '#8BA3C4', marginBottom: 2 }}>→ {c}</div>
              ))}
            </div>

            <div style={S.label}>ASX exposure</div>
            <TickerPills tickers={data.asx} watchlist={watchlist} />

            {data.disrupted && (
              <div style={{ marginTop: 12, padding: '6px 8px', background: 'rgba(168,50,50,0.12)',
                borderLeft: '2px solid #A83232', fontSize: 10, color: '#C88', fontFamily: '"IBM Plex Mono", monospace' }}>
                ⚠ SUPPLY DISRUPTED
              </div>
            )}

            <button onClick={() => askAI(`Give me a read on the ${data.commodity} market right now — price drivers, supply picture, and which ASX-listed names have the most leverage to it.`)}
              className="btn-secondary btn-sm" style={{ marginTop: 12, width: '100%' }}>
              ASK MADDENAI
            </button>
          </>
        )}
      </div>
    </div>
  )
}
