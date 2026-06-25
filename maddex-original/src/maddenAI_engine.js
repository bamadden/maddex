// ============================================================
// MADDENAI ENGINE — Live Market Data & Sentiment Layer
// Madden Group Pty Ltd | Core Data Infrastructure
// Version 1.0
// ============================================================
// SETUP IN REPLIT:
// 1. Create a new file: src/maddenAI_engine.js
// 2. Paste this entire file in
// 3. In Replit Secrets add:
//    VITE_ALPHA_VANTAGE_KEY = your free key from alphavantage.co
//    VITE_ANTHROPIC_API_KEY = your Anthropic key
// 4. In MaddexApp.jsx add at the top:
//    import { fetchAllMarketData, buildMarketDataContext, callMaddenAI } from './maddenAI_engine'
// ============================================================

// ── API KEYS ─────────────────────────────────────────────────
const ALPHA_VANTAGE_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY || "demo";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

// ── CACHE ─────────────────────────────────────────────────────
// Cache data for 5 minutes so we don't hammer APIs on every render
const CACHE_TTL = 5 * 60 * 1000;
const cache = {};

function getCached(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) return null;
  return entry.data;
}

function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

// ============================================================
// ASSET DEFINITIONS
// ============================================================

export const CRYPTO_ASSETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
];

export const ASX_STOCKS = [
  { symbol: "BHP.AX", name: "BHP Group", sector: "Materials" },
  { symbol: "CBA.AX", name: "Commonwealth Bank", sector: "Financials" },
  { symbol: "CSL.AX", name: "CSL Limited", sector: "Healthcare" },
  { symbol: "NAB.AX", name: "NAB", sector: "Financials" },
  { symbol: "WBC.AX", name: "Westpac", sector: "Financials" },
  { symbol: "ANZ.AX", name: "ANZ Bank", sector: "Financials" },
  { symbol: "RIO.AX", name: "Rio Tinto", sector: "Materials" },
  { symbol: "WOW.AX", name: "Woolworths", sector: "Staples" },
  { symbol: "MQG.AX", name: "Macquarie Group", sector: "Financials" },
  { symbol: "WDS.AX", name: "Woodside Energy", sector: "Energy" },
];

