import { runOfficialCheck } from './officialStats'

// REFRESH ALL DATA (Apex) — every live feed and the official statistics check,
// now rather than on schedule.
//
// The live services (FX, crypto, Fear & Greed, gold, weather in liveData;
// TVL and on-chain in defi) keep localStorage caches with a freshness window
// that short-circuits the network. Deleting them would also delete the
// stale-copy fallback used when a fetch fails, so they are marked stale
// instead: the next read goes to the network and still has last copy to fall
// back on. Then every active react-query query refetches (news, quotes and
// the rest) and the ABS/RBA/FRED check runs forced.

const STALE = [
  ['maddex_live_', 'timestamp'],
  ['maddex_defi_', 'at'],
]

function markCachesStale() {
  for (const key of Object.keys(localStorage)) {
    const rule = STALE.find(([prefix]) => key.startsWith(prefix))
    if (!rule) continue
    try {
      const v = JSON.parse(localStorage.getItem(key))
      if (v && typeof v === 'object') localStorage.setItem(key, JSON.stringify({ ...v, [rule[1]]: 0 }))
    } catch { /* unreadable entry — leave it */ }
  }
}

export async function refreshAllData(queryClient) {
  markCachesStale()
  await Promise.allSettled([
    queryClient.invalidateQueries({ refetchType: 'active' }),
    runOfficialCheck({ force: true }),
  ])
  return new Date()
}
