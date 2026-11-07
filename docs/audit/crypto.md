# Audit: Crypto

Phase 5, 5 Nov 2026. Files: `src/modules/crypto/*` (CryptoModule,
CryptoExtras, DefiPanel), `src/services/{api,dataService,defiService,maddenAiScoring}.js`,
`src/utils/cryptoSource.js`. Surveyed with a read-only agent; the top
findings were checked in the code before building.

## Findings, by impact

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: honesty, licence | DefiLlama is switched off, but a cached copy is returned before the licence check and badged LIVE ('cache' → LIVE), and on a licence error an old copy is served as STALE. | `defiService.js:44–55`; `utils/dataClass.js:57` | Done 5 Nov: a switched-off source returns 'off' before the cache is read; nothing saved earlier is shown as LIVE or STALE; Settings shows SWITCHED OFF |
| 2 | High: honesty | The DeFi panel says "live public API, no key" and shows "Nothing in this category right now" instead of saying the source is switched off; the stablecoin tile and note too. | `DefiPanel.jsx:95, 187, 282, 335` | Done 5 Nov: the DEFI tab says DefiLlama is switched off pending review of its terms; stablecoin tiles say "source switched off" |
| 3 | High: honesty | Missing Fear & Greed history shown as 50 (neutral): yesterday, 7d and 30d. | `api.js:924–926` | Done 5 Nov: a missing day is null and shows "—"; a reading without today's value counts as no reading |
| 4 | High: honesty | Missing 24h change becomes 0%, missing market cap and volume "0". | `api.js:882, 887, 889`; `CryptoModule.jsx:113, 160, 421` | Done 5 Nov: null, shown as "—" or "24h change unavailable"; sector averages leave missing coins out |
| 5 | High: legal | Halving card: "Past halvings have preceded strong rallies". | `CryptoExtras.jsx:62` | Done 7 Nov: removed; the card says how the date is estimated, credits mempool.space with a badge, and says when the 10-minute target stands in for a missing average |
| 6 | High: legal, honesty | Momentum factor "Volume Conviction" defaults to 50 when volume is missing and is absent from the published method. | `maddenAiScoring.js:147, 154`; `methodology.js` | Next |
| 7 | High: honesty | My Crypto counts unpriced coins as A$0, which reads as a loss; footer always "Priced live from CoinGecko". | `CryptoExtras.jsx:114, 118, 200` | Next |
| 8 | Medium | "vs yesterday" BTC dominance compares with the first reading this browser saw that UTC day. | `CryptoModule.jsx:328–347` | Next |
| 9 | Medium | Global metrics, Fear & Greed, dominance and the price chart have no DataBadge; header time shows only when stale; A$ view shows the USD market-cap change unlabelled; market-cap sparkline is a top-20 approximation, unlabelled. | `CryptoModule.jsx:236–313, 375, 514, 769, 841` | Next |
| 10 | Medium: call volume | Coins outside a 12-entry id map request history with a guessed id (404 + retry), though `coin.id` is available; up to 4 CoinGecko calls on open, 1–2 per click, per reader, on a 10k/month plan. | `CryptoModule.jsx:747`; `api.js:779` | Next |
| 11 | Medium: a11y | Rows, top-volume rows and sort headers are mouse-only; ✕ and ⚙ unlabelled; My Crypto inputs rely on placeholders. | `CryptoModule.jsx:121, 1097, 1123`; `CryptoExtras.jsx:160` | Next |
| 12 | Low | Console noise (`Crypto title bar height`, API logs); halving card uncredited (mempool.space); hand-typed AU facts' checked date only in a comment; dead props; 1D chart points without a time and zone. | various | Later |

What works: one 60-second markets snapshot shared across the app, no
interval polling; currency, ECB rate and Sydney fetch time labelled;
CoinGecko and alternative.me credits beside the data; momentum score has
its ScoreNote; halving date computed from the live block height and
labelled an estimate.