export const US_STOCKS = [
  { symbol: "SPY", name: "S&P 500 ETF", type: "index" },
  { symbol: "QQQ", name: "NASDAQ ETF", type: "index" },
  { symbol: "NVDA", name: "NVIDIA", type: "stock" },
  { symbol: "AAPL", name: "Apple", type: "stock" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
];

export const COMMODITIES_FX = [
  { id: "gold", symbol: "GOLD", name: "Gold", type: "commodity" },
  { id: "crude-oil-wti", symbol: "OIL", name: "Crude Oil", type: "commodity" },
  { id: "AUDUSD", symbol: "AUD/USD", name: "AUD/USD", type: "fx" },
  { id: "AUDGBP", symbol: "AUD/GBP", name: "AUD/GBP", type: "fx" },
];

// ============================================================
// FETCHERS
// ============================================================

// ── 1. CRYPTO via CoinGecko (free, no key needed) ────────────
export async function fetchCryptoData() {
  const cacheKey = "crypto";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const ids = CRYPTO_ASSETS.map((a) => a.id).join(",");
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=aud&ids=${ids}&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=1h,24h,7d`;

    const res = await fetch(url);
    const data = await res.json();

    const result = data.map((coin) => {
      const asset = CRYPTO_ASSETS.find((a) => a.id === coin.id);
      return {
        symbol: asset?.symbol || coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        priceUSD: null,
        change24h: coin.price_change_percentage_24h || 0,
        change7d: coin.price_change_percentage_7d_in_currency || 0,
        change1h: coin.price_change_percentage_1h_in_currency || 0,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        ath: coin.ath,
        athChangePercent: coin.ath_change_percentage,
        currency: "AUD",
        source: "CoinGecko",
        type: "crypto",
      };
    });

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("CoinGecko fetch failed:", err);
    return getMockCrypto();
  }
}

// ── 2. CRYPTO FEAR & GREED INDEX (free) ──────────────────────
export async function fetchCryptoFearGreed() {
  const cacheKey = "feargreed";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    const data = await res.json();
    const entry = data.data[0];
    const result = {
      value: parseInt(entry.value),
      label: entry.value_classification,
      timestamp: entry.timestamp,
    };
    setCache(cacheKey, result);
    return result;
  } catch {
    return { value: 50, label: "Neutral", timestamp: Date.now() };
  }
}

// ── 3. ASX STOCKS via Alpha Vantage ──────────────────────────
// Alpha Vantage free tier: 25 requests/day
// We batch the most important stocks and cache aggressively
export async function fetchASXData() {
  const cacheKey = "asx";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Priority stocks to fetch (top 5 to stay within rate limits)
  const priority = ["BHP.AX", "CBA.AX", "CSL.AX", "NAB.AX", "RIO.AX"];

  try {
    const results = await Promise.allSettled(
      priority.map((symbol) => fetchAlphaVantageQuote(symbol)),
    );

    const fetched = results
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

    // Fill remaining with mock data
    const allASX = ASX_STOCKS.map((stock) => {
      const live = fetched.find((f) => f.symbol === stock.symbol);
      return live || getMockASXStock(stock);
    });

    setCache(cacheKey, allASX);
    return allASX;
  } catch {
    return ASX_STOCKS.map(getMockASXStock);
  }
}

async function fetchAlphaVantageQuote(symbol) {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const q = data["Global Quote"];

    if (!q || !q["05. price"]) return null;

    const stock = ASX_STOCKS.find((s) => s.symbol === symbol);
    return {
      symbol: symbol,
      name: stock?.name || symbol,
      sector: stock?.sector || "Unknown",
      price: parseFloat(q["05. price"]),
      change: parseFloat(q["09. change"]),
      change24h: parseFloat(q["10. change percent"]?.replace("%", "") || 0),
      volume: parseInt(q["06. volume"]),
      high: parseFloat(q["03. high"]),
      low: parseFloat(q["04. low"]),
      prevClose: parseFloat(q["08. previous close"]),
      currency: "AUD",
      source: "AlphaVantage",
      type: "asx",
      live: true,
    };
  } catch {
    return null;
  }
}

// ── 4. US STOCKS via Alpha Vantage ───────────────────────────
export async function fetchUSData() {
  const cacheKey = "us";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const priority = ["SPY", "QQQ", "NVDA"];

  try {
    const results = await Promise.allSettled(
      priority.map((symbol) => fetchUSQuote(symbol)),
    );

    const fetched = results
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

    const allUS = US_STOCKS.map((stock) => {
      const live = fetched.find((f) => f.symbol === stock.symbol);
      return live || getMockUSStock(stock);
    });

    setCache(cacheKey, allUS);
    return allUS;
  } catch {
    return US_STOCKS.map(getMockUSStock);
  }
}

async function fetchUSQuote(symbol) {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const q = data["Global Quote"];

    if (!q || !q["05. price"]) return null;

    const stock = US_STOCKS.find((s) => s.symbol === symbol);
    return {
      symbol: symbol,
      name: stock?.name || symbol,
      type: stock?.type || "stock",
      price: parseFloat(q["05. price"]),
      change: parseFloat(q["09. change"]),
      change24h: parseFloat(q["10. change percent"]?.replace("%", "") || 0),
      volume: parseInt(q["06. volume"]),
      high: parseFloat(q["03. high"]),
      low: parseFloat(q["04. low"]),
      prevClose: parseFloat(q["08. previous close"]),
      currency: "USD",
      source: "AlphaVantage",
      type: "us",
      live: true,
    };
  } catch {
    return null;
  }
}

// ── 5. FX RATES via exchangerate-api (free) ──────────────────
export async function fetchFXData() {
  const cacheKey = "fx";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/AUD");
    const data = await res.json();

    const result = [
      {
        symbol: "AUD/USD",
        name: "Australian Dollar / US Dollar",
        price: data.rates?.USD || 0.65,
        change24h: null,
        type: "fx",
        source: "ExchangeRateAPI",
      },
      {
        symbol: "AUD/GBP",
        name: "Australian Dollar / British Pound",
        price: data.rates?.GBP || 0.51,
        change24h: null,
        type: "fx",
        source: "ExchangeRateAPI",
      },
      {
        symbol: "AUD/JPY",
        name: "Australian Dollar / Japanese Yen",
        price: data.rates?.JPY || 98.5,
        change24h: null,
        type: "fx",
        source: "ExchangeRateAPI",
      },
    ];

    setCache(cacheKey, result);
    return result;
  } catch {
    return [
      {
        symbol: "AUD/USD",
        name: "AUD/USD",
        price: 0.65,
        change24h: 0.3,
        type: "fx",
        source: "fallback",
      },
      {
        symbol: "AUD/GBP",
        name: "AUD/GBP",
        price: 0.51,
        change24h: 0.1,
        type: "fx",
        source: "fallback",
      },
    ];
  }
}

// ── 6. GOLD via CoinGecko (priced in AUD) ────────────────────
export async function fetchGoldData() {
  const cacheKey = "gold";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=gold&vs_currencies=aud,usd&include_24hr_change=true";
    const res = await fetch(url);
    const data = await res.json();

    const result = {
      symbol: "GOLD",
      name: "Gold",
      price: data.gold?.aud || 3100,
      priceUSD: data.gold?.usd || 2000,
      change24h: data.gold?.aud_24h_change || 0,
      type: "commodity",
      source: "CoinGecko",
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return {
      symbol: "GOLD",
      name: "Gold",
      price: 3100,
      change24h: 0.2,
      type: "commodity",
      source: "fallback",
    };
  }
}

// ============================================================
// MASTER FETCH — Gets everything at once
// ============================================================
export async function fetchAllMarketData() {
  const cacheKey = "all_market_data";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Fetch all data sources in parallel
    const [crypto, fearGreed, asx, us, fx, gold] = await Promise.allSettled([
      fetchCryptoData(),
      fetchCryptoFearGreed(),
      fetchASXData(),
      fetchUSData(),
      fetchFXData(),
      fetchGoldData(),
    ]);

    const result = {
      crypto: crypto.status === "fulfilled" ? crypto.value : getMockCrypto(),
      fearGreed:
        fearGreed.status === "fulfilled"
          ? fearGreed.value
          : { value: 50, label: "Neutral" },
      asx:
        asx.status === "fulfilled"
          ? asx.value
          : ASX_STOCKS.map(getMockASXStock),
      us: us.status === "fulfilled" ? us.value : US_STOCKS.map(getMockUSStock),
      fx: fx.status === "fulfilled" ? fx.value : [],
      gold:
        gold.status === "fulfilled"
          ? gold.value
          : { symbol: "GOLD", price: 3100, change24h: 0 },
      fetchedAt: new Date().toISOString(),
    };

    // Calculate derived metrics
    result.marketSentimentScore = calculateMarketSentimentScore(result);
    result.cryptoMomentumIndex = calculateCryptoMomentumIndex(result);
    result.asxSentiment = calculateASXSentiment(result);
    result.topGainers = getTopGainers(result);
    result.topLosers = getTopLosers(result);
    result.sectorStrength = calculateSectorStrength(result);

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("Master fetch failed:", err);
    return getMockAllMarketData();
  }
}

// ============================================================
// SENTIMENT SCORING ENGINE
// This is the intelligence layer — converts raw data into scores
// ============================================================

// ── OVERALL MARKET SENTIMENT SCORE (0–100) ───────────────────
export function calculateMarketSentimentScore(data) {
  const scores = [];
  const weights = [];

  // 1. Crypto Fear & Greed (weight: 15%)
  if (data.fearGreed?.value !== undefined) {
    scores.push(data.fearGreed.value);
    weights.push(15);
  }

  // 2. BTC momentum (weight: 20%)
  const btc = data.crypto?.find((c) => c.symbol === "BTC");
  if (btc) {
    const btcScore = change24hToScore(btc.change24h);
    scores.push(btcScore);
    weights.push(20);
  }

  // 3. ASX 200 momentum (weight: 25% — most relevant for Aus users)
  const asxAvgChange = data.asx
    ? data.asx.reduce((sum, s) => sum + (s.change24h || 0), 0) / data.asx.length
    : 0;
  scores.push(change24hToScore(asxAvgChange));
  weights.push(25);

  // 4. US markets (S&P via SPY) (weight: 20%)
  const spy = data.us?.find((u) => u.symbol === "SPY");
  if (spy) {
    scores.push(change24hToScore(spy.change24h || 0));
    weights.push(20);
  }

  // 5. Gold (safe haven indicator — inverse signal) (weight: 10%)
  if (data.gold?.change24h !== undefined) {
    // Gold rising = risk-off = lower sentiment score
    const goldScore = 50 - data.gold.change24h * 3;
    scores.push(Math.max(0, Math.min(100, goldScore)));
    weights.push(10);
  }

  // 6. AUD/USD (weight: 10% — AUD strength signals risk-on)
  const audusd = data.fx?.find((f) => f.symbol === "AUD/USD");
  if (audusd?.change24h !== undefined) {
    scores.push(change24hToScore(audusd.change24h * 2));
    weights.push(10);
  }

  if (scores.length === 0) return 50;

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = scores.reduce(
    (sum, score, i) => sum + score * weights[i],
    0,
  );
  const rawScore = weightedSum / totalWeight;

  return Math.round(Math.max(0, Math.min(100, rawScore)));
}

// ── CRYPTO MOMENTUM INDEX (0–100) ────────────────────────────
export function calculateCryptoMomentumIndex(data) {
  if (!data.crypto || data.crypto.length === 0) return 50;

  const scores = data.crypto.map((coin) => {
    let score = 50;
    // 24h change contributes most
    score += (coin.change24h || 0) * 2.5;
    // 7d change adds context
    score += (coin.change7d || 0) * 1.0;
    // 1h change adds momentum
    score += (coin.change1h || 0) * 1.5;
    return Math.max(0, Math.min(100, score));
  });

  // Weight by market cap (BTC and ETH matter more)
  const weights = [3, 2, 1.5, 1, 1, 1]; // BTC, ETH, SOL, XRP, BNB, ADA
  const totalWeight = weights
    .slice(0, scores.length)
    .reduce((a, b) => a + b, 0);
  const weighted = scores.reduce(
    (sum, score, i) => sum + score * (weights[i] || 1),
    0,
  );

  const fearGreedBoost = ((data.fearGreed?.value || 50) - 50) * 0.2;

  return Math.round(
    Math.max(0, Math.min(100, weighted / totalWeight + fearGreedBoost)),
  );
}

// ── ASX SENTIMENT (0–100) ─────────────────────────────────────
export function calculateASXSentiment(data) {
  if (!data.asx || data.asx.length === 0) return 50;

  const avgChange =
    data.asx.reduce((sum, s) => sum + (s.change24h || 0), 0) / data.asx.length;
  const gainers = data.asx.filter((s) => (s.change24h || 0) > 0).length;
  const gainerRatio = gainers / data.asx.length; // 0 to 1

  let score = 50;
  score += avgChange * 5; // price momentum
  score += (gainerRatio - 0.5) * 30; // breadth
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ── SECTOR STRENGTH ───────────────────────────────────────────
export function calculateSectorStrength(data) {
  if (!data.asx) return [];

  const sectorMap = {};
  data.asx.forEach((stock) => {
    if (!stock.sector) return;
    if (!sectorMap[stock.sector]) sectorMap[stock.sector] = [];
    sectorMap[stock.sector].push(stock.change24h || 0);
  });

  return Object.entries(sectorMap).map(([sector, changes]) => {
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    const strength = Math.round(Math.max(0, Math.min(100, 50 + avg * 5)));
    return { sector, strength, change: avg.toFixed(2) };
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function change24hToScore(change) {
  // Convert a % change to a 0-100 sentiment score
  // +5% and above = 90+, -5% and below = 10-
  return Math.max(0, Math.min(100, 50 + change * 8));
}

function getTopGainers(data) {
  const all = [
    ...(data.crypto || []).map((a) => ({ ...a, market: "Crypto" })),
    ...(data.asx || []).map((a) => ({ ...a, market: "ASX" })),
    ...(data.us || []).map((a) => ({ ...a, market: "US" })),
  ];
  return all
    .filter((a) => a.change24h !== null && a.change24h !== undefined)
    .sort((a, b) => (b.change24h || 0) - (a.change24h || 0))
    .slice(0, 5);
}

function getTopLosers(data) {
  const all = [
    ...(data.crypto || []).map((a) => ({ ...a, market: "Crypto" })),
    ...(data.asx || []).map((a) => ({ ...a, market: "ASX" })),
    ...(data.us || []).map((a) => ({ ...a, market: "US" })),
  ];
  return all
    .filter((a) => a.change24h !== null && a.change24h !== undefined)
    .sort((a, b) => (a.change24h || 0) - (b.change24h || 0))
    .slice(0, 5);
}

// ── SCORE LABEL HELPERS (for UI display) ─────────────────────
export function scoreToLabel(score) {
  if (score >= 80) return "Extremely Bullish";
  if (score >= 65) return "Bullish";
  if (score >= 55) return "Mildly Bullish";
  if (score >= 45) return "Neutral";
  if (score >= 35) return "Mildly Bearish";
  if (score >= 20) return "Bearish";
  return "Extremely Bearish";
}

export function scoreToColor(score) {
  if (score >= 65) return "#00C389";
  if (score >= 45) return "#F5A623";
  return "#FF4F5A";
}

export function fearGreedLabel(score) {
  if (score >= 80) return "Extreme Greed";
  if (score >= 60) return "Greed";
  if (score >= 45) return "Neutral";
  if (score >= 25) return "Fear";
  return "Extreme Fear";
}

// ── FORMAT HELPERS ────────────────────────────────────────────
export function formatPrice(price, currency = "AUD") {
  if (price === null || price === undefined) return "N/A";
  if (price >= 1000)
    return `$${price.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

export function formatChange(change) {
  if (change === null || change === undefined) return "—";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export function formatMarketCap(cap) {
  if (!cap) return "N/A";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

// ============================================================
// MARKET DATA CONTEXT BUILDER
// Formats live data into the {MARKET_DATA} injection for MaddenAI
// ============================================================
export function buildMarketDataContext(marketData) {
  if (!marketData)
    return "Live market data unavailable. Use training knowledge and note data may not be current.";

  const {
    crypto,
    fearGreed,
    asx,
    us,
    fx,
    gold,
    marketSentimentScore,
    cryptoMomentumIndex,
    fetchedAt,
  } = marketData;

  const asOf = fetchedAt
    ? new Date(fetchedAt).toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
      })
    : "recently";

  let context = `
=== LIVE MARKET DATA — As of ${asOf} AEST ===
All prices in AUD unless stated. Use this data to back your analysis with current figures.

── OVERALL MARKET SENTIMENT ──
MaddenAI Market Sentiment Score: ${marketSentimentScore}/100 (${scoreToLabel(marketSentimentScore)})
Crypto Fear & Greed Index: ${fearGreed?.value}/100 (${fearGreed?.label})
Crypto Momentum Index: ${cryptoMomentumIndex}/100 (${scoreToLabel(cryptoMomentumIndex)})

── ASX TOP STOCKS ──`;

  if (asx?.length) {
    asx.slice(0, 6).forEach((s) => {
      context += `\n${s.name} (${s.symbol}): ${formatPrice(s.price)} | ${formatChange(s.change24h)} today | Sector: ${s.sector}`;
    });
  }

  context += `\n\n── CRYPTO ──`;
  if (crypto?.length) {
    crypto.slice(0, 6).forEach((c) => {
      context += `\n${c.name} (${c.symbol}): ${formatPrice(c.price)} AUD | 24h: ${formatChange(c.change24h)} | 7d: ${formatChange(c.change7d)} | Mkt Cap: ${formatMarketCap(c.marketCap)}`;
    });
  }

  context += `\n\n── US MARKETS ──`;
  if (us?.length) {
    us.forEach((s) => {
      context += `\n${s.name} (${s.symbol}): $${s.price?.toFixed(2)} USD | ${formatChange(s.change24h)} today`;
    });
  }

  context += `\n\n── COMMODITIES & FX ──`;
  if (gold) {
    context += `\nGold: ${formatPrice(gold.price)} AUD | ${formatChange(gold.change24h)} today`;
  }
  if (fx?.length) {
    fx.forEach((f) => {
      context += `\n${f.symbol}: ${f.price?.toFixed(4)} | ${formatChange(f.change24h)}`;
    });
  }

  context += `\n\n── TOP MOVERS TODAY ──`;
  if (marketData.topGainers?.length) {
    context += "\nTop Gainers:";
    marketData.topGainers.slice(0, 3).forEach((a) => {
      context += ` | ${a.symbol} ${formatChange(a.change24h)}`;
    });
  }
  if (marketData.topLosers?.length) {
    context += "\nTop Losers:";
    marketData.topLosers.slice(0, 3).forEach((a) => {
      context += ` | ${a.symbol} ${formatChange(a.change24h)}`;
    });
  }

  context += `\n\n── INSTRUCTIONS FOR MADDENAI ──
- Use the above live data to back your analysis with current, specific numbers
- Reference the MaddenAI Market Sentiment Score when discussing overall market conditions
- Quote specific prices when discussing individual assets — do not use approximate or outdated figures
- If data shows a significant move (>3% in 24h), acknowledge it and explain likely drivers
- Always note whether AUD or USD pricing applies
=== END MARKET DATA ===`;

  return context;
}

// ============================================================
// MADDENAI API CALLER
// Single function to call Claude with full context injected
// ============================================================
export async function callMaddenAI(
  messages,
  userProfile = null,
  marketData = null,
) {
  // Build the full system prompt with live injections
  const userContext = buildUserContext(userProfile);
  const marketContext = buildMarketDataContext(marketData);

  const systemPrompt = MADDENAI_BASE_PROMPT.replace(
    "{USER_CONTEXT}",
    userContext,
  ).replace("{MARKET_DATA}", marketContext);

  // Demo mode — no API key
  if (!ANTHROPIC_KEY) {
    await new Promise((r) => setTimeout(r, 1200));
    return buildDemoResponse(messages, marketData);
  }

  // Live Claude API call
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "API error");
    }

    const data = await response.json();
    const text =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("") || "";

    // Try to parse as JSON (structured response)
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return { type: "structured", data: JSON.parse(clean) };
    } catch {
      // Return as conversational response
      return { type: "conversational", text };
    }
  } catch (err) {
    console.error("MaddenAI API error:", err);
    return {
      type: "error",
      text: `MaddenAI encountered an issue: ${err.message}`,
    };
  }
}

