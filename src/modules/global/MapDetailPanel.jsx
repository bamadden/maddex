import { dispatchAskAI } from '../../utils/askAI'
import { graphNodeForTicker, graphNodeForCommodity } from '../../data/graph/nodes'
import { openInRelationships } from '../../utils/openRelationships'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'
import { sessionCountdown, formatCountdown, SEVERITY_COLOUR, ROUTE_NOTES, SITE_EXTRAS, greatCircleKm } from './intelMapData'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import { useStore } from '../../store/useStore'
import { screenSector } from '../markets/screenSector'

const RISK_TONE = { LOW: '#2D8A50', MEDIUM: '#C9A84C', ELEVATED: '#D9773B', HIGH: '#CC4444' }
// Main WA export port, for the route distance (the arcs start from a map anchor).
const PORT_HEDLAND = [118.6, -20.3]
const SYDNEY = [151.2, -33.9]
const KNOTS_14_KM_PER_DAY = 14 * 1.852 * 24

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

// The first thing on this card that is a node in the Relationships graph —
// the commodity itself, else the first ASX ticker named — and a link to it.
// Nothing renders when the card names nothing the graph holds.
function RelationshipsLink({ data, setActiveModule }) {
  const tickers = [...(data?.asx ?? []), ...(data?.topStocks ?? []), ...(data?.asxImpact ?? [])].map((t) => (typeof t === 'string' ? t : t?.ticker))
  const target = graphNodeForCommodity(data?.commodity) ?? tickers.map(graphNodeForTicker).find(Boolean)
  if (!target) return null
  return (
    <button onClick={() => openInRelationships(setActiveModule, target)}
      className="btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }}>
      ⊶ OPEN {target.replace(/^cmd:/, '').replace(/-/g, ' ').toUpperCase()} IN RELATIONSHIPS
    </button>
  )
}

