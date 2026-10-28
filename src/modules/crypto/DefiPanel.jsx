import { useEffect, useState, useMemo } from 'react'
import { defiService, ONCHAIN_EXPLAINERS } from '../../services/defiService'
import Donut from '../../components/charts/Donut'

// 'Bridge' was here, but defiService excludes bridges from the list (with CEXs
// and chains), so its pill could only ever show an empty table.
const CATEGORIES = ['ALL', 'Dexes', 'Lending', 'Liquid Staking', 'Restaking', 'Yield', 'CDP']
const CAT_COLOURS = ['#C9A84C', '#2D7DD2', '#2D8A50', '#9945FF', '#E8A33D', '#14b8a6', '#4A6080']
const CAT_LABEL = { Dexes: 'DEX', Lending: 'LENDING', 'Liquid Staking': 'LIQUID STAKING', Restaking: 'RESTAKING', 'Liquid Restaking': 'LIQUID RESTAKING', CDP: 'CDP', Yield: 'YIELD', Derivatives: 'DERIVATIVES', RWA: 'REAL-WORLD ASSETS', 'Basis Trading': 'BASIS TRADING', Other: 'OTHER' }
const gweiFmt = (g) => (g == null ? '—' : g < 1 ? `${g.toFixed(3)} gwei` : `${g.toFixed(1)} gwei`)

const usd = (n, dp = 2) => {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e12) return `US$${(n / 1e12).toFixed(dp)}T`
  if (Math.abs(n) >= 1e9) return `US$${(n / 1e9).toFixed(dp)}B`
  if (Math.abs(n) >= 1e6) return `US$${(n / 1e6).toFixed(dp)}M`
  return `US$${Math.round(n).toLocaleString()}`
}

const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
const toneOf = (v) => (v == null ? '#637899' : v >= 0 ? '#2D8A50' : '#A83232')

// Provenance badge, identical in meaning to the ones the rest of the terminal
// uses: LIVE only when the response actually came from the network.
// `now` is passed in rather than read here: this renders inside a table that
// re-renders on filter changes, and Date.now() in a render body makes the
// component non-idempotent for a label that only needs minute precision.
function SourceBadge({ source, at, now }) {
  if (!source || source === 'failed') return null
  const map = {
    live: { text: 'LIVE', colour: '#2D8A50' },
    cache: { text: 'CACHED', colour: '#C9A84C' },
    stale: { text: 'STALE', colour: '#A83232' },
  }
  const b = map[source] ?? map.cache
  const mins = at && now ? Math.floor((now - at) / 60000) : null
  return (
    <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 8, color: b.colour, letterSpacing: '0.1em' }}>
      <span style={{ fontSize: 7 }}>●</span>
      {b.text}{mins != null && mins > 0 ? ` · ${mins}m` : ''}
    </span>
  )
}

function Metric({ label, value, sub, tone, title }) {
  return (
    <div className="border border-terminal-border p-2.5 min-w-0" title={title}>
      <div className="text-2xs text-terminal-text-dim tracking-widest truncate">{label}</div>
      <div className="text-base font-bold tabular-nums mt-0.5 truncate" style={{ color: tone ?? '#E8EDF5' }}>{value}</div>
      {sub && <div className="text-2xs text-terminal-text-dim/60 truncate">{sub}</div>}
    </div>
  )
}

