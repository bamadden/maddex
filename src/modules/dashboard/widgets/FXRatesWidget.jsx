import { useEffect, useState } from 'react'
import { liveDataService } from '../../../services/liveDataService'
import {WidgetBody, WidgetRows, WidgetRow, WidgetEmpty} from './_shared'
import { goModule } from './navigate'

const PAIRS = [
  ['AUDUSD', 'AUD/USD', 4], ['AUDEUR', 'AUD/EUR', 4], ['AUDGBP', 'AUD/GBP', 4],
  ['AUDJPY', 'AUD/JPY', 2], ['AUDNZD', 'AUD/NZD', 4], ['AUDCNY', 'AUD/CNY', 4],
]

export default function FXRatesWidget() {
  const [rates, setRates] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    liveDataService.getFXRates()
      .then(({ data }) => { if (alive) (data ? setRates(data) : setFailed(true)) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed) return <WidgetEmpty action="OPEN RATES" onAction={() => goModule('fx')}>FX feed unavailable</WidgetEmpty>
  if (!rates) return <WidgetBody />

  return (
    <WidgetBody>
      <WidgetRows>
        {PAIRS.map(([key, label, dp]) => (
          <WidgetRow key={key} label={label} value={rates[key] != null ? rates[key].toFixed(dp) : '—'} />
        ))}
      </WidgetRows>
    </WidgetBody>
  )
}
