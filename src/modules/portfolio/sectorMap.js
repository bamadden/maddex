import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'

// symbol (no .AX suffix, uppercase) -> GICS sector, for holdings that match
// a tracked demo stock. Anything else (a real ticker not in the demo
// universe, or crypto) falls back to 'Other' in the sector breakdown.
//
// Lives in its own module because both the holdings table and the what-if
// analyser need it, and a second copy would drift the moment one of them
// gained a ticker.
export const SECTOR_BY_SYMBOL = Object.fromEntries([
  ...Object.entries(MOCK_ASX_STOCKS).map(([sym, s]) => [sym.replace(/\.AX$/, ''), s.sector]),
  ...Object.entries(MOCK_US_STOCKS).map(([sym, s]) => [sym, s.sector]),
])