// `width` is supplied by the map, which sizes it against its own measured
// width rather than the viewport's — the map is one column of three, so a
// wide window does not imply a wide map.
export default function MapDetailPanel({ object, onClose, onFlyTo, watchlist = [], width = 300, insetRight = 0, narrativeSource = 'fallback' }) {
  const { type, data } = object
  const { setActiveModule } = useStore()
  const askAI = (instruction) => dispatchAskAI({ instruction }, { rawPrompt: true })

  return (
    // insetRight, and z-index above CONTROL rather than at PANEL.
    //
    // GlobalModule renders a 32px rail down the right edge of the map below
    // 1700px. Every other piece of map furniture — the HUD frame, the
    // coordinate readout, the fullscreen toggle — offsets itself by
    // chromeInset.right for exactly that reason. This panel did not, so it
    // was pinned to right:12 and the rail sat on top of its right-hand edge,
    // clipping the close button and the scrollbar.
    //
    // z-index also has to clear CONTROL (25), not just PANEL (20): the
    // fullscreen toggle is deliberately above PANEL so it stays clickable,
    // and at 20 this panel rendered underneath it.
    <div style={{
      position: 'absolute', top: 12, right: 12 + insetRight, width, maxHeight: 'calc(100% - 24px)',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(6,13,26,0.96)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 4,
      boxShadow: 'var(--shadow-floating)', zIndex: 30, backdropFilter: 'blur(12px)',
      overflowY: 'auto',
      animation: 'panelSlideIn .2s ease-out',
    }}>
      <div style={{ background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.15)',
        padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: '#C9A84C', letterSpacing: '0.15em' }}>
            {type === 'ausite' ? 'RESOURCE REGION' : type === 'route' ? 'TRADE ROUTE' : type === 'cbevent' ? 'RATE DECISION' : `${type.toUpperCase()} DETAIL`}
          </span>
          {/* Only where the words on this card were actually rewritten by
              MaddenAI. A row the overlay did not match keeps its editorial
              prose and says nothing, which is the honest signal. */}
          {data?.aiNarrative && <AIContentBadge source={narrativeSource} />}
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
            {data.value != null ? (
              <>
                <div style={{ ...S.value, ...S.gold, fontSize: 22, marginBottom: 4 }}>{data.value.toLocaleString('en-AU', { maximumFractionDigits: 1 })}</div>
                <div style={{ ...S.value, fontSize: 14, color: data.change >= 0 ? '#2D8A50' : '#A83232' }}>
                  {data.change >= 0 ? '▲' : '▼'} {Math.abs(data.change).toFixed(2)}%
                  {data.demo && <span style={{ ...S.muted, fontSize: 9, marginLeft: 8 }}>DEMO</span>}
                </div>
              </>
            ) : (
              <div style={{ ...S.muted, marginBottom: 4 }}>No index feed for {data.index} in this build.</div>
            )}

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

        {type === 'route' && (() => {
          const partner = data.country
          const exp = data.dir === 'export'
          const note = ROUTE_NOTES[partner]
          const origin = exp ? PORT_HEDLAND : data.from
          const dest = exp ? data.to : SYDNEY
          const km = greatCircleKm(origin, dest)
          return (
            <>
              <div style={{ ...S.gold, fontFamily: '"IBM Plex Mono", monospace', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                {exp ? `AUSTRALIA → ${partner.toUpperCase()}` : `${partner.toUpperCase()} → AUSTRALIA`}
              </div>
              <div style={{ ...S.muted, marginBottom: 12 }}>{exp ? 'Exports' : 'Imports'} · {data.main}</div>
              <div style={S.label}>Value, {VERIFIED_CONSTANTS.auTrade?.period}</div>
              <div style={{ ...S.value, marginBottom: 2 }}>
                <span style={{ ...S.gold, fontSize: 20 }}>A${data.bn.toFixed(1)}b</span>
                <span style={{ ...S.muted, fontSize: 10 }}> · {data.share.toFixed(1)}% of {exp ? 'exports' : 'imports'}</span>
              </div>
              <div style={{ ...S.muted, fontSize: 9, marginBottom: 12 }}>ABS International Trade, goods and services</div>
              <div style={S.label}>Distance and transit</div>
              <div style={{ ...S.value, fontSize: 12, marginBottom: 2 }}>~{(Math.round(km / 100) * 100).toLocaleString('en-AU')} km · ~{Math.max(1, Math.round(km / KNOTS_14_KM_PER_DAY))} days at sea</div>
              <div style={{ ...S.muted, fontSize: 9, marginBottom: 12 }}>Estimate: great-circle {exp ? 'from Port Hedland' : 'to Sydney'} at 14 knots; real routes are longer.</div>
              {note && (
                <>
                  <div style={S.label}>Sea lanes</div>
                  <div style={{ ...S.muted, fontSize: 10, marginBottom: 12 }}>{note.lanes}</div>
                  <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}><span>Risk factors</span><span style={{ color: '#637899' }}>EDITORIAL</span></div>
                  {note.risks.map(([k, level, why]) => (
                    <div key={k} style={{ marginBottom: 7 }} title={why}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10 }}>
                        <span style={{ color: '#C8D3E0' }}>● {k}</span>
                        <span style={{ color: RISK_TONE[level], fontWeight: 700 }}>{level}</span>
                      </div>
                      <div style={{ ...S.muted, fontSize: 9, lineHeight: 1.4 }}>{why}</div>
                    </div>
                  ))}
                </>
              )}
              <button onClick={() => askAI(`Tell me about Australia's ${exp ? 'export' : 'import'} trade ${exp ? 'with' : 'from'} ${partner}: A$${data.bn.toFixed(1)}b in ${VERIFIED_CONSTANTS.auTrade?.period} (ABS), mainly ${data.main}. What are the main risks to this route right now, and which ASX-listed companies are most exposed?`)}
                className="btn-secondary btn-sm" style={{ marginTop: 6, width: '100%' }}>
                ASK MADDENAI ABOUT THIS ROUTE
              </button>
            </>
          )
        })()}

        {type === 'cbevent' && (
          <>
            <div style={{ ...S.gold, fontFamily: '"IBM Plex Mono", monospace', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{data.event}</div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{data.site.bank} · {data.site.city}</div>
            <div style={S.label}>When (Sydney time)</div>
            <div style={{ ...S.value, fontSize: 12 }}>
              {new Date(`${data.date}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}{data.time && data.time !== '—' ? ` · ${data.time}` : ''}
            </div>
            {data.description && (
              <>
                <div style={S.label}>Context</div>
                <div style={{ ...S.muted, fontSize: 10, marginBottom: 12 }}>{data.description}</div>
              </>
            )}
            <button onClick={() => askAI(`The ${data.event} is due ${data.date}. Using the central-bank figures in your context, what is expected, and what would a surprise mean for the AUD and ASX?`)}
              className="btn-secondary btn-sm" style={{ width: '100%' }}>
              ASK MADDENAI
            </button>
          </>
        )}

        {type === 'ausite' && (
          <>
            <div style={{ ...S.gold, fontFamily: '"IBM Plex Mono", monospace', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {data.name}
            </div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{data.commodity} · {data.region}</div>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: '#E6EDF6', lineHeight: 1.55, marginBottom: 12 }}>{data.note}</div>
            {(() => {
              const x = SITE_EXTRAS[data.id]
              if (!x) return null
              const c = VERIFIED_CONSTANTS.commodities
              const price = x.price ? c?.[x.price] : null
              return (
                <>
                  <div style={S.label}>{x.priceLabel}</div>
                  {price != null ? (
                    <div style={{ ...S.value, marginBottom: 2 }}>
                      <span style={S.gold}>{price.toLocaleString('en-AU', { maximumFractionDigits: 2 })}</span> <span style={{ ...S.muted, fontSize: 10 }}>{x.unit}</span>
                    </div>
                  ) : (
                    <div style={{ ...S.muted, marginBottom: 2 }}>No verified price held for this product.</div>
                  )}
                  {price != null && <div style={{ ...S.muted, fontSize: 9, marginBottom: 12 }}>{c.sourceBy?.[x.price]} · as at {c.asOfBy?.[x.price]}</div>}
                  <div style={S.label}>Production</div>
                  <div style={{ ...S.muted, fontSize: 10, marginBottom: 12 }}>{data.id === 'au-pilbara' ? 'See export earnings above (Resources and Energy Quarterly).' : 'Regional production volume not yet sourced in this build.'}</div>
                  <div style={S.label}>Operational risks</div>
                  <ul style={{ margin: '0 0 12px', paddingLeft: 14 }}>
                    {x.risks.map((rk) => <li key={rk} style={{ ...S.muted, fontSize: 10, lineHeight: 1.5 }}>{rk}</li>)}
                  </ul>
                </>
              )
            })()}
            <div style={S.label}>ASX-listed producers</div>
            <TickerPills tickers={data.asx} watchlist={watchlist} />
            {SITE_EXTRAS[data.id]?.sector && (
              <button onClick={() => screenSector(SITE_EXTRAS[data.id].sector, setActiveModule)}
                className="btn-secondary btn-sm" style={{ marginTop: 10, width: '100%' }}>
                SEE RELATED STOCKS ▶ ({SITE_EXTRAS[data.id].sector.toUpperCase()})
              </button>
            )}
            <button onClick={() => askAI(`How exposed are Australia's ${data.commodity.toLowerCase()} exports from ${data.name} to the current global picture, and which ASX-listed producers have the most leverage to it?`)}
              className="btn-secondary btn-sm" style={{ marginTop: 12, width: '100%' }}>
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
        <RelationshipsLink data={data} setActiveModule={setActiveModule} />
      </div>
    </div>
  )
}
