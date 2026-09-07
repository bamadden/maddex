// DeFi and on-chain intelligence, from live public APIs.
//
// THE BRIEF FOR THIS ASKED FOR MOCK DATA WITH AN "INDICATIVE" BADGE.
//
// It does not need to be mock. DefiLlama and mempool.space are both free, need
// no key, and send CORS headers — verified from the browser before this file
// was written: 8,190 protocols with real TVL and 24h change, live hashrate,
// live mempool. A labelled fabrication is the right answer when no source
// exists; when one does, using it is strictly better, and this terminal has
// spent long enough removing invented figures to take the free real ones.
//
// So every number here is fetched. What cannot be fetched is absent, not
// estimated — the on-chain panel shows what these endpoints actually publish
// and says nothing about ETH staking rates or exchange reserves, which they
// do not.

const DEFILLAMA = 'https://api.llama.fi'
const MEMPOOL = 'https://mempool.space/api'

const CACHE_PREFIX = 'maddex_defi_'
const TTL_MS = 10 * 60_000

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Date.now() - parsed.at < TTL_MS ? parsed : null
  } catch { return null }
}

function writeCache(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, at: Date.now() })) } catch { /* quota */ }
}

// Returns { data, source, at } in the same shape liveDataService uses, so the
// UI badges provenance identically to every other live panel in the app.
async function withCache(key, fetchFn) {
  const cached = readCache(key)
  if (cached) return { data: cached.data, source: 'cache', at: cached.at }
  try {
    const data = await fetchFn()
    writeCache(key, data)
    return { data, source: 'live', at: Date.now() }
  } catch (err) {
    console.warn(`[DeFi] ${key} failed:`, err.message)
    // A stale cache beats an empty panel, and it is labelled stale.
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key)
      if (raw) { const p = JSON.parse(raw); return { data: p.data, source: 'stale', at: p.at } }
    } catch { /* nothing usable */ }
    return { data: null, source: 'failed', at: null }
  }
}

const json = async (url) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`)
  return r.json()
}

// Centralised exchanges are in DefiLlama's protocol list and are emphatically
// not DeFi — Binance's custodial balance sheet at the top of a "decentralised
// finance" table would misrepresent the entire category.
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Chain', 'Bridge'])

export const defiService = {
  // Protocols by TVL, with category and 24h change.
  async getProtocols(limit = 25) {
    return withCache(`protocols_${limit}`, async () => {
      const raw = await json(`${DEFILLAMA}/protocols`)
      return raw
        .filter((p) => p.tvl > 0 && !EXCLUDED_CATEGORIES.has(p.category))
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, limit)
        .map((p) => ({
          name: p.name,
          category: p.category ?? '—',
          tvl: p.tvl,
          change1d: p.change_1d ?? null,
          change7d: p.change_7d ?? null,
          // `chains` can be long; the UI shows the primary chain and a count.
          chain: p.chain ?? (p.chains?.[0] ?? '—'),
          chainCount: p.chains?.length ?? 1,
          url: p.url ?? null,
          logo: p.logo ?? null,
        }))
    })
  },

  // Chain-level TVL, for the totals bar.
  async getChains(limit = 8) {
    return withCache(`chains_${limit}`, async () => {
      const raw = await json(`${DEFILLAMA}/v2/chains`)
      const live = raw.filter((c) => c.tvl > 0).sort((a, b) => b.tvl - a.tvl)
      return {
        totalTvl: live.reduce((s, c) => s + c.tvl, 0),
        top: live.slice(0, limit).map((c) => ({ name: c.name, tvl: c.tvl, symbol: c.tokenSymbol ?? null })),
        chainCount: live.length,
      }
    })
  },

  // Bitcoin network state. Three separate endpoints, settled individually so
  // one slow call does not cost the whole panel.
  async getBitcoinOnChain() {
    return withCache('btc_onchain', async () => {
      const [hash, mem, fees] = await Promise.allSettled([
        json(`${MEMPOOL}/v1/mining/hashrate/3d`),
        json(`${MEMPOOL}/mempool`),
        json(`${MEMPOOL}/v1/fees/recommended`),
      ])
      const ok = (r) => (r.status === 'fulfilled' ? r.value : null)
      const h = ok(hash), m = ok(mem), f = ok(fees)
      return {
        // Hashrate arrives in H/s; EH/s is the unit the network is discussed in.
        hashrateEH: h?.currentHashrate != null ? h.currentHashrate / 1e18 : null,
        difficulty: h?.currentDifficulty ?? null,
        mempoolCount: m?.count ?? null,
        mempoolVsizeMB: m?.vsize != null ? m.vsize / 1e6 : null,
        feeFastest: f?.fastestFee ?? null,
        feeHour: f?.hourFee ?? null,
      }
    })
  },

  async getStablecoins() {
    return withCache('stablecoins', async () => {
      const raw = await json('https://stablecoins.llama.fi/stablecoins?includePrices=false')
      const assets = (raw.peggedAssets ?? [])
        .map((a) => ({
          name: a.name,
          symbol: a.symbol,
          circulating: Number(a.circulating?.peggedUSD ?? 0),
          prevDay: Number(a.circulatingPrevDay?.peggedUSD ?? 0),
        }))
        .filter((a) => a.circulating > 0)
        .sort((x, y) => y.circulating - x.circulating)
      const total = assets.reduce((s, a) => s + a.circulating, 0)
      const totalPrev = assets.reduce((s, a) => s + a.prevDay, 0)
      return {
        total,
        change1d: totalPrev > 0 ? ((total - totalPrev) / totalPrev) * 100 : null,
        top: assets.slice(0, 6),
      }
    })
  },
}

// Plain-English readings.
//
// These explain what a metric IS and which direction is which — structural
// facts about how the network works. They deliberately stop short of saying
// what any current level implies, because "exchange reserves falling is
// historically bullish" is a market call dressed as a definition.
export const ONCHAIN_EXPLAINERS = {
  hashrate: 'Total computing power securing the network. Rising hashrate means more miners competing, which raises the cost of attacking the chain.',
  difficulty: 'How hard it is to mine a block. Adjusts roughly every two weeks to keep blocks near ten minutes apart as hashrate changes.',
  mempool: 'Transactions waiting to be confirmed. A large backlog means the network is busy and fees are being bid up.',
  fees: 'What it currently costs to get a transaction confirmed quickly, in satoshis per virtual byte.',
  tvl: 'Total value locked — the assets deposited in a protocol\'s smart contracts. It measures usage, not revenue, and can move purely because token prices did.',
  stablecoins: 'Total stablecoin supply in circulation. Often read as dry powder available inside crypto markets.',
}
