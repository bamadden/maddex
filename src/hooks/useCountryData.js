import { useMemo } from 'react'
import COUNTRIES from '../data/countryDatabase'

// Module-level lookup — built once
const DB_BY_A2 = Object.fromEntries(COUNTRIES.map(c => [c.alpha2, c]))

// A country's reference facts (data/countryDatabase). Figures are not merged
// here any more (15 Nov 2026): the World Bank, IMF and REST Countries values
// this hook layered over the typed database reached the Global panel with no
// source or date shown, and the World Bank API's terms are still under
// review. Verified GDP growth and CPI come from verifiedConstants
// COUNTRY_STATS; policy rates from POLICY_RATES.
export function useCountryData(alpha2) {
  return useMemo(() => {
    const base = alpha2 ? DB_BY_A2[alpha2] ?? null : null
    if (!base) return null
    const raw = base.currency ?? null
    const currency = typeof raw === 'object' && raw !== null ? raw : raw ? { code: raw, name: null, symbol: null } : null
    return {
      alpha2: base.alpha2,
      alpha3: base.alpha3 ?? null,
      name: base.name,
      flag: base.flag,
      capital: base.capital,
      region: base.region,
      currency,
      languages: base.languages,
      governmentType: base.governmentType,
      interestRateBank: base.interestRateBank,
    }
  }, [alpha2])
}

// Expose the lookup for callers that need batch access
export { DB_BY_A2 }
