import { BOND_CURVES, BOND_CURVES_AS_OF } from '../../data/bondCurves'

// One market's yields as published (bondCurves.js: official end-of-day
// readings, each curve dated in BOND_CURVES_AS_OF).
//
// Until 15 Nov 2026 every yield ticked on a simulated random walk around its
// sourced value, and the drift was shown as a basis-point "change". That was
// invented movement on real data, so it is gone: no change is held, and
// `changeBp` is null (shown as "—").
export function useBondYields(marketKey) {
  const asOf = BOND_CURVES_AS_OF[marketKey] ?? null
  return (BOND_CURVES[marketKey] ?? []).map((r) => ({ ...r, changeBp: null, isLive: false, asOf }))
}
