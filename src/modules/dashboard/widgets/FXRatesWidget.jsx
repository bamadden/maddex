import { useEffect, useState } from 'react'
import { liveDataService } from '../../../services/liveDataService'
import { WidgetBody, WidgetEmpty } from './_shared'
import { goModule } from './navigate'

// AUD/USD leads and is drawn larger — it is the pair an Australian investor
// checks first, and the one that reprices every US holding in the portfolio.
const LEAD = ['AUDUSD', 'USD', '🇺🇸', 4]
const PAIRS = [
  ['AUDEUR', 'EUR', '🇪🇺', 4],
  ['AUDGBP', 'GBP', '🇬🇧', 4],
  ['AUDJPY', 'JPY', '🇯🇵', 2],
  ['AUDNZD', 'NZD', '🇳🇿', 4],
  ['AUDCNY', 'CNY', '🇨🇳', 4],
]

export default function FXRatesWidget() {
  const [rates, setRates] = useState(null)
  const [source, setSource] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    liveDataService.getFXRates()
      .then((res) => {
        if (!alive) return
        if (res?.data) { setRates(res.data); setSource(res.source ?? null) }
        else setFailed(true)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed) return <WidgetEmpty action="OPEN RATES" onAction={() => goModule('fx')}>FX feed unavailable</WidgetEmpty>
  if (!rates) return <WidgetBody />

  // LIVE only when the response actually came from the live feed. A cached or
  // fallback response wearing a LIVE badge is the specific thing this badge
  // exists to rule out — the label has to be able to say "no".
  const isLive = source === 'live'
  const badge = isLive
    ? { text: 'LIVE', colour: '#2D8A50' }
    : { text: source === 'cache' ? 'CACHED' : 'DELAYED', colour: '#C9A84C' }

  const lead = rates[LEAD[0]]

  return (
    <WidgetBody>
      {/* HEIGHT BUDGET
          A 1x1 widget cell is 160px, less the 20px title strip and 32px of
          padding: 108px of content. Six pairs stacked under a separate 22px
          headline came to about 124px, and because the rows sat in a
          `justify-end` flex child the overflow went UPWARDS — the AUD/EUR row
          drew straight over the AUD/USD figure the widget exists to show.
          So the lead pair is one inline row rather than a block, the rows are
          tight, and the stack grows downwards: if it ever overflows again it
          clips the last pair instead of the headline. */}
      <div className="flex items-baseline justify-between gap-2 flex-shrink-0">
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-mono tabular-nums leading-none" style={{ fontSize: 20, color: '#E8EDF5' }}>
            {lead != null ? lead.toFixed(LEAD[3]) : '—'}
          </span>
          <span className="font-mono truncate" style={{ fontSize: 8, color: '#4A6080', letterSpacing: '0.08em' }}>
            🇦🇺{LEAD[2]} AUD/{LEAD[1]}
          </span>
        </span>
        <span
          className="font-mono flex-shrink-0"
          style={{
            fontSize: 7, letterSpacing: '0.12em', color: badge.colour,
            border: `1px solid ${badge.colour}66`, borderRadius: 2, padding: '1px 4px',
          }}
        >
          {isLive && (
            <span
              style={{
                display: 'inline-block', width: 4, height: 4, borderRadius: 2,
                background: badge.colour, marginRight: 3, verticalAlign: 'middle',
              }}
            />
          )}
          {badge.text}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-start gap-[3px] mt-2">
        {PAIRS.map(([key, code, flag, dp]) => (
          <button
            key={key}
            onClick={() => goModule('fx')}
            className="flex items-center justify-between gap-2 w-full flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <span className="font-mono text-[9px] truncate min-w-0" style={{ color: '#8BA3C4' }}>
              <span style={{ marginRight: 3 }}>{flag}</span>AUD/{code}
            </span>
            <span className="font-mono text-[9px] tabular-nums flex-shrink-0" style={{ color: '#E8EDF5' }}>
              {rates[key] != null ? rates[key].toFixed(dp) : '—'}
            </span>
          </button>
        ))}
      </div>
    </WidgetBody>
  )
}