// ── USER CONTEXT BUILDER ──────────────────────────────────────
export function buildUserContext(profile) {
  if (!profile || !profile.configured) {
    return "No user profile configured. Ask one clarifying question about their situation before giving specific analysis.";
  }
  return `
User Profile:
- Income bracket: ${profile.income || "Not specified"}
- Financial goals: ${profile.goals || "Not specified"}
- Risk profile: ${profile.riskProfile || "Not specified"}
- Financial knowledge level: ${profile.knowledgeLevel || "Not specified"}
- Life stage: ${profile.lifeStage || "Not specified"}
- Subscription tier: ${profile.tier || "Core"}

Calibrate your response language and depth to their knowledge level.
Reference their income bracket when discussing contribution caps or tax thresholds.
Frame risk accordingly to their stated risk profile.`.trim();
}

// ── DEMO RESPONSE BUILDER ─────────────────────────────────────
function buildDemoResponse(messages, marketData) {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const btc = marketData?.crypto?.find((c) => c.symbol === "BTC");
  const mss = marketData?.marketSentimentScore || 58;

  if (lastMsg.includes("btc") || lastMsg.includes("bitcoin")) {
    return {
      type: "structured",
      data: {
        asset: "Bitcoin (BTC)",
        ticker: "BTC",
        price: btc ? formatPrice(btc.price) : "AUD $98,450",
        change: btc ? formatChange(btc.change24h) + " today" : "+2.8% today",
        buyProbability: 68,
        sentiment: "Bullish",
        sentimentScore: 71,
        macroContext:
          "Global risk appetite is constructive. US Fed holding rates steady is providing a tailwind for risk assets including crypto.",
        fundamentalView:
          "Bitcoin's on-chain data shows long-term holder accumulation. Exchange outflows suggest reduced selling pressure.",
        technicalView:
          "BTC is holding above the 50-day moving average. Key resistance at $100k AUD. Support at $90k.",
        sentimentView: `Crypto Fear & Greed Index at ${marketData?.fearGreed?.value || 62}/100 — ${marketData?.fearGreed?.label || "Greed"} territory. Social volume elevated.`,
        insight:
          "The weight of evidence across all four lenses is constructive for BTC. Macro tailwinds, institutional accumulation, and positive sentiment alignment create a reasonable setup. However the $100k level is a significant psychological resistance zone that has rejected price multiple times.",
        keyRisk:
          "A surprise hawkish move from the US Fed or a major exchange security incident could trigger sharp downside. Crypto volatility remains extreme — 20-30% drawdowns are common even in bull markets.",
        watchFor:
          "A confirmed close above $100k AUD with strong volume would be the key breakout signal. Watch US CPI data this week.",
        educationNote:
          "On-chain data refers to transaction data recorded on the Bitcoin blockchain — it tells us what large holders are actually doing with their coins, which is often more reliable than price-based signals alone.",
        disclaimer:
          "This is general financial information only and does not constitute personal financial advice. MaddenAI is not a licensed financial adviser. Madden Group holds no AFSL.",
      },
    };
  }

  return {
    type: "structured",
    data: {
      asset: "Market Overview",
      ticker: "MARKET",
      price: "N/A",
      change: "Mixed",
      buyProbability: mss,
      sentiment: scoreToLabel(mss),
      sentimentScore: mss,
      macroContext:
        "The RBA has held the cash rate steady. Inflation is easing gradually. Australian employment data remains solid, supporting consumer spending.",
      fundamentalView:
        "ASX valuations are reasonable at current levels. Materials sector faces China demand uncertainty. Financials benefit from higher-for-longer rates.",
      technicalView:
        "ASX 200 is consolidating near all-time highs. Short-term momentum is neutral. Watch the 8,000 level as key support.",
      sentimentView: `MaddenAI Market Sentiment Score: ${mss}/100. Crypto Fear & Greed at ${marketData?.fearGreed?.value || 55}/100. Overall sentiment is constructive but not euphoric.`,
      insight:
        "Australian markets are in a broadly constructive environment. The macro backdrop — stable rates, solid employment, easing inflation — is supportive. The key risk is external: US recession signals and Chinese demand weakness could weigh on materials and risk sentiment quickly.",
      keyRisk:
        "Global recession risk remains elevated. China's property sector weakness continues to weigh on commodity demand — directly impacting Australia's largest export sector.",
      watchFor:
        "RBA minutes this week, US non-farm payrolls, and Chinese PMI data are the key macro events to watch.",
      educationNote:
        "The ASX 200 is Australia's main share market index — it tracks the 200 largest companies listed on the Australian Securities Exchange by market capitalisation.",
      disclaimer:
        "This is general financial information only and does not constitute personal financial advice. MaddenAI is not a licensed financial adviser. Madden Group holds no AFSL.",
    },
  };
}

