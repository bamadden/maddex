import { useQuery } from '@tanstack/react-query'
import { ASX_SECTOR_STOCKS } from '../../data/sectorTaxonomy'
import { fetchEquityQuotes } from '../../services/dataService'

// The one ASX universe every breadth figure on the Markets screen is counted
// over — the 72 names in the sector taxonomy. The sentiment banner, the old
// breadth bar and the internals panel each used to count a different set
// (20, 20 with fake 52-week fields, 72), so the same screen showed three
// different A/D ratios.
export const ASX_UNIVERSE = Object.values(ASX_SECTOR_STOCKS).flat().map(([sym]) => sym)

export const SECTOR_OF = Object.fromEntries(
  Object.entries(ASX_SECTOR_STOCKS).flatMap(([sector, rows]) => rows.map(([sym]) => [sym, sector])),
)

// Today's quote for every name, shared through one query key.
export function useAsxUniverseQuotes() {
  return useQuery({
    queryKey: ['equityQuotes', 'asxUniverse'],
    queryFn: () => fetchEquityQuotes(ASX_UNIVERSE),
    staleTime: 60_000,
    retry: 1,
  })
}
