import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { geoNaturalEarth1, geoPath } from 'd3'
import { loadCountries, featureIso3 } from '../../utils/naturalEarth'
import {
  fetchImfOutlook, economyStatus, GROWTH_BANDS, NO_DATA_COLOUR, FOCUS_ECONOMIES,
} from '../../services/imfOutlook'

// ─── Global growth map ──────────────────────────────────────────────────────
//
// Every economy coloured by the IMF's real GDP growth for this year, with an
// arrow for momentum against last year. Status comes from the rubric in
// services/imfOutlook.js, applied to the IMF's numbers — never a hand-written
// label — and a country the IMF does not cover stays the no-data colour.
//
// Plain SVG through d3-geo rather than the deck.gl map in Global: this is a
// static choropleth, and a WebGL context per chart would be a heavy way to
// draw 177 polygons.

const W = 960
const H = 470
const fmt = (v, dp = 1) => (v == null ? '—' : `${v.toFixed(dp)}%`)
const signed = (v) => (v == null ? '' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`)

function useCountryShapes() {
  const [geo, setGeo] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    loadCountries().then((d) => { if (!alive) return; if (d) setGeo(d); else setFailed(true) })
    return () => { alive = false }
  }, [])
  return { geo, failed }
}

function Tooltip({ hover, year }) {
  const { name, status, x, y } = hover
  const left = x > W * 0.62
  return (
    <div
      className="absolute pointer-events-none bg-terminal-panel border border-terminal-border shadow-lg px-2.5 py-2 text-2xs font-mono z-10"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: `translate(${left ? 'calc(-100% - 12px)' : '12px'}, -50%)`, minWidth: 190 }}
    >
      <div className="text-terminal-text-bright font-bold mb-1">{name}</div>
      {status ? (
        <>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: status.band.colour }} />
            <span className="font-bold" style={{ color: status.band.colour }}>{status.band.label.toUpperCase()}</span>
            {status.momentum && <span className="text-terminal-text-dim">{status.momentum.arrow} {status.momentum.label}</span>}
          </div>
          <div className="flex justify-between gap-3"><span className="text-terminal-text-dim">GDP growth {year}</span><span className="text-terminal-text-bright">{fmt(status.growth)}</span></div>
          {status.momentum && <div className="flex justify-between gap-3"><span className="text-terminal-text-dim">vs {year - 1}</span><span>{signed(status.momentum.delta)}pp</span></div>}
          <div className="flex justify-between gap-3"><span className="text-terminal-text-dim">Inflation {year}</span><span>{fmt(status.inflation)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-terminal-text-dim">Unemployment {year}</span><span>{fmt(status.unemployment)}</span></div>
        </>
      ) : (
        <div className="text-terminal-text-dim">No IMF growth figure for {year}</div>
      )}
    </div>
  )
}

export default function GlobalGrowthMap() {
  const [year] = useState(() => new Date().getFullYear())
  const [hover, setHover] = useState(null)
  const { geo, failed } = useCountryShapes()
  const { data: imf, isLoading, isError } = useQuery({
    queryKey: ['imfOutlook'],
    queryFn: () => fetchImfOutlook(),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  })

  // Project once per geometry load. Antarctica is dropped: it has no
  // economy and takes a fifth of the frame.
  const shapes = useMemo(() => {
    if (!geo) return []
    const features = geo.features.filter((f) => f.properties?.CONTINENT !== 'Antarctica')
    const projection = geoNaturalEarth1().fitSize([W, H], { type: 'FeatureCollection', features })
    const path = geoPath(projection)
    return features.map((f) => {
      const [cx, cy] = path.centroid(f)
      return { iso: featureIso3(f), name: f.properties?.NAME ?? '—', d: path(f), cx, cy }
    })
  }, [geo])

  const statusOf = (iso) => (imf && iso ? economyStatus(imf.countries[iso], year) : null)
  const counts = useMemo(() => {
    const c = {}
    if (!imf) return c
    for (const s of shapes) { const st = economyStatus(imf.countries[s.iso], year); if (st) c[st.band.key] = (c[st.band.key] ?? 0) + 1 }
    return c
  }, [shapes, imf, year])

  const unavailable = isError || failed

  return (
    <div className="border border-terminal-border bg-terminal-panel/40">
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span className="text-terminal-gold">GLOBAL GROWTH MAP</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">
          Real GDP growth {year}, IMF projection · arrow = change on {year - 1}
        </span>
        {isLoading && <span className="text-2xs text-terminal-text-dim animate-pulse">LOADING IMF DATA…</span>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px]">
        <div className="relative p-2" onMouseLeave={() => setHover(null)}>
          {unavailable ? (
            <div className="flex items-center justify-center text-2xs text-terminal-text-dim" style={{ aspectRatio: `${W} / ${H}` }}>
              {failed ? 'Country outlines unavailable — Natural Earth did not respond.' : 'IMF World Economic Outlook unavailable — no growth figures are shown rather than estimated ones.'}
            </div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img"
              aria-label={`World map of IMF real GDP growth projections for ${year}`}>
              {shapes.map((s, i) => {
                const st = statusOf(s.iso)
                const on = hover?.iso === s.iso && s.iso
                return (
                  <path
                    key={`${s.iso}-${i}`}
                    d={s.d}
                    fill={st ? st.band.colour : NO_DATA_COLOUR}
                    fillOpacity={hover && !on ? 0.55 : 0.92}
                    stroke={on ? '#F5E6B8' : 'rgba(11,22,40,0.9)'}
                    strokeWidth={on ? 1.4 : 0.5}
                    onMouseEnter={() => setHover({ iso: s.iso, name: s.name, status: st, x: s.cx, y: s.cy })}
                    style={{ cursor: 'default', transition: 'fill-opacity 120ms' }}
                  />
                )
              })}
              {/* Momentum arrows on the economies in the table, where they
                  are large enough on the map to carry one. */}
              {imf && shapes.filter((s) => FOCUS_ECONOMIES.some((e) => e.iso === s.iso)).map((s) => {
                const st = statusOf(s.iso)
                if (!st?.momentum || st.momentum.key === 'flat' || !Number.isFinite(s.cx)) return null
                return (
                  <text key={`m-${s.iso}`} x={s.cx} y={s.cy + 4} textAnchor="middle" fontSize="12" fontWeight="700"
                    fill="#F5E6B8" stroke="#0B1628" strokeWidth="2.5" paintOrder="stroke" pointerEvents="none">
                    {st.momentum.arrow}
                  </text>
                )
              })}
            </svg>
          )}
          {hover && !unavailable && <Tooltip hover={hover} year={year} />}

          <div className="flex items-center gap-3 flex-wrap mt-1.5 text-2xs">
            {GROWTH_BANDS.map((b) => (
              <span key={b.key} className="flex items-center gap-1 text-terminal-text-dim">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: b.colour }} />
                {b.label} <span className="text-terminal-text-dim/60">{b.range}</span>
                {counts[b.key] != null && <span className="text-terminal-text-dim/50">({counts[b.key]})</span>}
              </span>
            ))}
            <span className="flex items-center gap-1 text-terminal-text-dim">
              <span className="w-2.5 h-2.5 rounded-sm border border-terminal-border" style={{ background: NO_DATA_COLOUR }} /> No IMF data
            </span>
          </div>
        </div>

        {/* The table carries the numbers the colours stand for. */}
        <div className="border-t xl:border-t-0 xl:border-l border-terminal-border p-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-2xs text-terminal-text-dim tracking-wide pb-1 border-b border-terminal-border/50">
            <span>ECONOMY</span><span className="text-right">{year - 1}</span><span className="text-right">{year}</span><span className="text-right">{year + 1}</span>
          </div>
          {FOCUS_ECONOMIES.map((e) => {
            const row = imf?.countries?.[e.iso]
            const st = economyStatus(row, year)
            return (
              <div key={e.iso} className="py-1 border-b border-terminal-border/30 last:border-b-0">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-baseline text-2xs tabular-nums">
                  <span className="text-terminal-text-bright truncate">{e.name}</span>
                  <span className="text-right text-terminal-text-dim">{fmt(row?.growth?.[year - 1])}</span>
                  <span className="text-right font-bold" style={{ color: st?.band.colour ?? 'var(--color-text-dim)' }}>{fmt(row?.growth?.[year])}</span>
                  <span className="text-right text-terminal-text-dim">{fmt(row?.growth?.[year + 1])}</span>
                </div>
                {st && (
                  <div className="text-[9px] tracking-widest mt-0.5" style={{ color: st.band.colour }}>
                    {st.band.label.toUpperCase()}{st.momentum ? ` ${st.momentum.arrow} ${st.momentum.label.toUpperCase()}` : ''}
                    <span className="text-terminal-text-dim/60 normal-case tracking-normal"> · CPI {fmt(st.inflation)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-terminal-border text-2xs text-terminal-text-dim/60 leading-relaxed">
        SOURCE: IMF {imf?.source ?? 'World Economic Outlook'}{imf?.lastModified ? `, updated ${imf.lastModified}` : ''}, via DataMapper.
        Annual average real GDP growth; {year} and later are IMF projections, not outturns. Status is Maddex's rubric applied
        to the IMF figure — band by level, arrow when growth moves 0.3pp or more on the prior year. The IMF's annual-average
        figure differs from the ABS's through-the-year GDP shown elsewhere in this module.
      </div>
    </div>
  )
}