// ============================================================
// MOCK DATA FALLBACKS
// Used when APIs are unavailable or rate-limited
// ============================================================
function getMockCrypto() {
  return [
    {
      symbol: "BTC",
      name: "Bitcoin",
      price: 98450,
      change24h: 2.8,
      change7d: 8.2,
      change1h: 0.4,
      marketCap: 1.9e12,
      type: "crypto",
      source: "mock",
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      price: 5840,
      change24h: 1.9,
      change7d: 6.1,
      change1h: 0.2,
      marketCap: 7e11,
      type: "crypto",
      source: "mock",
    },
    {
      symbol: "SOL",
      name: "Solana",
      price: 285,
      change24h: 3.4,
      change7d: 12.1,
      change1h: 0.8,
      marketCap: 1.3e11,
      type: "crypto",
      source: "mock",
    },
    {
      symbol: "XRP",
      name: "XRP",
      price: 0.92,
      change24h: -0.8,
      change7d: 2.1,
      change1h: -0.1,
      marketCap: 5e10,
      type: "crypto",
      source: "mock",
    },
    {
      symbol: "BNB",
      name: "BNB",
      price: 920,
      change24h: 1.2,
      change7d: 4.5,
      change1h: 0.3,
      marketCap: 1.4e11,
      type: "crypto",
      source: "mock",
    },
    {
      symbol: "ADA",
      name: "Cardano",
      price: 0.72,
      change24h: -1.1,
      change7d: 1.8,
      change1h: -0.2,
      marketCap: 2.5e10,
      type: "crypto",
      source: "mock",
    },
  ];
}

