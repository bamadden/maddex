import { useMemo } from 'react'
import COUNTRIES from '../data/countryDatabase'
import { getCountryCache, getCacheAge } from '../services/countryApiService'

const DAY_MS = 24 * 60 * 60 * 1000

// Module-level lookup — built once
const DB_BY_A2 = Object.fromEntries(COUNTRIES.map(c => [c.alpha2, c]))

function freshnessStatus(cacheKey) {
  const age = getCacheAge(cacheKey)
  if (age == null) return 'hardcoded'
  if (age < 7 * DAY_MS) return 'fresh'
  return 'stale'
}

export function useCountryData(alpha2) {
  const base = useMemo(() => (alpha2 ? DB_BY_A2[alpha2] ?? null : null), [alpha2])

  const restData  = useMemo(() => getCountryCache('rest')?.[alpha2]  ?? null, [alpha2])
  const wbData    = useMemo(() => getCountryCache('wb')?.[alpha2]    ?? null, [alpha2])

  // IMF is keyed by alpha3 — resolve via base record or REST data
  const alpha3 = base?.alpha3 ?? restData?.alpha3 ?? null
  const imfData = useMemo(
    () => (alpha3 ? getCountryCache('imf')?.[alpha3] ?? null : null),
    [alpha3],
  )

  const data = useMemo(() => {
    if (!base && !restData) return null

    // Currency: Batch 1-3 entries store currency as string; Batch 4 as object
    const rawCurrency = base?.currency ?? restData?.currency ?? null
    const currency = typeof rawCurrency === 'object' && rawCurrency !== null
      ? rawCurrency
      : rawCurrency ? { code: rawCurrency, name: null, symbol: null } : null

    return {
      // Identity
      alpha2:    base?.alpha2 ?? restData?.alpha2 ?? alpha2,
      alpha3:    alpha3,
      name:      base?.name   ?? restData?.name,
      flag:      base?.flag   ?? restData?.flag,
      capital:   base?.capital ?? restData?.capital,

      // Geography
      area:      base?.area   ?? restData?.area,
      region:    base?.region ?? restData?.region,
      subregion: restData?.subregion ?? null,

      // Demographics
      population: restData?.population ?? wbData?.population ?? base?.population,

      // Currency (normalised to object)
      currency,
      languages: base?.languages ?? restData?.languages,

      // Economy — priority: IMF > WB > hardcoded DB
      gdpTotal:     wbData?.gdpTotal     ?? base?.gdpTotal,
      gdpPerCapita: wbData?.gdpPerCapita ?? base?.gdpPerCapita,
      gdpGrowth:    imfData?.gdpGrowth   ?? wbData?.gdpGrowth   ?? base?.gdpGrowth,
      inflation:    imfData?.inflation   ?? wbData?.inflation   ?? base?.inflation,
      unemployment: wbData?.unemployment ?? base?.unemployment,

      // Rates & trade
      interestRate:     base?.interestRate,
      interestRateBank: base?.interestRateBank,
      auTradeValue:     base?.auTradeValue,
      auRelationship:   base?.auRelationship,

      // Trade partners
      topExports:        base?.topExports,
      topImports:        base?.topImports,
      topTradingPartners: base?.topTradingPartners,

      // Risk & governance
      politicalStability: base?.politicalStability,
      economicOutlook:    base?.economicOutlook,
      sanctionsStatus:    base?.sanctionsStatus,
      conflictStatus:     base?.conflictStatus,
      governmentType:     base?.governmentType,
      creditRating:       base?.creditRating,

      description: base?.description,

      // Data freshness for UI dots
      _sources: {
        rest:      !!restData,
        worldBank: !!wbData,
        imf:       !!imfData,
        restStatus:      freshnessStatus('rest'),
        worldBankStatus: freshnessStatus('wb'),
        imfStatus:       freshnessStatus('imf'),
      },
    }
  }, [base, restData, wbData, imfData, alpha2, alpha3])

  return data
}

// Expose the lookup for callers that need batch access
export { DB_BY_A2 }
