// ============================================================
// MADDENAI CHAT DATA RESOLVER v1.0
// Madden Group Pty Ltd
// ============================================================
// This file solves the problem of the AI chat not having
// live data when users ask about specific assets.
//
// HOW IT WORKS:
// 1. User types a message e.g. "What do you think of WOW?"
// 2. resolveQueryData() detects which assets are mentioned
// 3. Fetches live data specifically for those assets
// 4. Injects the live data into the prompt before calling Claude
// 5. Claude responds with real current prices and context
//
// SETUP IN REPLIT:
// Save as src/maddenAI_resolver.js
// Then tell the Replit Agent:
// "Integrate maddenAI_resolver.js into the chat screen so that
//  every message goes through resolveQueryData() before calling
//  the Claude API"
// ============================================================

const ALPHA_VANTAGE_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY || "demo";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

// ── SHORT-TERM CACHE (2 minutes for chat queries) ─────────────
const RESOLVER_CACHE_TTL = 2 * 60 * 1000;
const resolverCache = {};

function getCached(key) {
  const entry = resolverCache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > RESOLVER_CACHE_TTL) return null;
  return entry.data;
}
function setCache(key, data) {
  resolverCache[key] = { data, timestamp: Date.now() };
}

// ============================================================
// ASSET RECOGNITION MAP
// Maps user-friendly names and tickers to API identifiers
// ============================================================
export const ASSET_MAP = {
  // ── ASX STOCKS ─────────────────────────────────────────────
  WOW: {
    symbol: "WOW.AX",
    name: "Woolworths Group",
    type: "asx",
    sector: "Consumer Staples",
  },
  WOOLWORTHS: {
    symbol: "WOW.AX",
    name: "Woolworths Group",
    type: "asx",
    sector: "Consumer Staples",
  },
  BHP: {
    symbol: "BHP.AX",
    name: "BHP Group",
    type: "asx",
    sector: "Materials",
  },
  CBA: {
    symbol: "CBA.AX",
    name: "Commonwealth Bank",
    type: "asx",
    sector: "Financials",
  },
  "COMMONWEALTH BANK": {
    symbol: "CBA.AX",
    name: "Commonwealth Bank",
    type: "asx",
    sector: "Financials",
  },
  CSL: {
    symbol: "CSL.AX",
    name: "CSL Limited",
    type: "asx",
    sector: "Healthcare",
  },
  NAB: { symbol: "NAB.AX", name: "NAB", type: "asx", sector: "Financials" },
  WBC: { symbol: "WBC.AX", name: "Westpac", type: "asx", sector: "Financials" },
  WESTPAC: {
    symbol: "WBC.AX",
    name: "Westpac",
    type: "asx",
    sector: "Financials",
  },
  ANZ: {
    symbol: "ANZ.AX",
    name: "ANZ Bank",
    type: "asx",
    sector: "Financials",
  },
  RIO: {
    symbol: "RIO.AX",
    name: "Rio Tinto",
    type: "asx",
    sector: "Materials",
  },
  "RIO TINTO": {
    symbol: "RIO.AX",
    name: "Rio Tinto",
    type: "asx",
    sector: "Materials",
  },
  MQG: {
    symbol: "MQG.AX",
    name: "Macquarie Group",
    type: "asx",
    sector: "Financials",
  },
  MACQUARIE: {
    symbol: "MQG.AX",
    name: "Macquarie Group",
    type: "asx",
    sector: "Financials",
  },
  WDS: {
    symbol: "WDS.AX",
    name: "Woodside Energy",
    type: "asx",
    sector: "Energy",
  },
  WOODSIDE: {
    symbol: "WDS.AX",
    name: "Woodside Energy",
    type: "asx",
    sector: "Energy",
  },
  WES: {
    symbol: "WES.AX",
    name: "Wesfarmers",
    type: "asx",
    sector: "Consumer Disc.",
  },
  WESFARMERS: {
    symbol: "WES.AX",
    name: "Wesfarmers",
    type: "asx",
    sector: "Consumer Disc.",
  },
  TLS: { symbol: "TLS.AX", name: "Telstra", type: "asx", sector: "Telecoms" },
  TELSTRA: {
    symbol: "TLS.AX",
    name: "Telstra",
    type: "asx",
    sector: "Telecoms",
  },
  FMG: {
    symbol: "FMG.AX",
    name: "Fortescue",
    type: "asx",
    sector: "Materials",
  },
  FORTESCUE: {
    symbol: "FMG.AX",
    name: "Fortescue",
    type: "asx",
    sector: "Materials",
  },
  XRO: { symbol: "XRO.AX", name: "Xero", type: "asx", sector: "Technology" },
  XERO: { symbol: "XRO.AX", name: "Xero", type: "asx", sector: "Technology" },
  GMG: {
    symbol: "GMG.AX",
    name: "Goodman Group",
    type: "asx",
    sector: "Real Estate",
  },
  GOODMAN: {
    symbol: "GMG.AX",
    name: "Goodman Group",
    type: "asx",
    sector: "Real Estate",
  },
  RHC: {
    symbol: "RHC.AX",
    name: "Ramsay Health Care",
    type: "asx",
    sector: "Healthcare",
  },
  ALU: { symbol: "ALU.AX", name: "Altium", type: "asx", sector: "Technology" },
  SEK: {
    symbol: "SEK.AX",
    name: "Seek Limited",
    type: "asx",
    sector: "Technology",
  },
  COL: {
    symbol: "COL.AX",
    name: "Coles Group",
    type: "asx",
    sector: "Consumer Staples",
  },
  COLES: {
    symbol: "COL.AX",
    name: "Coles Group",
    type: "asx",
    sector: "Consumer Staples",
  },
  QBE: {
    symbol: "QBE.AX",
    name: "QBE Insurance",
    type: "asx",
    sector: "Insurance",
  },
  SUN: {
    symbol: "SUN.AX",
    name: "Suncorp Group",
    type: "asx",
    sector: "Insurance",
  },
  SUNCORP: {
    symbol: "SUN.AX",
    name: "Suncorp Group",
    type: "asx",
    sector: "Insurance",
  },
  ALL: {
    symbol: "ALL.AX",
    name: "Aristocrat Leisure",
    type: "asx",
    sector: "Consumer Disc.",
  },
  MIN: {
    symbol: "MIN.AX",
    name: "Mineral Resources",
    type: "asx",
    sector: "Materials",
  },
  NXT: { symbol: "NXT.AX", name: "NextDC", type: "asx", sector: "Technology" },
  VAS: {
    symbol: "VAS.AX",
    name: "Vanguard Australian Shares ETF",
    type: "asx",
    sector: "ETF",
  },
  A200: {
    symbol: "A200.AX",
    name: "BetaShares Australia 200 ETF",
    type: "asx",
    sector: "ETF",
  },

  // ── US STOCKS ──────────────────────────────────────────────
  NVDA: { symbol: "NVDA", name: "NVIDIA", type: "us", sector: "Technology" },
  NVIDIA: { symbol: "NVDA", name: "NVIDIA", type: "us", sector: "Technology" },
  AAPL: { symbol: "AAPL", name: "Apple", type: "us", sector: "Technology" },
  APPLE: { symbol: "AAPL", name: "Apple", type: "us", sector: "Technology" },
  TSLA: { symbol: "TSLA", name: "Tesla", type: "us", sector: "Consumer Disc." },
  TESLA: {
    symbol: "TSLA",
    name: "Tesla",
    type: "us",
    sector: "Consumer Disc.",
  },
  MSFT: { symbol: "MSFT", name: "Microsoft", type: "us", sector: "Technology" },
  MICROSOFT: {
    symbol: "MSFT",
    name: "Microsoft",
    type: "us",
    sector: "Technology",
  },
  GOOGL: {
    symbol: "GOOGL",
    name: "Alphabet (Google)",
    type: "us",
    sector: "Technology",
  },
  GOOGLE: {
    symbol: "GOOGL",
    name: "Alphabet (Google)",
    type: "us",
    sector: "Technology",
  },
  AMZN: {
    symbol: "AMZN",
    name: "Amazon",
    type: "us",
    sector: "Consumer Disc.",
  },
  AMAZON: { symbol: "AMZN", name: "Amazon", type: "us", sector: "Technology" },
  META: {
    symbol: "META",
    name: "Meta Platforms",
    type: "us",
    sector: "Technology",
  },
  SPY: { symbol: "SPY", name: "S&P 500 ETF", type: "us", sector: "Index" },
  "S&P 500": { symbol: "SPY", name: "S&P 500", type: "us", sector: "Index" },
  "S&P": { symbol: "SPY", name: "S&P 500", type: "us", sector: "Index" },
  QQQ: { symbol: "QQQ", name: "NASDAQ ETF", type: "us", sector: "Index" },
  NASDAQ: { symbol: "QQQ", name: "NASDAQ", type: "us", sector: "Index" },
  IVV: {
    symbol: "IVV",
    name: "iShares S&P 500 ETF",
    type: "us",
    sector: "ETF",
  },
  VTS: {
    symbol: "VTS",
    name: "Vanguard US Total Market ETF",
    type: "us",
    sector: "ETF",
  },
  NDQ: {
    symbol: "QQQ",
    name: "BetaShares NASDAQ ETF",
    type: "us",
    sector: "ETF",
  },

  // ── CRYPTO ─────────────────────────────────────────────────
  BTC: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", type: "crypto" },
  BITCOIN: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", type: "crypto" },
  ETH: { id: "ethereum", symbol: "ETH", name: "Ethereum", type: "crypto" },
  ETHEREUM: { id: "ethereum", symbol: "ETH", name: "Ethereum", type: "crypto" },
  SOL: { id: "solana", symbol: "SOL", name: "Solana", type: "crypto" },
  SOLANA: { id: "solana", symbol: "SOL", name: "Solana", type: "crypto" },
  XRP: { id: "ripple", symbol: "XRP", name: "XRP", type: "crypto" },
  BNB: { id: "binancecoin", symbol: "BNB", name: "BNB", type: "crypto" },
  ADA: { id: "cardano", symbol: "ADA", name: "Cardano", type: "crypto" },
  CARDANO: { id: "cardano", symbol: "ADA", name: "Cardano", type: "crypto" },
  DOGE: { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", type: "crypto" },
  DOGECOIN: {
    id: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    type: "crypto",
  },
  DOT: { id: "polkadot", symbol: "DOT", name: "Polkadot", type: "crypto" },
  LINK: { id: "chainlink", symbol: "LINK", name: "Chainlink", type: "crypto" },
  AVAX: {
    id: "avalanche-2",
    symbol: "AVAX",
    name: "Avalanche",
    type: "crypto",
  },
  MATIC: {
    id: "matic-network",
    symbol: "MATIC",
    name: "Polygon",
    type: "crypto",
  },

  // ── COMMODITIES ────────────────────────────────────────────
  GOLD: { id: "gold", symbol: "GOLD", name: "Gold", type: "commodity" },
  OIL: { symbol: "OIL", name: "Crude Oil WTI", type: "commodity" },
  CRUDE: { symbol: "OIL", name: "Crude Oil WTI", type: "commodity" },
  SILVER: { id: "silver", symbol: "XAG", name: "Silver", type: "commodity" },
  "IRON ORE": { symbol: "IRON", name: "Iron Ore", type: "commodity" },

  // ── FX ─────────────────────────────────────────────────────
  AUD: { symbol: "AUD/USD", name: "Australian Dollar", type: "fx" },
  "AUD/USD": { symbol: "AUD/USD", name: "AUD/USD", type: "fx" },
  AUDUSD: { symbol: "AUD/USD", name: "AUD/USD", type: "fx" },
  "AUD/GBP": { symbol: "AUD/GBP", name: "AUD/GBP", type: "fx" },
};

// ============================================================
// QUERY PARSER
// Detects which assets a user is asking about
// ============================================================
export function parseAssetsFromQuery(query) {
  const upperQuery = query.toUpperCase();
  const found = [];

  // Check each asset in the map
  Object.entries(ASSET_MAP).forEach(([key, asset]) => {
    // Match whole words only (avoid "ALL" matching "BALL" etc)
    const regex = new RegExp(
      `\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (regex.test(query)) {
      // Avoid duplicates (e.g. "WOOLWORTHS" and "WOW" both matching)
      const alreadyFound = found.find((f) => f.symbol === asset.symbol);
      if (!alreadyFound) {
        found.push(asset);
      }
    }
  });

  return found;
}

// ============================================================
// LIVE DATA FETCHERS FOR SPECIFIC ASSETS
// ============================================================

// ── Fetch a single ASX stock ──────────────────────────────────
async function fetchSingleASXStock(symbol) {
  const cacheKey = `asx_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const q = data["Global Quote"];

    if (!q || !q["05. price"]) {
      // Alpha Vantage rate limited — try Yahoo Finance via proxy
      return await fetchYahooFinance(symbol);
    }

    const result = {
      symbol,
      price: parseFloat(q["05. price"]),
      change: parseFloat(q["09. change"]),
      change24h: parseFloat(q["10. change percent"]?.replace("%", "") || 0),
      volume: parseInt(q["06. volume"]),
      high: parseFloat(q["03. high"]),
      low: parseFloat(q["04. low"]),
      prevClose: parseFloat(q["08. previous close"]),
      currency: "AUD",
      source: "AlphaVantage",
      live: true,
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return await fetchYahooFinance(symbol);
  }
}

// ── Yahoo Finance fallback via public API ─────────────────────
async function fetchYahooFinance(symbol) {
  const cacheKey = `yahoo_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Use a CORS proxy to access Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

    const res = await fetch(proxyUrl);
    const data = await res.json();
    const parsed = JSON.parse(data.contents);

    const meta = parsed?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const result = {
      symbol,
      price: meta.regularMarketPrice,
      prevClose: meta.chartPreviousClose || meta.previousClose,
      change:
        meta.regularMarketPrice -
        (meta.chartPreviousClose || meta.previousClose),
      change24h:
        ((meta.regularMarketPrice -
          (meta.chartPreviousClose || meta.previousClose)) /
          (meta.chartPreviousClose || meta.previousClose)) *
        100,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      marketCap: meta.marketCap,
      currency: meta.currency || "AUD",
      source: "Yahoo Finance",
      live: true,
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ── Fetch a single crypto coin ────────────────────────────────
async function fetchSingleCrypto(coinId, symbol) {
  const cacheKey = `crypto_${coinId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
    const res = await fetch(url);
    const data = await res.json();

    const md = data.market_data;
    const result = {
      symbol: symbol || data.symbol?.toUpperCase(),
      name: data.name,
      price: md.current_price?.aud,
      priceUSD: md.current_price?.usd,
      change24h: md.price_change_percentage_24h,
      change7d: md.price_change_percentage_7d,
      change30d: md.price_change_percentage_30d,
      change1y: md.price_change_percentage_1y,
      marketCap: md.market_cap?.aud,
      marketCapRank: data.market_cap_rank,
      volume24h: md.total_volume?.aud,
      high24h: md.high_24h?.aud,
      low24h: md.low_24h?.aud,
      ath: md.ath?.aud,
      athDate: md.ath_date?.aud,
      athChangePercent: md.ath_change_percentage?.aud,
      circulatingSupply: data.market_data?.circulating_supply,
      totalSupply: data.market_data?.total_supply,
      currency: "AUD",
      source: "CoinGecko",
      live: true,
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ── Fetch FX rate ─────────────────────────────────────────────
async function fetchFXRate(pair) {
  const cacheKey = `fx_${pair}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const [base, quote] = pair.split("/");
    const url = `https://open.er-api.com/v6/latest/${base}`;
    const res = await fetch(url);
    const data = await res.json();

    const rate = data.rates?.[quote];
    if (!rate) return null;

    const result = {
      symbol: pair,
      price: rate,
      base,
      quote,
      source: "ExchangeRateAPI",
      live: true,
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ============================================================
// MASTER RESOLVER
// Takes a user query, identifies assets, fetches live data,
// returns formatted context string for the AI prompt
// ============================================================
export async function resolveQueryData(query, existingMarketData = null) {
  const assets = parseAssetsFromQuery(query);

  // If no specific assets detected, use existing market data
  if (assets.length === 0) {
    return {
      assets: [],
      context: buildGeneralContext(existingMarketData),
      hasLiveData: !!existingMarketData,
    };
  }

  // Fetch live data for detected assets in parallel
  const fetchPromises = assets.map(async (asset) => {
    try {
      let liveData = null;

      if (asset.type === "asx") {
        liveData = await fetchSingleASXStock(asset.symbol);
      } else if (asset.type === "us") {
        liveData = await fetchSingleASXStock(asset.symbol); // Same Alpha Vantage endpoint
      } else if (asset.type === "crypto" && asset.id) {
        liveData = await fetchSingleCrypto(asset.id, asset.symbol);
      } else if (asset.type === "fx") {
        liveData = await fetchFXRate(asset.symbol);
      }

      return { asset, liveData };
    } catch {
      return { asset, liveData: null };
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  const resolved = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  // Build the data context string for the AI
  const context = buildAssetContext(resolved, existingMarketData);

  return {
    assets: resolved,
    context,
    hasLiveData: resolved.some((r) => r.liveData?.live),
  };
}

// ============================================================
// CONTEXT BUILDERS
// Format live data into readable text for the AI prompt
// ============================================================

function buildAssetContext(resolved, marketData) {
  let context = "=== LIVE ASSET DATA FOR THIS QUERY ===\n";
  context += `Data fetched: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} AEST\n\n`;

  resolved.forEach(({ asset, liveData }) => {
    context += `── ${asset.name} (${asset.symbol}) ──\n`;

    if (liveData) {
      if (asset.type === "crypto") {
        context += `Current Price: ${formatAUD(liveData.price)} AUD`;
        if (liveData.priceUSD)
          context += ` / $${liveData.priceUSD?.toFixed(2)} USD`;
        context += `\n`;
        context += `24h Change: ${formatChange(liveData.change24h)}\n`;
        if (liveData.change7d)
          context += `7d Change: ${formatChange(liveData.change7d)}\n`;
        if (liveData.change30d)
          context += `30d Change: ${formatChange(liveData.change30d)}\n`;
        if (liveData.change1y)
          context += `1y Change: ${formatChange(liveData.change1y)}\n`;
        if (liveData.high24h)
          context += `24h High: ${formatAUD(liveData.high24h)} AUD\n`;
        if (liveData.low24h)
          context += `24h Low: ${formatAUD(liveData.low24h)} AUD\n`;
        if (liveData.marketCap)
          context += `Market Cap: ${formatLarge(liveData.marketCap)} AUD\n`;
        if (liveData.volume24h)
          context += `24h Volume: ${formatLarge(liveData.volume24h)} AUD\n`;
        if (liveData.ath)
          context += `All-Time High: ${formatAUD(liveData.ath)} AUD (${liveData.athChangePercent?.toFixed(1)}% from ATH)\n`;
        if (liveData.marketCapRank)
          context += `Market Cap Rank: #${liveData.marketCapRank}\n`;
      } else if (asset.type === "asx" || asset.type === "us") {
        const currency = asset.type === "us" ? "USD" : "AUD";
        context += `Current Price: $${liveData.price?.toFixed(2)} ${currency}\n`;
        context += `24h Change: ${formatChange(liveData.change24h)} ($${Math.abs(liveData.change || 0).toFixed(2)})\n`;
        if (liveData.high)
          context += `Day High: $${liveData.high?.toFixed(2)}\n`;
        if (liveData.low) context += `Day Low: $${liveData.low?.toFixed(2)}\n`;
        if (liveData.prevClose)
          context += `Previous Close: $${liveData.prevClose?.toFixed(2)}\n`;
        if (liveData.volume)
          context += `Volume: ${liveData.volume?.toLocaleString()}\n`;
        if (liveData.marketCap)
          context += `Market Cap: ${formatLarge(liveData.marketCap)}\n`;
        context += `Sector: ${asset.sector || "N/A"}\n`;
        context += `Data Source: ${liveData.source}\n`;
      } else if (asset.type === "fx") {
        context += `Rate: ${liveData.price?.toFixed(4)}\n`;
        context += `Data Source: ${liveData.source}\n`;
      }
    } else {
      context += `⚠️ Live data unavailable for ${asset.symbol} right now.\n`;
      context += `Use your training knowledge but note that prices may have changed significantly.\n`;
      context += `Explicitly tell the user you don't have real-time data for this asset.\n`;
    }
    context += "\n";
  });

  // Add broader market context if available
  if (marketData) {
    context += buildGeneralContext(marketData);
  }

  context += "\n=== CRITICAL INSTRUCTIONS ===\n";
  context +=
    "- Use the EXACT prices above — do not estimate or use approximate values\n";
  context += "- Reference the data fetch time so the user knows it's current\n";
  context += "- If any data is marked unavailable, explicitly tell the user\n";
  context +=
    "- Always quote prices in AUD for Australian users unless USD is more relevant\n";
  context +=
    "- Note whether the ASX is currently open or closed when relevant\n";
  context += "=== END LIVE DATA ===\n";

  return context;
}

function buildGeneralContext(marketData) {
  if (!marketData)
    return "No broader market data available — use your training knowledge.\n";

  const mss =
    marketData.marketSentimentScore?.score ||
    marketData.marketSentimentScore ||
    50;
  const cmi =
    marketData.cryptoMomentumIndex?.score ||
    marketData.cryptoMomentumIndex ||
    50;
  const fg = marketData.fearGreed;
  const asxAv = marketData.asx?.length
    ? (
        marketData.asx.reduce((s, a) => s + (a.change24h || 0), 0) /
        marketData.asx.length
      ).toFixed(2)
    : "0.00";

  let ctx = "── Broader Market Context ──\n";
  ctx += `MaddenAI Market Sentiment Score: ${mss}/100\n`;
  ctx += `Crypto Momentum Index: ${cmi}/100\n`;
  if (fg) ctx += `Fear & Greed: ${fg.value}/100 (${fg.label})\n`;
  ctx += `ASX Average Change Today: ${asxAv}%\n`;

  if (marketData.topGainers?.length) {
    ctx += `Top Gainers: ${marketData.topGainers
      .slice(0, 3)
      .map((g) => `${g.symbol} +${g.change24h?.toFixed(1)}%`)
      .join(", ")}\n`;
  }
  if (marketData.topLosers?.length) {
    ctx += `Top Losers: ${marketData.topLosers
      .slice(0, 3)
      .map((l) => `${l.symbol} ${l.change24h?.toFixed(1)}%`)
      .join(", ")}\n`;
  }

  return ctx;
}

// ── FORMAT HELPERS ────────────────────────────────────────────
function formatAUD(price) {
  if (!price) return "N/A";
  if (price >= 1000)
    return `$${price.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function formatChange(change) {
  if (change === null || change === undefined) return "N/A";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function formatLarge(n) {
  if (!n) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// ── ASX HOURS CHECKER ─────────────────────────────────────────
export function isASXOpen() {
  const now = new Date();
  const sydney = new Date(
    now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }),
  );
  const hour = sydney.getHours();
  const minute = sydney.getMinutes();
  const day = sydney.getDay(); // 0 = Sunday, 6 = Saturday

  if (day === 0 || day === 6) return false; // Weekend
  const timeNum = hour * 100 + minute;
  return timeNum >= 1000 && timeNum <= 1600; // 10:00am - 4:00pm Sydney
}

export function getASXStatus() {
  if (isASXOpen()) {
    return { open: true, label: "ASX Open", color: "#00C389" };
  }

  const now = new Date();
  const sydney = new Date(
    now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }),
  );
  const day = sydney.getDay();

  if (day === 0)
    return {
      open: false,
      label: "ASX Closed — Opens Monday",
      color: "#6B7FA3",
    };
  if (day === 6)
    return {
      open: false,
      label: "ASX Closed — Opens Monday",
      color: "#6B7FA3",
    };

  const hour = sydney.getHours();
  if (hour < 10)
    return {
      open: false,
      label: "ASX Opens at 10:00am AEST",
      color: "#F5A623",
    };
  return {
    open: false,
    label: "ASX Closed — Opens Tomorrow",
    color: "#6B7FA3",
  };
}

// ============================================================
// FULL CHAT HANDLER
// Drop-in replacement for the existing callMaddenAI function
// Automatically resolves live data before calling Claude
// ============================================================
export async function handleChatMessage(
  userMessage,
  conversationHistory,
  userProfile = null,
  marketData = null,
  systemPrompt = null,
) {
  // Step 1 — Resolve live data for assets mentioned in the query
  const resolved = await resolveQueryData(userMessage, marketData);

  // Step 2 — Build the complete system prompt with live data
  const basePrompt = systemPrompt || getBasePrompt();
  const userCtx = buildUserContextString(userProfile);
  const fullPrompt = basePrompt
    .replace("{USER_CONTEXT}", userCtx)
    .replace("{MARKET_DATA}", resolved.context);

  // Step 3 — Build message array
  const messages = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Step 4 — Call Claude
  if (!ANTHROPIC_KEY) {
    // Demo mode
    await new Promise((r) => setTimeout(r, 1000));
    return {
      type: "demo",
      text: `Demo mode — add your Anthropic API key to get live MaddenAI responses. You asked about: ${userMessage}`,
      resolved,
    };
  }

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
        system: fullPrompt,
        messages,
      }),
    });

    const data = await response.json();
    const text =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("") || "";

    // Try JSON parse (structured response for asset queries)
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      if (clean.startsWith("{")) {
        return { type: "structured", data: JSON.parse(clean), resolved };
      }
    } catch {
      /* fall through to conversational */
    }

    return { type: "conversational", text, resolved };
  } catch (err) {
    return {
      type: "error",
      text: `MaddenAI encountered an issue: ${err.message}. Please try again.`,
      resolved,
    };
  }
}

// ── USER CONTEXT BUILDER ──────────────────────────────────────
function buildUserContextString(profile) {
  if (!profile?.configured) {
    return "No user profile set. Ask one clarifying question about their situation before giving specific analysis.";
  }
  return `Income: ${profile.income || "N/A"} | Goals: ${profile.goals || "N/A"} | Risk: ${profile.riskProfile || "N/A"} | Knowledge: ${profile.knowledgeLevel || "N/A"} | Life stage: ${profile.lifeStage || "N/A"}`;
}

// ── BASE PROMPT ───────────────────────────────────────────────
function getBasePrompt() {
  return `You are MaddenAI, the financial intelligence engine powering Maddex by Madden Group. You provide general financial information and market intelligence for everyday Australians — never personal financial advice.

CRITICAL: You have live market data injected below. ALWAYS use these exact current prices in your response — never estimate or use approximate values from your training data.

When asked about a specific asset, respond in this JSON format:
{
  "asset": "Full name",
  "ticker": "Symbol",
  "price": "Exact current price from live data above",
  "change": "Exact % change from live data above",
  "buyProbability": 0,
  "sentiment": "Bullish/Mildly Bullish/Neutral/Mildly Bearish/Bearish",
  "sentimentScore": 0,
  "macroContext": "1-2 sentences on macro environment",
  "fundamentalView": "1-2 sentences on fundamentals",
  "technicalView": "1-2 sentences on technical picture",
  "sentimentView": "1-2 sentences on market sentiment",
  "insight": "2-3 sentence synthesised view",
  "keyRisk": "Biggest risk to this view",
  "watchFor": "Key indicator or level to watch",
  "educationNote": "Plain-English explanation of one concept used",
  "disclaimer": "This is general financial information only. Not personal financial advice. Madden Group holds no AFSL."
}

For general questions, respond conversationally: direct answer → evidence → Australian context → risk → next step.

AFSL COMPLIANCE: Never tell users to buy/sell specific assets. Never guarantee returns. Always include disclaimer. Direct hardship cases to National Debt Helpline 1800 007 007.

USER CONTEXT:
{USER_CONTEXT}

LIVE MARKET DATA:
{MARKET_DATA}`;
}