function getMockASXStock(stock) {
  const mockPrices = {
    "BHP.AX": { price: 43.82, change24h: -1.2 },
    "CBA.AX": { price: 128.4, change24h: 0.8 },
    "CSL.AX": { price: 298.6, change24h: 0.4 },
    "NAB.AX": { price: 36.2, change24h: 0.6 },
    "WBC.AX": { price: 29.85, change24h: 0.3 },
    "ANZ.AX": { price: 29.4, change24h: 0.5 },
    "RIO.AX": { price: 118.6, change24h: -0.9 },
    "WOW.AX": { price: 32.1, change24h: 0.2 },
    "MQG.AX": { price: 224.8, change24h: 1.1 },
    "WDS.AX": { price: 26.4, change24h: -0.6 },
  };
  const mock = mockPrices[stock.symbol] || { price: 50, change24h: 0 };
  return { ...stock, ...mock, currency: "AUD", source: "mock", type: "asx" };
}

function getMockUSStock(stock) {
  const mockPrices = {
    SPY: { price: 582.4, change24h: 0.8 },
    QQQ: { price: 495.2, change24h: 1.4 },
    NVDA: { price: 875.4, change24h: 6.4 },
    AAPL: { price: 228.6, change24h: 1.2 },
    TSLA: { price: 182.6, change24h: -2.1 },
  };
  const mock = mockPrices[stock.symbol] || { price: 100, change24h: 0 };
  return { ...stock, ...mock, currency: "USD", source: "mock", type: "us" };
}

