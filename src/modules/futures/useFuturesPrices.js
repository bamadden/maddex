import { useEffect, useState } from 'react'
import { priceStream } from '../../services/priceStreamService'
import { FUTURES, FUTURES_GROUPS } from '../../data/futuresData'

const volFor = (group) => FUTURES_GROUPS.find((g) => g.key === group)?.vol ?? 0.08

export function useFuturesPrices() {
  const [live, setLive] = useState({})

  useEffect(() => {
    const unsubs = FUTURES.map((c) =>
      priceStream.subscribeSeries(
        `fut:${c.id}`,
        // Rate futures are quoted near 100 and move in basis points, so they
        // need far more decimal room than an index quoted in thousands.
        { seed: c.price, volPct: volFor(c.group), decimals: c.rate ? 4 : (c.dp ?? 2) + 2 },
        (s) => setLive((prev) => (prev[c.id]?.value === s.value ? prev : { ...prev, [c.id]: s })),
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [])

  return FUTURES.map((c) => {
    const s = live[c.id]
    const price = s ? s.value : c.price
    return { ...c, livePrice: price, liveChange: c.change + (price - c.price), isLive: !!s }
  })
}