export default function DefiPanel() {
  const [protocols, setProtocols] = useState({ data: null, source: null, at: null })
  const [chains, setChains] = useState({ data: null, source: null, at: null })
  const [btc, setBtc] = useState({ data: null, source: null, at: null })
  const [stables, setStables] = useState({ data: null, source: null, at: null })
  const [cats, setCats] = useState({ data: null, source: null, at: null })
  const [eth, setEth] = useState({ data: null, source: null, at: null })
  const [category, setCategory] = useState('ALL')
  const [tab, setTab] = useState('defi')
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    // Settled independently: DefiLlama and mempool.space are unrelated
    // services, and one being slow should not blank a panel fed by the other.
    defiService.getProtocols(25).then((r) => { if (alive) setProtocols(r) })
    defiService.getChains(8).then((r) => { if (alive) setChains(r) })
    defiService.getBitcoinOnChain().then((r) => { if (alive) setBtc(r) })
    defiService.getStablecoins().then((r) => { if (alive) setStables(r) })
    defiService.getCategories(6).then((r) => { if (alive) setCats(r) })
    defiService.getEthGas().then((r) => { if (alive) setEth(r) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const list = protocols.data ?? []
    return category === 'ALL' ? list : list.filter((p) => p.category === category)
  }, [protocols.data, category])

  const loading = !protocols.data && !chains.data && !btc.data

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border border-terminal-border">
          {[['defi', 'DEFI'], ['onchain', 'ON-CHAIN']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1 text-2xs font-bold border-r border-terminal-border last:border-r-0 transition-colors ${
                tab === k ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
            >{label}</button>
          ))}
        </div>
        <span className="text-2xs text-terminal-text-dim">
          {tab === 'defi' ? 'DefiLlama' : 'mempool.space'} · live public API, no key
        </span>
      </div>

      {loading && (
        <div className="py-16 text-center text-2xs text-terminal-text-dim animate-pulse">
          LOADING ON-CHAIN DATA...
        </div>
      )}

      {tab === 'defi' && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Metric
              label="TOTAL DEFI TVL"
              value={usd(chains.data?.totalTvl)}
              sub={chains.data ? `across ${chains.data.chainCount} chains` : '—'}
              title={ONCHAIN_EXPLAINERS.tvl}
            />
            <Metric
              label="STABLECOIN SUPPLY"
              value={usd(stables.data?.total)}
              sub={stables.data?.change1d != null ? `${pct(stables.data.change1d)} 24h` : '—'}
              tone={stables.data?.change1d == null ? undefined : toneOf(stables.data.change1d)}
              title={ONCHAIN_EXPLAINERS.stablecoins}
            />
            <Metric
              label="LARGEST CHAIN"
              value={chains.data?.top?.[0]?.name ?? '—'}
              sub={chains.data?.top?.[0] ? usd(chains.data.top[0].tvl) : '—'}
            />
            <Metric
              label="PROTOCOLS TRACKED"
              value={protocols.data ? String(protocols.data.length) : '—'}
              sub="top by TVL, CEXs excluded"
            />
          </div>

          {cats.data?.rows?.length > 0 && (
            <div className="border border-terminal-border p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-2xs text-terminal-gold font-bold tracking-widest">TVL BY CATEGORY</span>
                <SourceBadge source={cats.source} at={cats.at} now={now} />
              </div>
              <div className="flex items-center gap-5 flex-wrap">
                <Donut
                  size={132} thickness={20} label="DeFi TVL by category"
                  slices={cats.data.rows.map((r, i) => ({ label: r.name, value: r.tvl, color: CAT_COLOURS[i % CAT_COLOURS.length] }))}
                  centre={<><span className="text-2xs text-terminal-text-dim">CATEGORY SUM</span><span className="text-xs font-bold text-terminal-text-bright tabular-nums">{usd(cats.data.total, 1)}</span></>}
                />
                <div className="flex-1 min-w-[200px] space-y-1">
                  {cats.data.rows.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-2 text-2xs">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: CAT_COLOURS[i % CAT_COLOURS.length] }} />
                      <span className="text-terminal-text-bright font-bold">{CAT_LABEL[r.name] ?? r.name.toUpperCase()}</span>
                      <span className="ml-auto tabular-nums text-terminal-text-bright">{usd(r.tvl, 1)}</span>
                      <span className="tabular-nums text-terminal-text-dim w-12 text-right">{((r.tvl / cats.data.total) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-2xs text-terminal-text-dim/60 mt-2 leading-snug">
                Summed across every protocol DefiLlama tracks (exchanges, chains and bridges excluded). Protocols that deposit into
                other protocols count in each category, so this sum runs above the headline TVL — read it as where activity sits.
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-2xs px-2.5 py-0.5 rounded-full border transition-colors ${
                  category === c
                    ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold'
                    : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                }`}
              >{c.toUpperCase()}</button>
            ))}
          </div>

          <div className="border border-terminal-border">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-terminal-border/50">
              <span className="text-2xs text-terminal-gold font-bold tracking-widest">PROTOCOLS BY TVL</span>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-terminal-text-dim">{filtered.length} shown</span>
                <SourceBadge source={protocols.source} at={protocols.at} now={now} />
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-2xs text-terminal-text-dim">
                Nothing in this category right now.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-2xs">
                  <thead>
                    <tr className="text-terminal-text-dim border-b border-terminal-border/40">
                      <th className="text-left px-3 py-1.5 font-normal w-6">#</th>
                      <th className="text-left px-3 py-1.5 font-normal">Protocol</th>
                      <th className="text-left px-3 py-1.5 font-normal">Category</th>
                      <th className="text-right px-3 py-1.5 font-normal">TVL</th>
                      <th className="text-right px-3 py-1.5 font-normal">24h</th>
                      <th className="text-right px-3 py-1.5 font-normal">7d</th>
                      <th className="text-left px-3 py-1.5 font-normal">Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr
                        key={p.name}
                        className="border-b border-terminal-border/25 last:border-b-0 hover:bg-terminal-accent/10"
                      >
                        <td className="px-3 py-1.5 text-terminal-text-dim tabular-nums">{i + 1}</td>
                        <td className="px-3 py-1.5 font-bold text-terminal-text-bright truncate max-w-[160px]">{p.name}</td>
                        <td className="px-3 py-1.5 text-terminal-text-dim truncate">{p.category}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-terminal-text-bright">{usd(p.tvl)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: toneOf(p.change1d) }}>{pct(p.change1d)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: toneOf(p.change7d) }}>{pct(p.change7d)}</td>
                        <td className="px-3 py-1.5 text-terminal-text-dim truncate">
                          {p.chain}{p.chainCount > 1 ? ` +${p.chainCount - 1}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Regulatory note, always visible. DeFi is genuinely unregulated in
              Australia and a terminal showing a leaderboard of protocols
              should say so on the same screen, not in a settings page. */}
          <div className="border border-terminal-gold/30 bg-terminal-gold/5 p-3">
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">REGULATORY NOTE</div>
            <div className="text-2xs text-terminal-text-dim leading-relaxed">
              DeFi protocols are largely unregulated and are not covered by the Australian
              Financial Claims Scheme or any depositor guarantee. ASIC has said regulatory
              frameworks for digital assets are still under development. Total value locked
              measures deposits, not revenue or safety, and can move purely because token
              prices did. General information only — not investment advice.
            </div>
          </div>
        </>
      )}

      {tab === 'onchain' && !loading && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">BITCOIN NETWORK</span>
            <SourceBadge source={btc.source} at={btc.at} now={now} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <Metric
              label="HASH RATE"
              value={btc.data?.hashrateEH != null ? `${btc.data.hashrateEH.toFixed(0)} EH/s` : '—'}
              sub="3-day average"
              title={ONCHAIN_EXPLAINERS.hashrate}
            />
            <Metric
              label="DIFFICULTY"
              value={btc.data?.difficulty != null ? `${(btc.data.difficulty / 1e12).toFixed(1)}T` : '—'}
              sub="adjusts ~every 2 weeks"
              title={ONCHAIN_EXPLAINERS.difficulty}
            />
            <Metric
              label="MEMPOOL"
              value={btc.data?.mempoolCount != null ? btc.data.mempoolCount.toLocaleString() : '—'}
              sub={btc.data?.mempoolVsizeMB != null ? `${btc.data.mempoolVsizeMB.toFixed(1)} MB waiting` : '—'}
              title={ONCHAIN_EXPLAINERS.mempool}
            />
            <Metric
              label="FEES · FAST / MED / SLOW"
              value={btc.data?.feeFastest != null ? `${btc.data.feeFastest} / ${btc.data.feeHalfHour ?? '—'} / ${btc.data.feeHour ?? '—'}` : '—'}
              sub="sat/vB · next block / 30 min / 1 hour"
              title={ONCHAIN_EXPLAINERS.fees}
            />
            <Metric
              label="NEXT DIFFICULTY ADJUSTMENT"
              value={btc.data?.retargetChangePct != null ? `${btc.data.retargetChangePct >= 0 ? '+' : ''}${btc.data.retargetChangePct.toFixed(2)}%` : '—'}
              tone={btc.data?.retargetChangePct == null ? undefined : btc.data.retargetChangePct >= 0 ? '#E8A33D' : '#2D8A50'}
              sub={btc.data?.retargetAt ? `in ~${Math.max(0, (btc.data.retargetAt - now) / 86_400_000).toFixed(1)} days · ${btc.data.retargetBlocks?.toLocaleString() ?? '—'} blocks · projected` : '—'}
              title={ONCHAIN_EXPLAINERS.retarget}
            />
            <Metric
              label="STABLECOIN SUPPLY"
              value={usd(stables.data?.total)}
              sub={stables.data?.change1d != null ? `${pct(stables.data.change1d)} 24h` : '—'}
              tone={stables.data?.change1d == null ? undefined : toneOf(stables.data.change1d)}
              title={ONCHAIN_EXPLAINERS.stablecoins}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-2xs font-bold tracking-widest" style={{ color: '#627EEA' }}>ETHEREUM NETWORK</span>
            <SourceBadge source={eth.source} at={eth.at} now={now} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <Metric
              label="GAS · FAST / STD / SLOW"
              value={eth.data ? `${gweiFmt(eth.data.fastGwei).replace(' gwei', '')} / ${gweiFmt(eth.data.standardGwei).replace(' gwei', '')} / ${gweiFmt(eth.data.slowGwei)}` : '—'}
              sub={eth.data ? `base fee ${gweiFmt(eth.data.baseGwei)} · last 20 blocks` : 'unavailable'}
              title={ONCHAIN_EXPLAINERS.ethGas}
            />
            <Metric
              label="ETH BURNED · EST. PER DAY"
              value={eth.data ? `${eth.data.burnEthPerDay >= 100 ? eth.data.burnEthPerDay.toFixed(0) : eth.data.burnEthPerDay.toFixed(1)} ETH` : '—'}
              sub="base fee × gas used, last 20 blocks × 7,200"
              title={ONCHAIN_EXPLAINERS.ethBurn}
            />
            <Metric
              label="BLOCK SPACE USED"
              value={eth.data ? `${eth.data.utilisationPct.toFixed(0)}%` : '—'}
              sub={eth.data ? `of the gas limit · block ${eth.data.block.toLocaleString()}` : '—'}
            />
          </div>

          <div className="border border-terminal-border p-3 space-y-2.5">
            <div className="text-2xs text-terminal-gold font-bold tracking-widest">WHAT THESE MEAN</div>
            {[
              ['Hash rate', ONCHAIN_EXPLAINERS.hashrate],
              ['Difficulty', ONCHAIN_EXPLAINERS.difficulty],
              ['Difficulty adjustment', ONCHAIN_EXPLAINERS.retarget],
              ['Mempool', ONCHAIN_EXPLAINERS.mempool],
              ['Fees', ONCHAIN_EXPLAINERS.fees],
              ['Ethereum gas', ONCHAIN_EXPLAINERS.ethGas],
              ['ETH burn', ONCHAIN_EXPLAINERS.ethBurn],
            ].map(([label, text]) => (
              <div key={label}>
                <div className="text-2xs font-bold text-terminal-text-bright">{label}</div>
                <div className="text-2xs text-terminal-text-dim leading-relaxed">{text}</div>
              </div>
            ))}
            {/* These explain the mechanism and stop. "Falling exchange reserves
                are historically bullish" is a market call wearing the clothes
                of a definition, and this panel does not make one. */}
            <div className="text-2xs text-terminal-text-dim/50 pt-1 border-t border-terminal-border/30 leading-relaxed">
              These describe how the network works, not what any current level implies for
              price. Stablecoin supply from DefiLlama; Bitcoin network data from
              mempool.space; Ethereum from a public node (PublicNode). The ETH staking rate is not
              shown — no free source publishes it reliably.
            </div>
          </div>

          {stables.data?.top?.length > 0 && (
            <div className="border border-terminal-border">
              <div className="px-3 py-1.5 border-b border-terminal-border/50 text-2xs text-terminal-gold font-bold tracking-widest">
                LARGEST STABLECOINS
              </div>
              <div className="divide-y divide-terminal-border/25">
                {stables.data.top.map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="text-2xs font-bold text-terminal-text-bright w-14">{s.symbol}</span>
                    <span className="text-2xs text-terminal-text-dim flex-1 truncate">{s.name}</span>
                    <span className="text-2xs tabular-nums text-terminal-text-bright">{usd(s.circulating)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
