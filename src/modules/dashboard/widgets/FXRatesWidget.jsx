import { useEffect, useState } from 'react'
import DataBadge from '../../../components/ui/DataBadge'
import { classOfDailySource } from '../../../utils/dataClass'
import { liveDataService } from '../../../services/liveDataService'
import { WidgetBody, WidgetEmpty } from './_shared'
import { goModule } from './navigate'
import { PAL } from '../../../styles/palette.js'

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
  const [at, setAt] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    liveDataService.getFXRates()
      .then((res) => {
        if (!alive) return
        if (res?.data) { setRates(res.data); setSource(res.source ?? null); setAt(res.at ?? null) }
        else setFailed(true)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed) return <WidgetEmpty action="OPEN RATES" onAction={() => goModule('fx')}>FX feed unavailable</WidgetEmpty>
  if (!rates) return <WidgetBody />


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
          <span className="font-mono tabular-nums leading-none" style={{ fontSize: 20, color: PAL.bright }}>
            {lead != null ? lead.toFixed(LEAD[3]) : '—'}
          </span>
          <span className="font-mono truncate" style={{ fontSize: 11, color: PAL.muted, letterSpacing: '0.08em' }}>
            🇦🇺{LEAD[2]} AUD/{LEAD[1]}
          </span>
        </span>
        {/* DELAYED: open.er-api.com publishes its rates once a day, so they are
            never live; STALE when the last fetch failed and the cached copy is
            shown. */}
        <DataBadge cls={classOfDailySource(source)} source="open.er-api.com (daily)" at={at} compact className="flex-shrink-0" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-start gap-[3px] mt-2">
        {PAIRS.map(([key, code, flag, dp]) => (
          <button
            key={key}
            onClick={() => goModule('fx')}
            className="flex items-center justify-between gap-2 w-full flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <span className="font-mono text-[11px] truncate min-w-0" style={{ color: PAL.dim }}>
              <span style={{ marginRight: 3 }}>{flag}</span>AUD/{code}
            </span>
            <span className="font-mono text-[11px] tabular-nums flex-shrink-0" style={{ color: PAL.bright }}>
              {rates[key] != null ? rates[key].toFixed(dp) : '—'}
            </span>
          </button>
        ))}
      </div>
    </WidgetBody>
  )
}