function getMockAllMarketData() {
  const crypto = getMockCrypto();
  const asx = ASX_STOCKS.map(getMockASXStock);
  const us = US_STOCKS.map(getMockUSStock);
  const fearGreed = { value: 62, label: "Greed" };
  const gold = {
    symbol: "GOLD",
    name: "Gold",
    price: 3124,
    change24h: 0.3,
    type: "commodity",
    source: "mock",
  };
  const fx = [
    {
      symbol: "AUD/USD",
      price: 0.6485,
      change24h: 0.3,
      type: "fx",
      source: "mock",
    },
    {
      symbol: "AUD/GBP",
      price: 0.512,
      change24h: 0.1,
      type: "fx",
      source: "mock",
    },
  ];

  const data = {
    crypto,
    asx,
    us,
    fearGreed,
    gold,
    fx,
    fetchedAt: new Date().toISOString(),
  };
  data.marketSentimentScore = calculateMarketSentimentScore(data);
  data.cryptoMomentumIndex = calculateCryptoMomentumIndex(data);
  data.asxSentiment = calculateASXSentiment(data);
  data.topGainers = getTopGainers(data);
  data.topLosers = getTopLosers(data);
  data.sectorStrength = calculateSectorStrength(data);
  return data;
}

// ============================================================
// MADDENAI BASE PROMPT
// Compact version of the full system prompt for API calls
// Full version lives in MaddenAI_System_Prompt.js
// ============================================================
const MADDENAI_BASE_PROMPT = `You are MaddenAI, the financial intelligence engine powering Maddex by Madden Group. You provide general financial information and market intelligence for everyday Australians — not personal financial advice.

CORE PHILOSOPHY:
- Use every available piece of information to form evidence-backed views
- Never state an opinion without supporting data or reasoning
- Calibrate language to the user's experience level
- Always contextualise for the Australian market (ASX, RBA, ATO, super, franking credits)
- Young Australians are your primary audience — meet them where they are

ANALYTICAL FRAMEWORK (apply all four lenses):
1. MACRO: RBA rates, inflation, AUD/USD, global risk appetite
2. FUNDAMENTAL: Earnings, P/E, yield, balance sheet quality
3. TECHNICAL: Trend, support/resistance, momentum, volume
4. SENTIMENT: News flow, social signals, fear/greed, analyst consensus

RESPONSE FORMAT:
For asset-specific queries, respond ONLY in this exact JSON:
{
  "asset": "Full asset name",
  "ticker": "Symbol",
  "price": "Current price in AUD",
  "change": "% change",
  "buyProbability": 0,
  "sentiment": "Bullish/Mildly Bullish/Neutral/Mildly Bearish/Bearish",
  "sentimentScore": 0,
  "macroContext": "1-2 sentences",
  "fundamentalView": "1-2 sentences",
  "technicalView": "1-2 sentences",
  "sentimentView": "1-2 sentences",
  "insight": "2-3 sentence synthesised view — the main intelligence output",
  "keyRisk": "Single biggest risk to this view",
  "watchFor": "Specific indicator or price level to monitor",
  "educationNote": "One plain-English explanation of a concept in this response",
  "disclaimer": "This is general financial information only and does not constitute personal financial advice. MaddenAI is not a licensed financial adviser. Madden Group holds no AFSL."
}

For general questions, respond conversationally: direct answer → evidence → Australian context → risk → next step.

AFSL COMPLIANCE — NON-NEGOTIABLE:
- Never tell a user to buy, sell, or hold a specific asset based on their personal situation
- Never guarantee returns
- Always include the disclaimer in structured responses
- For financial hardship: direct to National Debt Helpline 1800 007 007
- Major decisions: recommend a licensed AFSL adviser at moneysmart.gov.au

USER CONTEXT:
{USER_CONTEXT}

LIVE MARKET DATA:
{MARKET_DATA}

Use the live market data above to back every analysis with current, specific numbers. Always note data currency ("as of today" / "at time of writing"). If data shows a significant move (>3%), acknowledge and explain it.`;
