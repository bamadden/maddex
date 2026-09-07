import { useEffect, useState } from 'react'
import { priceStream } from '../../services/priceStreamService'
import { AU_ETFS, VOL_BY_CATEGORY } from '../../data/etfData'

// Live-ticking ETF prices.
//
// LEVERAGED AND INVERSE FUNDS ARE DRIVEN, NOT RANDOM. Every other ETF walks on
// its own; the geared and bear funds are derived from one shared market driver
// and multiplied by their leverage factor. That is the whole behaviour of those
// products — BBOZ has to go UP on the tick where the market goes down, and a
// private random walk per fund would show a bear fund and the index rising
// together, which is the one thing they never do.
const DRIVER = 'etf:_market'

export function useEtfPrices() {
  const [live, setLive] = useState({})
  const [driver, setDriver] = useState(100)

  useEffect(() => {
    const unsubs = []

    unsubs.push(priceStream.subscribeSeries(
      DRIVER, { seed: 100, volPct: 0.06, decimals: 4 }, (s) => setDriver(s.value),
    ))

    for (const e of AU_ETFS) {
      if (e.complex) continue
      unsubs.push(priceStream.subscribeSeries(
        `etf:${e.ticker}`,
        { seed: e.price, volPct: VOL_BY_CATEGORY[e.category] ?? 0.06, decimals: 4 },
        (s) => setLive((prev) => (prev[e.ticker]?.value === s.value ? prev : { ...prev, [e.ticker]: s })),
      ))
    }
    return () => unsubs.forEach((u) => u())
  }, [])

  const marketMove = (driver - 100) / 100

  return AU_ETFS.map((e) => {
    if (e.complex) {
      const price = e.price * (1 + e.leverage * marketMove)
      return { ...e, livePrice: price, dayPct: e.leverage * marketMove * 100, isLive: true }
    }
    const s = live[e.ticker]
    const price = s ? s.value : e.price
    return { ...e, livePrice: price, dayPct: ((price - e.price) / e.price) * 100, isLive: !!s }
  })
}
