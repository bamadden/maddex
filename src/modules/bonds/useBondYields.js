import { useEffect, useState } from 'react'
import { priceStream } from '../../services/priceStreamService'
import { BOND_CURVES } from '../../data/bondCurves'

// Live-ticking yields for one market.
//
// Volatility scales with the term. A one-month bill barely moves and a
// thirty-year bond moves several times as much, so a flat per-tick step would
// make the short end look as jumpy as the long end and the curve would shimmer
// rather than breathe.
const volFor = (years) => (years < 1 ? 0.12 : years < 5 ? 0.22 : years < 15 ? 0.35 : 0.5)

export function useBondYields(marketKey) {
  const rows = BOND_CURVES[marketKey] ?? []
  const [live, setLive] = useState({})

  useEffect(() => {
    const unsubs = rows.map((r) =>
      priceStream.subscribeSeries(
        `bond:${marketKey}:${r.maturity}`,
        { seed: r.yield, volPct: volFor(r.years), decimals: 3 },
        (s) => setLive((prev) => (prev[r.maturity]?.value === s.value ? prev : { ...prev, [r.maturity]: s })),
      ),
    )
    return () => unsubs.forEach((u) => u())
    // rows is derived from marketKey, so the key is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketKey])

  // The live value where one has arrived, the static seed otherwise, so the
  // table renders fully on the first frame rather than filling in.
  return rows.map((r) => {
    const s = live[r.maturity]
    return {
      ...r,
      yield: s ? s.value : r.yield,
      changeBp: s ? (s.value - r.yield) * 100 : 0,
      isLive: !!s,
    }
  })
}
