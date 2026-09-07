// ─── Black-Scholes ──────────────────────────────────────────────────────────
//
// Theoretical European option pricing and the five greeks. Pure arithmetic, so
// every output here can be checked against any published calculator — and the
// module says it is a MODEL, because a theoretical price is not a quote and the
// distance between them is where people lose money.

// Standard normal CDF via Abramowitz & Stegun 7.1.26, accurate to ~1e-7 — well
// past what an option price displayed to the cent needs.
export function normCdf(x) {
  const sign = x < 0 ? -1 : 1
  const z = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * z)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z)
  return 0.5 * (1 + sign * y)
}

const normPdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)

// S spot, K strike, days to expiry, vol as a percentage, rate as a percentage.
export function blackScholes({ spot, strike, days, volPct, ratePct, type = 'call' }) {
  const S = spot, K = strike
  const T = days / 365
  const sigma = volPct / 100
  const r = ratePct / 100

  if (!(S > 0 && K > 0 && T > 0 && sigma > 0)) {
    // At or past expiry an option is worth its intrinsic value and nothing
    // else — returning a model price there would be a nonsense.
    const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)
    return { price: intrinsic, intrinsic, timeValue: 0, delta: intrinsic > 0 ? (type === 'call' ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, rho: 0, d1: null, d2: null, expired: true }
  }

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const disc = Math.exp(-r * T)

  const Nd1 = normCdf(d1)
  const Nd2 = normCdf(d2)
  const nd1 = normPdf(d1)

  const call = S * Nd1 - K * disc * Nd2
  const put = K * disc * normCdf(-d2) - S * normCdf(-d1)
  const price = type === 'call' ? call : put

  const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)

  return {
    price,
    intrinsic,
    timeValue: price - intrinsic,
    // Greeks in the units a holder actually experiences: theta per DAY rather
    // than per year, vega per ONE percentage point of vol rather than per unit,
    // rho per one percentage point of rate. Quoting theta per year is correct
    // and useless.
    delta: type === 'call' ? Nd1 : Nd1 - 1,
    gamma: nd1 / (S * sigma * sqrtT),
    theta: ((-S * nd1 * sigma) / (2 * sqrtT) + (type === 'call' ? -1 : 1) * r * K * disc * (type === 'call' ? Nd2 : normCdf(-d2))) / 365,
    vega: (S * nd1 * sqrtT) / 100,
    rho: ((type === 'call' ? 1 : -1) * K * T * disc * (type === 'call' ? Nd2 : normCdf(-d2))) / 100,
    d1, d2, expired: false,
  }
}

// A volatility smile: out-of-the-money options trade at higher implied vol than
// at-the-money ones, and downside puts higher still. This shapes the chain's IV
// column so it looks like a real chain rather than a flat line — it is a SHAPE,
// generated, and the chain is labelled indicative throughout.
export function smileIv(strike, spot, baseVol = 22) {
  const moneyness = (strike - spot) / spot
  // Quadratic smile plus a downside skew term: puts below spot carry the
  // premium, which is what makes it a skew rather than a symmetric smile.
  return baseVol + 120 * moneyness * moneyness - 14 * moneyness
}
