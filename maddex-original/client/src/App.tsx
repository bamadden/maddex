// ============================================================
// MADDEX — Powered by MaddenAI
// Madden Group | Full Multi-Screen App
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, CartesianGrid,
  ReferenceLine, LabelList,
} from "recharts";
import { fetchAllMarketData, fetchPricesForHoldings } from "./maddenAI_engine";
import {
  handleChatMessage,
  getASXStatus,
  parseAssetsFromQuery,
} from "./maddenAI_resolver";
import { buildCompleteSystemPrompt } from "./maddenAI_personalisation";
import {
  calculateMarketSentimentScore,
  calculateCryptoMomentumIndex,
  calculateSectorStrength,
  calculateASXSentiment,
  scoreToBullBearBreakdown,
  scoreToLabel,
  scoreToColor,
  generateSnapshotText,
  explainScore,
  formatPrice,
  formatChange,
} from "./maddenAI_scoring";
import {
  onAuthChange,
  getSession,
  signIn,
  signUp,
  signOut,
  getPortfolio,
  addToPortfolio,
  removeFromPortfolio,
  updateShares,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  searchAssets,
  searchAssetsLive,
  calculatePortfolioValue,
  getAssetTypeLabel,
  getAssetTypeColor,
  UNLISTED_TYPES,
  getUserProfile,
  updateUserProfile,
  updateEmail,
  updatePassword,
  uploadAvatar,
  deleteAccount,
} from "./maddex_auth";

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg:        "#0B1222",
  card:      "#111827",
  cardBorder:"#1E2A44",
  accent:    "#287BFF",
  accentDim: "rgba(40,123,255,0.15)",
  gold:      "#F5A623",
  goldDim:   "rgba(245,166,35,0.12)",
  pos:       "#00C389",
  posDim:    "rgba(0,195,137,0.12)",
  neg:       "#FF4F5A",
  negDim:    "rgba(255,79,90,0.12)",
  neutral:   "#6B7FA3",
  text:      "#E8EDF5",
  textMuted: "#6B7FA3",
  textDim:   "#3D4F6E",
};

// ============================================================
// FORMAT HELPERS — 2 decimal places everywhere
// ============================================================
const fmt$ = (v: number) =>
  v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => v.toFixed(2);

// Decode any HTML entities that slip through from RSS feeds or article content
function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&nbsp;/g, " ");
}

// ============================================================
// MOCK DATA
// ============================================================
const portfolioByPeriod: Record<string, Array<{ d: string; v: number }>> = {
  "1D": [
    { d: "9am",  v: 124200 }, { d: "10am", v: 125100 }, { d: "11am", v: 124600 },
    { d: "12pm", v: 125800 }, { d: "1pm",  v: 125400 }, { d: "2pm",  v: 126100 },
    { d: "3pm",  v: 126780 },
  ],
  "1W": [
    { d: "Mon", v: 122400 }, { d: "Tue", v: 119800 }, { d: "Wed", v: 123100 },
    { d: "Thu", v: 121500 }, { d: "Fri", v: 124200 }, { d: "Sat", v: 125100 }, { d: "Sun", v: 126780 },
  ],
  "1M": [
    { d: "1 Mar", v: 115000 }, { d: "8 Mar",  v: 118200 }, { d: "15 Mar", v: 116800 },
    { d: "22 Mar", v: 126780 },
  ],
  "3M": [
    { d: "Jan", v: 104000 }, { d: "Feb", v: 112000 }, { d: "Mar", v: 126780 },
  ],
};

// Builds a live chart series anchored to the real portfolio total value.
// Uses each holding's weighted 24h change to estimate the period start,
// with sqrt-of-time volatility scaling so 1M/3M don't over-extrapolate.
function buildLiveChartData(
  totalValue: number,
  enrichedHoldings: any[],
  period: string
): Array<{ d: string; v: number }> {
  if (totalValue <= 0) return portfolioByPeriod[period];

  // Weighted avg 24h change across holdings (in %)
  const weightedDayChgPct = enrichedHoldings.reduce((s, h) => {
    const w = totalValue > 0 ? (h.totalValue ?? 0) / totalValue : 0;
    return s + w * (h.change24h ?? 0);
  }, 0);

  // Use sqrt-of-time scaling (statistically realistic) with hard caps per period
  //   1D  → use raw daily change,  cap ±8%
  //   1W  → sqrt(5)  ≈ 2.24×,     cap ±15%
  //   1M  → sqrt(22) ≈ 4.7×,      cap ±25%
  //   3M  → sqrt(66) ≈ 8.1×,      cap ±40%
  const sqrtMap: Record<string, number> = { "1D": 1, "1W": 2.24, "1M": 4.7, "3M": 8.1 };
  const capMap:  Record<string, number> = { "1D": 8, "1W": 15,   "1M": 25,  "3M": 40  };
  const sqrtMult = sqrtMap[period] ?? 1;
  const cap      = capMap[period]  ?? 8;
  const rawPct   = weightedDayChgPct * sqrtMult;
  const totalChgPct = Math.max(-cap, Math.min(cap, rawPct));
  const startValue  = totalValue / (1 + totalChgPct / 100);

  const labelsMap: Record<string, string[]> = {
    "1D": ["9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "Now"],
    "1W": ["Mon", "Tue", "Wed", "Thu", "Fri", "Now"],
    "1M": ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Now"],
    "3M": ["Jan", "Feb", "Mar", "Now"],
  };
  const labels = labelsMap[period] ?? labelsMap["1D"];
  const n = labels.length;

  // Gentle sine-wave noise that tapers to zero at the endpoint
  const amplitude = Math.abs(totalValue - startValue) * 0.15;

  return labels.map((d, i) => {
    const t     = i / (n - 1);
    const trend = startValue + (totalValue - startValue) * t;
    const noise = amplitude * Math.sin(i * 2.1 + 0.5) * Math.pow(1 - t, 0.7);
    return { d, v: Math.round(trend + noise) };
  });
}

const allocation = [
  { name: "Equities", value: 56, color: C.accent },
  { name: "Crypto",   value: 22, color: C.gold },
  { name: "Cash",     value: 7,  color: C.neutral },
  { name: "Bonds",    value: 9,  color: C.pos },
  { name: "Alts",     value: 6,  color: "#A78BFA" },
];

const holdings = [
  { ticker: "NVDA", name: "NVIDIA",        value: 28400, change: +6.4, sentiment: "Bullish",        sentimentColor: C.pos },
  { ticker: "BTC",  name: "Bitcoin",       value: 22100, change: +2.8, sentiment: "Bullish",        sentimentColor: C.pos },
  { ticker: "VAS",  name: "Vanguard ASX",  value: 18700, change: +0.4, sentiment: "Neutral",        sentimentColor: C.neutral },
  { ticker: "BHP",  name: "BHP Group",     value: 14200, change: -3.1, sentiment: "Bearish",        sentimentColor: C.neg },
  { ticker: "AAPL", name: "Apple",         value: 12300, change: +1.2, sentiment: "Mildly Bullish",  sentimentColor: C.pos },
];

const watchlist = [
  { ticker: "ETH",  name: "Ethereum",  price: "$5,840",  forecast: "Mildly Bullish", note: "Layer 2 adoption accelerating. Watch $6k resistance." },
  { ticker: "CBA",  name: "Comm. Bank", price: "$128.40", forecast: "Neutral",        note: "Fairly valued at current levels. Dividend solid." },
  { ticker: "TSLA", name: "Tesla",     price: "$182.60", forecast: "Mildly Bearish", note: "Margin pressure continuing. Robotaxi timeline uncertain." },
];

const sectorData = [
  { sector: "Tech",       strength: 88 },
  { sector: "Energy",     strength: 52 },
  { sector: "Financials", strength: 71 },
  { sector: "Healthcare", strength: 64 },
  { sector: "Crypto",     strength: 74 },
  { sector: "Materials",  strength: 45 },
];

const sectorBarData = [
  { name: "Tech",       val: 88, color: C.accent },
  { name: "Crypto",     val: 74, color: C.gold },
  { name: "Financials", val: 71, color: C.pos },
  { name: "Healthcare", val: 64, color: "#A78BFA" },
  { name: "Energy",     val: 52, color: C.neutral },
  { name: "Materials",  val: 45, color: C.neg },
];

const topMovers = [
  { ticker: "NVDA", change: +6.4, why: "Blowout earnings; data centre demand surges past expectations." },
  { ticker: "BHP",  change: -3.1, why: "Iron ore prices fell on weak Chinese manufacturing data." },
  { ticker: "BTC",  change: +2.8, why: "Spot ETF inflows hit monthly record; institutional demand rising." },
];

const newsItems = [
  { headline: "RBA holds rates steady at 4.35%",    time: "2h ago",  impact: "Positive for AUD",     impactColor: C.pos,     summary: "The Reserve Bank left the cash rate unchanged, citing easing inflation. Markets now pricing first cut in Q3 2025.",       aiSentiment: "Bullish",  aiConf: 78, category: "Macro",       categoryColor: "#F5A623", priority: "high"    },
  { headline: "Tech stocks rally on AI chip demand", time: "4h ago",  impact: "Positive for equities", impactColor: C.pos,     summary: "NASDAQ surged 2.1% as semiconductor companies beat earnings expectations. AI infrastructure spend showing no signs of slowing.", aiSentiment: "Bullish",  aiConf: 84, category: "Tech",        categoryColor: "#287BFF", priority: "high"    },
  { headline: "Oil prices fall on demand concerns",  time: "6h ago",  impact: "Neutral for ASX",       impactColor: C.neutral, summary: "Brent crude dropped 3.2% on weak Chinese manufacturing data. Energy sector under pressure globally.",                      aiSentiment: "Bearish",  aiConf: 62, category: "Commodities", categoryColor: "#F97316", priority: "normal"  },
  { headline: "ASX 200 holds 8,000 support level",  time: "8h ago",  impact: "Neutral for equities",  impactColor: C.neutral, summary: "Australian equities consolidated near key technical support. Materials dragged the index while tech outperformed.",         aiSentiment: "Neutral",  aiConf: 55, category: "Markets",     categoryColor: "#00C389", priority: "normal"  },
  { headline: "AUD/USD strengthens on rate hold",    time: "10h ago", impact: "Positive for AUD",     impactColor: C.pos,     summary: "The Australian dollar rose 0.4% against the USD following the RBA decision. Export competitiveness slightly reduced.",     aiSentiment: "Bullish",  aiConf: 71, category: "FX",          categoryColor: "#A78BFA", priority: "normal"  },
];

// AI data for market indices on Trends screen
const marketIndices = [
  { name: "S&P 500",  value: "$5,820.00",  change: +0.8, aiSentiment: "Bullish",       aiConf: 74, bullPct: 74 },
  { name: "NASDAQ",   value: "$18,340.00", change: +1.4, aiSentiment: "Bullish",       aiConf: 81, bullPct: 81 },
  { name: "ASX 200",  value: "$8,120.00",  change: +0.3, aiSentiment: "Mildly Bullish", aiConf: 63, bullPct: 63 },
  { name: "BTC",      value: "$98,450.00", change: +2.8, aiSentiment: "Bullish",       aiConf: 68, bullPct: 68 },
  { name: "Gold",     value: "$3,024.00",  change: -0.4, aiSentiment: "Neutral",       aiConf: 51, bullPct: 51 },
  { name: "AUD/USD",  value: "$0.6480",    change: +0.4, aiSentiment: "Neutral",       aiConf: 55, bullPct: 55 },
];

// Market indices by period (change % varies by timeframe)
const marketIndicesByPeriod: Record<string, typeof marketIndices> = {
  "1H": marketIndices.map((m, i) => ({ ...m, change: [+0.3, +0.8, +0.1, +1.2, -0.1, +0.2][i] })),
  "1D": marketIndices,
  "1W": marketIndices.map((m, i) => ({ ...m, change: [+2.1, +4.3, +0.8, +8.2, -1.2, +1.4][i] })),
  "1M": marketIndices.map((m, i) => ({ ...m, change: [+5.4, +11.2, +3.1, +22.4, +2.8, +3.1][i] })),
  "1Y": marketIndices.map((m, i) => ({ ...m, change: [+24.1, +38.2, +11.4, +148.2, +18.4, -4.2][i] })),
};

// Crypto breakdown for expanded momentum index
const cryptoBreakdown = [
  { ticker: "BTC", name: "Bitcoin",  score: 68, change: +2.8, note: "Spot ETF inflows at record. Institutional accumulation ongoing above $90k." },
  { ticker: "ETH", name: "Ethereum", score: 61, change: +1.4, note: "Layer 2 activity surging. Dencun upgrade improving fee economics." },
  { ticker: "SOL", name: "Solana",   score: 72, change: +4.1, note: "Outperforming BTC. High-throughput adoption in DeFi & memecoins." },
  { ticker: "BNB", name: "Binance",  score: 44, change: -0.8, note: "Regulatory headwinds in key markets weigh on sentiment." },
];
const cryptoMomentumScore = 62;
const cryptoAIInsight = "Altcoins gaining ground on BTC. On-chain data shows strong retail participation returning. Watch BTC $100k resistance for next directional move.";

// Overall AI market signal
const aiMarketSignal = {
  sentiment: "Bullish",
  bullPct: 72,
  neutralPct: 18,
  bearPct: 10,
  confidence: 76,
  insight: "MaddenAI detects broad-based bullish momentum. Tech and crypto lead while materials lag. RBA's rate hold is supportive.",
  updatedAt: "22 Mar, 1:18 PM",
};

// AI confidence for holdings
const holdingsWithAI = [
  { ticker: "NVDA", name: "NVIDIA",        value: 28400, change: +6.4, sentiment: "Bullish",        sentimentColor: C.pos,     aiConf: 82, bullPct: 82 },
  { ticker: "BTC",  name: "Bitcoin",       value: 22100, change: +2.8, sentiment: "Bullish",        sentimentColor: C.pos,     aiConf: 68, bullPct: 68 },
  { ticker: "VAS",  name: "Vanguard ASX",  value: 18700, change: +0.4, sentiment: "Neutral",        sentimentColor: C.neutral, aiConf: 55, bullPct: 55 },
  { ticker: "BHP",  name: "BHP Group",     value: 14200, change: -3.1, sentiment: "Bearish",        sentimentColor: C.neg,     aiConf: 39, bullPct: 39 },
  { ticker: "AAPL", name: "Apple",         value: 12300, change: +1.2, sentiment: "Mildly Bullish",  sentimentColor: C.pos,     aiConf: 64, bullPct: 64 },
];

const aiRecs = [
  { ticker: "NVDA", change: +6.4, confidence: 82, signal: "Buy",  color: C.pos,
    name: "NVIDIA Corp", market: "NASDAQ", price: 891.40, open: 840.20, high: 897.60, low: 835.10,
    reason: "Hyperscaler AI chip demand at record. Data centre revenue beat by 18%. Momentum intact above $850 support. Jensen Huang's GPU roadmap underpins long-term growth." },
  { ticker: "BTC",  change: +2.8, confidence: 68, signal: "Buy",  color: C.pos,
    name: "Bitcoin", market: "Crypto", price: 98450, open: 95800, high: 99200, low: 95600,
    reason: "Spot ETF inflows at record levels. Institutional accumulation ongoing above $95k. Halving cycle tailwinds remain. BTC holding key support is constructive." },
  { ticker: "AUD",  change: +0.4, confidence: 55, signal: "Hold", color: C.neutral,
    name: "AUD/USD", market: "FX", price: 0.6480, open: 0.6455, high: 0.6495, low: 0.6440,
    reason: "RBA holding rates steady limits upside. China demand uncertain. Fair value range $0.63–$0.66 in current macro. No strong directional catalyst near-term." },
  { ticker: "BHP",  change: -3.1, confidence: 61, signal: "Sell", color: C.neg,
    name: "BHP Group", market: "ASX", price: 42.80, open: 44.16, high: 44.30, low: 42.60,
    reason: "Iron ore weakness on softer Chinese stimulus. Cost inflation at Escondida. Earnings risk to the downside in H1. Consider reducing exposure on any bounce toward $44." },
];

const QUICK_PROMPTS = [
  "Show top gainers today",
  "Why did my portfolio drop?",
  "Explain franking credits",
  "Should I buy BTC now?",
  "Summarise today's market",
  "Best way to use my super",
];

// Returns profile-aware quick prompts based on knowledge + goals
function getProfilePrompts(profile: any): string[] {
  if (!profile) return QUICK_PROMPTS;
  const k = profile.knowledge_level || "";
  const g = profile.goals || "";
  const r = profile.risk_profile || "";

  if (k === "Beginner") {
    return [
      "How do I start investing?",
      "What is an ETF and should I use one?",
      "How does superannuation work?",
      "Is it too late to start investing?",
      "What's the difference between shares and ETFs?",
      "How much should I save before investing?",
    ];
  }
  if (k === "Advanced") {
    if (g === "Income / Dividends") return [
      "Franking credit gross-up at 45% marginal rate",
      "SMSF vs industry fund above $500k",
      "Best ASX dividend stocks by after-tax yield",
      "Dividend imputation and the corporate tax shield",
      "LIC discount to NTA — current opportunities?",
      "Fully vs partially franked — which wins at my rate?",
    ];
    if (r === "Aggressive") return [
      "High-conviction ASX small-cap ideas",
      "Options income strategies on blue chips",
      "Concentrated vs diversified — when to concentrate?",
      "Current risk/reward on BTC at this level",
      "Sector rotation signals right now",
      "Where's the asymmetric opportunity in this market?",
    ];
    return [
      "EV/EBITDA on ASX industrials vs global peers",
      "Yield curve inversion — what does it mean for ASX?",
      "SMSF setup threshold — is $500k still the rule?",
      "Trust structure vs company for investment income",
      "Salary sacrifice vs non-concessional — which first?",
      "Where are we in the credit cycle?",
    ];
  }
  // Intermediate
  if (g === "Retirement") return [
    "Should I salary sacrifice more into super?",
    "What is the concessional contributions cap?",
    "Catch-up contributions — do I qualify?",
    "When can I access my super?",
    "Super vs property — where does the maths land?",
    "Best super investment option for my age?",
  ];
  if (g === "Income / Dividends") return [
    "Best ASX dividend stocks right now",
    "How do franking credits work?",
    "CBA vs NAB — which for dividends?",
    "What is a LIC and how does it pay income?",
    "Dividend yield vs total return — what matters more?",
    "How to build a $2,000/month dividend income stream?",
  ];
  return QUICK_PROMPTS;
}

// ============================================================
// MARKET STATUS HELPER — DST-aware + live holiday check
// ============================================================
function getLocalTime(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const p = (type: string) => parts.find(x => x.type === type)?.value ?? "0";
  const h   = parseInt(p("hour")) % 24; // guard "24" for midnight
  const m   = parseInt(p("minute"));
  const yr  = p("year"); const mo = p("month"); const dy = p("day");
  const localDate = new Date(`${yr}-${mo}-${dy}T12:00:00Z`);
  return { h, m, dow: localDate.getUTCDay() };
}

// liveStatus comes from marketData.marketStatus (fetched from Alpha Vantage MARKET_STATUS)
// Shape: { aus: "open"|"closed"|"unknown", us: "open"|"closed"|"unknown" }
function computeMarketStatus(focus: "AUS" | "US", liveStatus?: { aus: string; us: string }) {
  const now = new Date();
  if (focus === "AUS") {
    const { h, m, dow } = getLocalTime(now, "Australia/Sydney");
    const isWeekday = dow >= 1 && dow <= 5;
    const t = h + m / 60;
    if (!isWeekday) return { label: "ASX Closed (Weekend)", color: C.textMuted, dot: "○" };
    // If live API confirms closed during normal hours → it's a public holiday
    if (liveStatus?.aus === "closed" && t >= 7 && t < 16)
      return { label: "ASX Closed (Holiday)", color: C.textMuted, dot: "○" };
    if (t >= 7 && t < 10)    return { label: "ASX Pre-Open",     color: C.gold,     dot: "◑" };
    if (t >= 10 && t < 15.5) return { label: "ASX Open",         color: C.pos,      dot: "●" };
    if (t >= 15.5 && t < 16) return { label: "ASX Closing Soon", color: C.gold,     dot: "◑" };
    const minsUntilOpen = t < 7 ? Math.round((7 - t) * 60) : Math.round(((24 - t) + 7) * 60);
    if (minsUntilOpen < 60)  return { label: `ASX Opens in ${minsUntilOpen}m`, color: C.neutral, dot: "○" };
    return                          { label: "ASX Closed",        color: C.textMuted, dot: "○" };
  } else {
    const { h, m, dow } = getLocalTime(now, "America/New_York");
    const isWeekday = dow >= 1 && dow <= 5;
    const t = h + m / 60;
    if (!isWeekday) return { label: "US Closed (Weekend)", color: C.textMuted, dot: "○" };
    if (liveStatus?.us === "closed" && t >= 9.5 && t < 16)
      return { label: "US Closed (Holiday)", color: C.textMuted, dot: "○" };
    if (t >= 4 && t < 9.5)    return { label: "US Pre-Market",   color: C.gold,     dot: "◑" };
    if (t >= 9.5 && t < 15.5) return { label: "US Markets Open", color: C.pos,      dot: "●" };
    if (t >= 15.5 && t < 16)  return { label: "US Closing Soon", color: C.gold,     dot: "◑" };
    const minsUntilOpen = t < 4 ? Math.round((4 - t) * 60) : Math.round(((24 - t) + 4) * 60);
    if (minsUntilOpen < 60)   return { label: `US Opens in ${minsUntilOpen}m`, color: C.neutral, dot: "○" };
    return                           { label: "US Closed",        color: C.textMuted, dot: "○" };
  }
}

// ============================================================
// TREND LINE — SVG diagonal, consistent across all OS
// ============================================================
function TrendLine({ up, color, size = 11 }: { up: boolean; color: string; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 12 12"
      style={{ display: "inline-block", verticalAlign: "middle", marginRight: 3, flexShrink: 0 }}
    >
      {up
        ? <line x1="1" y1="11" x2="11" y2="1" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        : <line x1="1" y1="1"  x2="11" y2="11" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      }
    </svg>
  );
}

// ============================================================
// INTRADAY CHART BUILDER — mock smooth price path for the day
// ============================================================
function buildIntradayChart(currentPrice: number, changePct: number, points = 28) {
  const startPrice = currentPrice / (1 + changePct / 100);
  const result: { t: string; v: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const progress = i / points;
    const noise = (Math.sin(i * 0.9) * 0.4 + Math.sin(i * 0.35 + 1) * 0.6) * Math.abs(changePct) * 0.08 * currentPrice / 100;
    const trend = startPrice + (currentPrice - startPrice) * progress;
    const totalHours = 6.5; // 9:30 – 4:00
    const mins = Math.round(progress * totalHours * 60);
    const h = 9 + Math.floor((mins + 30) / 60);
    const m = (mins + 30) % 60;
    result.push({ t: `${h}:${m.toString().padStart(2, "0")}`, v: parseFloat((trend + noise).toFixed(4)) });
  }
  return result;
}

// ============================================================
// DISCLAIMER
// ============================================================
function Disclaimer() {
  return (
    <div style={{ margin: "16px 0 4px", padding: "10px 12px", background: "#0a1120", border: `1px solid ${C.cardBorder}`, borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.6 }}>
        <span style={{ color: C.textMuted, fontWeight: 600 }}>General Information Only.</span> Not personal financial advice. Madden Group holds no AFSL. Always consult a licensed financial adviser before making any financial decision.
      </div>
    </div>
  );
}

// ============================================================
// LOGIN SCREEN
// ============================================================
const COUNTRIES = [
  "Australia", "New Zealand", "United States", "United Kingdom", "Canada",
  "Singapore", "Hong Kong", "Germany", "France", "Japan", "India",
  "South Africa", "UAE", "Other",
];

function LoginScreen({ onLogin }: { onLogin: (session: any) => void }) {
  const [mode, setMode]               = useState<"login" | "signup">("login");
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [country, setCountry]         = useState("Australia");
  const [email, setEmail]             = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [verified, setVerified]       = useState(false);

  // Granular error state — each maps to a specific UI location
  const [bannerError, setBannerError]         = useState<string | null>(null);   // top-of-form banner
  const [emailFieldError, setEmailFieldError] = useState<"format" | "exists" | null>(null);
  const [pwFieldError, setPwFieldError]       = useState<"wrong" | "weak" | null>(null);
  const [resending, setResending]             = useState(false);
  const [resendSent, setResendSent]           = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid  = emailRegex.test(email.trim());
  const emailError  = emailTouched && !emailValid;

  // Show weak-password hint while typing (signup only, no server call needed)
  const passwordTooShort = mode === "signup" && password.length > 0 && password.length < 8;

  const signupReady = mode === "login" || (
    firstName.trim() !== "" && lastName.trim() !== "" && country !== "" &&
    emailValid && password.length >= 8
  );

  // ── Error classifier ────────────────────────────────────────
  const classifyError = (msg: string) => {
    const m = msg.toLowerCase();

    // Email already registered (Supabase returns various phrasings)
    if (m.includes("already registered") || m.includes("already exists") || m.includes("user already")) {
      setEmailFieldError("exists");
      return;
    }
    // Wrong password / invalid credentials
    if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("wrong password") || m.includes("incorrect password") || m.includes("invalid email or password")) {
      setPwFieldError("wrong");
      return;
    }
    // Unverified email
    if (m.includes("email not confirmed") || m.includes("not verified") || m.includes("confirm your email")) {
      setBannerError("unverified");
      return;
    }
    // Rate limited
    if (m.includes("too many") || m.includes("rate limit") || m.includes("over_email_send_rate_limit") || m.includes("request limit")) {
      setBannerError("rate_limit");
      return;
    }
    // Network error
    if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch") || m.includes("connection")) {
      setBannerError("network");
      return;
    }
    // Invalid email format (server-side)
    if (m.includes("valid email") || m.includes("invalid email") || m.includes("email address")) {
      setEmailFieldError("format");
      return;
    }
    // Fallback banner
    setBannerError(msg);
  };

  const clearAllErrors = () => {
    setBannerError(null); setEmailFieldError(null); setPwFieldError(null);
    setResendSent(false);
  };

  const handleSubmit = async () => {
    clearAllErrors();

    if (mode === "signup") {
      if (!firstName.trim() || !lastName.trim() || !emailValid || password.length < 8 || !country) {
        if (!emailValid) setEmailFieldError("format");
        if (password.length < 8 && password.length > 0) setPwFieldError("weak");
        return;
      }
    } else {
      if (!email.trim() || !password) {
        if (!email.trim()) setEmailFieldError("format");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const data = await signIn(email, password);
        onLogin(data.session);
      } else {
        const data = await signUp(email, password, firstName, lastName, country);
        if ((data as any).needsVerification) {
          setVerified(true);
        } else {
          onLogin((data as any).session);
        }
      }
    } catch (e: any) {
      classifyError(e.message || "");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      setResendSent(true);
    } catch { /* */ } finally {
      setResending(false);
    }
  };

  const switchToLogin = () => {
    clearAllErrors();
    setMode("login");
    setPassword("");
    setFirstName(""); setLastName(""); setCountry("Australia");
    setEmailTouched(false);
    // keep email pre-filled
  };

  const clearSignupFields = () => {
    setFirstName(""); setLastName(""); setCountry("Australia");
    setEmail(""); setEmailTouched(false); setPassword(""); clearAllErrors();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#111827",
    border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    padding: "13px 14px", color: C.text, fontSize: 15,
    fontFamily: "'Space Grotesk', sans-serif",
    outline: "none",
  };

  const dropdownStyle: React.CSSProperties = {
    ...inputStyle, cursor: "pointer", appearance: "none" as any,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236B7FA3' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36,
  };

  const EyeIcon = ({ visible }: { visible: boolean }) => visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  // Amber colour for "not an error, just a redirect" messages
  const AMBER = "#F59E0B";
  const AMBER_DIM = "#F59E0B18";

  // Banner message content
  const renderBanner = () => {
    if (!bannerError) return null;
    let msg = "";
    let showResend = false;
    if (bannerError === "unverified") {
      msg = "Please verify your email before logging in. Check your inbox for the verification email.";
      showResend = true;
    } else if (bannerError === "rate_limit") {
      msg = "Too many attempts. Please wait a few minutes before trying again.";
    } else if (bannerError === "network") {
      msg = "Connection issue. Please check your internet and try again.";
    } else {
      msg = bannerError;
    }
    return (
      <div style={{ marginBottom: 14, padding: "12px 14px", background: C.negDim, border: `1px solid ${C.neg}44`, borderRadius: 10, fontSize: 13, color: C.neg, lineHeight: 1.6 }}>
        {msg}
        {showResend && (
          <div style={{ marginTop: 8 }}>
            {resendSent ? (
              <span style={{ color: C.accent, fontWeight: 600, fontSize: 12 }}>Verification email sent!</span>
            ) : (
              <button
                onClick={handleResendVerification}
                disabled={resending}
                style={{ background: "none", border: "none", color: C.accent, fontWeight: 700, fontSize: 13, cursor: resending ? "not-allowed" : "pointer", padding: 0, opacity: resending ? 0.6 : 1 }}
              >
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (verified) {
    return (
      <div style={{ ...S.root, flexDirection: "column" }}>
        <div style={{ width: "100%", maxWidth: 390, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${C.accent}22`, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 12, lineHeight: 1.3 }}>
            Account created!
          </div>
          <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7, marginBottom: 8 }}>
            Check your email to verify your account before logging in.
          </div>
          <div style={{ fontSize: 13, color: C.textDim, marginBottom: 28 }}>
            Sent to <span style={{ color: C.accent, fontWeight: 600 }}>{email}</span>
          </div>
          <button
            onClick={() => { setMode("login"); setVerified(false); clearSignupFields(); }}
            style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
          >
            Back to Login
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ ...S.root, alignItems: "flex-start", overflow: "auto" }}>
      <div style={{ width: "100%", maxWidth: 390, padding: "40px 24px 32px" }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 34, fontWeight: 800, background: `linear-gradient(90deg, #fff 0%, ${C.accent} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.1em" }}>
            MADDEX
          </div>
          <div style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
            Powered by MaddenAI
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "#111827", borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {(["login", "signup"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); clearSignupFields(); }}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
                background: mode === m ? C.accent : "transparent",
                color: mode === m ? "#fff" : C.textMuted,
                border: "none", cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {m === "login" ? "Login" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Banner errors (top of form) */}
        {renderBanner()}

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Signup-only fields ── */}
          {mode === "signup" && (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <input
                    style={{ ...inputStyle, borderColor: C.cardBorder }}
                    placeholder="First Name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    style={{ ...inputStyle, borderColor: C.cardBorder }}
                    placeholder="Last Name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <select
                  style={{ ...dropdownStyle, borderColor: C.cardBorder }}
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                >
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <input
              style={{ ...inputStyle, borderColor: (emailError || emailFieldError) ? (emailFieldError === "exists" ? AMBER : C.neg) : C.cardBorder }}
              placeholder="Email"
              type="email"
              autoCapitalize="none"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                setEmailFieldError(null);          // clear server error on retype
                if (emailTouched && emailRegex.test(e.target.value.trim())) setEmailTouched(false);
              }}
              onBlur={() => setEmailTouched(true)}
            />
            {/* Format error (red) */}
            {(emailError || emailFieldError === "format") && (
              <div style={{ fontSize: 12, color: C.neg, marginTop: 5, paddingLeft: 2 }}>
                Please enter a valid email address.
              </div>
            )}
            {/* Email already exists (amber) */}
            {emailFieldError === "exists" && (
              <div style={{ fontSize: 12, color: AMBER, marginTop: 5, paddingLeft: 2, lineHeight: 1.5 }}>
                An account with this email already exists.{" "}
                <button
                  onClick={switchToLogin}
                  style={{ background: "none", border: "none", color: AMBER, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  Log in instead
                </button>
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <div style={{ position: "relative" }}>
              <input
                style={{
                  ...inputStyle,
                  borderColor: (passwordTooShort || pwFieldError) ? C.neg : C.cardBorder,
                  paddingRight: 48,
                }}
                placeholder={mode === "signup" ? "Password (min. 8 characters)" : "Password"}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setPwFieldError(null);           // clear server error on retype
                }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: showPassword ? C.accent : C.textMuted,
                  padding: "2px 4px", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "color 0.15s",
                }}
                tabIndex={-1}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>

            {/* Weak password (typing, before submit) */}
            {passwordTooShort && !pwFieldError && (
              <div style={{ fontSize: 12, color: C.neg, marginTop: 5, paddingLeft: 2 }}>
                Password must be at least 8 characters.
              </div>
            )}
            {/* Wrong password (from server) */}
            {pwFieldError === "wrong" && (
              <div style={{ fontSize: 12, color: C.neg, marginTop: 5, paddingLeft: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>Incorrect password. Please try again.</span>
                <button style={{ background: "none", border: "none", color: C.accent, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>
                  Forgot password?
                </button>
              </div>
            )}
            {/* Forgot password link (login mode, no error) */}
            {mode === "login" && !pwFieldError && (
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <button style={{ fontSize: 13, color: C.accent, background: "none", border: "none", cursor: "pointer" }}>
                  Forgot password?
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !signupReady}
          style={{
            width: "100%", marginTop: 20, padding: "15px 0", borderRadius: 12,
            background: loading || !signupReady ? C.cardBorder : C.accent,
            color: !signupReady ? C.textDim : "#fff",
            fontWeight: 700, fontSize: 15, border: "none",
            cursor: loading || !signupReady ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "background 0.2s, color 0.2s",
          }}
        >
          {loading && (
            <div style={{ width: 18, height: 18, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          )}
          {mode === "login" ? "Login" : "Create Account"}
        </button>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
          General information only. Not personal financial advice.<br />Madden Group holds no AFSL.
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
// ACCOUNT SCREEN
// ============================================================
function AcctSpinner() {
  return <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />;
}
function AcctPwToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} tabIndex={-1} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: show ? C.accent : C.textMuted, display: "flex", alignItems: "center", padding: "2px 4px", transition: "color 0.15s" }}>
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

function AccountScreen({ user, onSignOut, onProfileUpdate }: { user: any; onSignOut: () => void; onProfileUpdate?: (p: any) => void }) {
  const [profile, setProfile]   = useState<any>(null);
  const [draft, setDraft]       = useState<any>(null);
  const [editing, setEditing]   = useState(false);

  // avatar upload
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError,     setAvatarError]     = useState<string|null>(null);

  // profile save
  const [profSaving, setProfSaving]   = useState(false);
  const [profStatus, setProfStatus]   = useState<"idle"|"saved"|"error">("idle");
  const [profError,  setProfError]    = useState<string|null>(null);

  // email change
  const [newEmail,    setNewEmail]    = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle"|"sent"|"error">("idle");
  const [emailError,  setEmailError]  = useState<string|null>(null);

  // password change
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [showCfPw,   setShowCfPw]   = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwStatus,   setPwStatus]   = useState<"idle"|"success"|"error">("idle");
  const [pwError,    setPwError]    = useState<string|null>(null);

  const [signingOut, setSigningOut] = useState(false);

  // close account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStatus, setDeleteStatus]       = useState<"idle"|"deleting"|"error">("idle");
  const [deleteError, setDeleteError]         = useState<string|null>(null);

  const DEFAULTS = {
    first_name: "", last_name: "",
    full_name: user?.full_name || "",
    country: "Australia", knowledge_level: "Beginner",
    risk_profile: "Moderate", income_bracket: "Under $50k",
    goals: "Wealth building", life_stage: "Working",
    newsletter_enabled: false, subscription_tier: "Trial",
  };

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.id).then(p => {
      const merged = p ? { ...DEFAULTS, ...p } : DEFAULTS;
      setProfile(merged);
      setDraft(merged);
    });
  }, [user]);

  // ── Save profile (personal + financial) ──────────────────────
  const handleProfileSave = async () => {
    setProfSaving(true); setProfStatus("idle"); setProfError(null);
    try {
      const fn   = (draft.first_name || "").trim();
      const ln   = (draft.last_name  || "").trim();
      const full = fn && ln ? `${fn} ${ln}` : (draft.full_name || "");

      await updateUserProfile(user.id, {
        first_name: fn, last_name: ln, full_name: full,
        country: draft.country, knowledge_level: draft.knowledge_level,
        risk_profile: draft.risk_profile, income_bracket: draft.income_bracket,
        goals: draft.goals, life_stage: draft.life_stage,
        newsletter_enabled: draft.newsletter_enabled,
      });

      const updated = { ...draft, first_name: fn, last_name: ln, full_name: full };
      setProfile(updated); setDraft(updated);
      onProfileUpdate?.(updated);
      setEditing(false);
      setProfStatus("saved");
      setTimeout(() => setProfStatus("idle"), 2500);
    } catch (e: any) {
      setProfError(e.message || "Failed to save. Please try again.");
      setProfStatus("error");
    } finally { setProfSaving(false); }
  };

  // ── Avatar upload ─────────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Image must be under 5 MB"); return; }
    setAvatarUploading(true); setAvatarError(null);
    try {
      const url = await uploadAvatar(user.id, file);
      const updated = { ...(profile || {}), avatar_url: url };
      setProfile(updated); setDraft(updated);
      onProfileUpdate?.(updated);
    } catch (e: any) {
      setAvatarError(
        e.message?.includes("bucket") || e.message?.includes("not found")
          ? "Storage not set up yet — create an 'avatars' bucket in your Supabase dashboard."
          : (e.message || "Upload failed. Please try again.")
      );
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Email change ──────────────────────────────────────────────
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const handleEmailChange = async () => {
    if (!emailValid || !user) return;
    setEmailSaving(true); setEmailStatus("idle"); setEmailError(null);
    try {
      await updateEmail(user.id, newEmail.trim());
      setEmailStatus("sent");
    } catch (e: any) {
      setEmailError(e.message || "Failed to update email."); setEmailStatus("error");
    } finally { setEmailSaving(false); }
  };

  // ── Password change ───────────────────────────────────────────
  const pwReady = newPw.length >= 8 && newPw === confirmPw;
  const handlePasswordChange = async () => {
    if (!pwReady || !user) return;
    setPwSaving(true); setPwStatus("idle"); setPwError(null);
    try {
      await updatePassword(user.id, newPw);
      setPwStatus("success"); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwStatus("idle"), 3000);
    } catch (e: any) {
      setPwError(e.message || "Failed to update password."); setPwStatus("error");
    } finally { setPwSaving(false); }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); } catch { /* */ }
    onSignOut();
  };

  const handleDeleteAccount = async () => {
    setDeleteStatus("deleting");
    setDeleteError(null);
    try {
      await deleteAccount(user.id);
      onSignOut();
    } catch (e: any) {
      setDeleteStatus("error");
      setDeleteError(
        e.message ||
        "Something went wrong. Please contact support@maddex.com.au to complete your account closure."
      );
    }
  };

  const tierColors: Record<string, string> = { Trial: C.textMuted, Core: C.accent, Prime: C.gold, Apex: "#A78BFA" };

  const inputSt: React.CSSProperties = {
    width: "100%", background: "#0a1120", border: `1px solid ${C.cardBorder}`,
    borderRadius: 10, padding: "11px 12px", color: C.text, fontSize: 14,
    fontFamily: "'Space Grotesk', sans-serif", outline: "none",
  };
  const dimSt: React.CSSProperties = { ...inputSt, color: C.textMuted, background: "#080f1c" };
  const selSt: React.CSSProperties = {
    ...inputSt, cursor: "pointer", appearance: "none" as any,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236B7FA3' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36,
  };

  const FL = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><div style={{ ...S.label, marginBottom: 6 }}>{label}</div>{children}</div>
  );

  if (!profile) return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${C.cardBorder}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    </div>
  );

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.full_name || "Maddex User";

  return (
    <div style={{ padding: "0 16px" }}>

      {/* ── Header ── */}
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleAvatarUpload}
      />
      <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
        {/* Tappable avatar circle */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          title="Tap to change photo"
          style={{ position: "relative", width: 56, height: 56, borderRadius: "50%", background: profile.avatar_url ? "transparent" : C.accentDim, border: `2px solid ${profile.avatar_url ? C.cardBorder : C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", cursor: "pointer", padding: 0 }}
        >
          {profile.avatar_url && !avatarUploading ? (
            <img src={profile.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : avatarUploading ? (
            <div style={{ width: 20, height: 20, border: `2px solid ${C.accentDim}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          ) : (
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: C.accent }}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
          {/* camera overlay hint */}
          {!avatarUploading && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 18, background: "rgba(0,0,0,0.52)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
          {avatarError && (
            <div style={{ fontSize: 11, color: C.neg, marginTop: 4, lineHeight: 1.4 }}>{avatarError}</div>
          )}
        </div>
        <div style={{ ...S.badge, background: (tierColors[profile.subscription_tier] || C.textMuted) + "22", color: tierColors[profile.subscription_tier] || C.textMuted, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {profile.subscription_tier || "Trial"}
        </div>
      </Card>

      {/* ── Personal Details ── */}
      <SectionHeader title="Personal Details" action={
        !editing ? (
          <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>Edit</button>
        ) : undefined
      } />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FL label="First Name">
                <input style={editing ? inputSt : dimSt} readOnly={!editing}
                  value={editing ? (draft.first_name || "") : (profile.first_name || profile.full_name?.split(" ")[0] || "")}
                  onChange={e => setDraft((d: any) => ({ ...d, first_name: e.target.value }))} />
              </FL>
            </div>
            <div style={{ flex: 1 }}>
              <FL label="Last Name">
                <input style={editing ? inputSt : dimSt} readOnly={!editing}
                  value={editing ? (draft.last_name || "") : (profile.last_name || profile.full_name?.split(" ").slice(1).join(" ") || "")}
                  onChange={e => setDraft((d: any) => ({ ...d, last_name: e.target.value }))} />
              </FL>
            </div>
          </div>
          <FL label="Country">
            <select style={editing ? selSt : { ...selSt, color: C.textMuted, background: "#080f1c" }}
              disabled={!editing}
              value={editing ? (draft.country || "Australia") : (profile.country || "Australia")}
              onChange={e => setDraft((d: any) => ({ ...d, country: e.target.value }))}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FL>
          {profStatus === "error" && profError && (
            <div style={{ fontSize: 12, color: C.neg, padding: "8px 10px", background: C.negDim, borderRadius: 8 }}>{profError}</div>
          )}
          {editing && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setDraft(profile); setEditing(false); setProfStatus("idle"); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontWeight: 600, fontSize: 14, background: "transparent", color: C.textMuted, border: `1px solid ${C.cardBorder}`, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleProfileSave} disabled={profSaving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: profSaving ? "not-allowed" : "pointer", background: profStatus === "saved" ? C.pos : C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.3s" }}>
                {profSaving && <AcctSpinner />}
                {profStatus === "saved" ? "Saved ✓" : profSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
          {profStatus === "saved" && !editing && (
            <div style={{ fontSize: 12, color: C.pos, textAlign: "center", fontWeight: 600 }}>Saved ✓</div>
          )}
        </div>
      </Card>

      {/* ── Financial Profile ── */}
      <SectionHeader title="Financial Profile" />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14, lineHeight: 1.5 }}>
          Powers your MaddenAI personalisation. Changes take effect immediately in chat.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FL label="Investment Knowledge">
            <select style={selSt} value={draft?.knowledge_level || "Beginner"} onChange={e => setDraft((d: any) => ({ ...d, knowledge_level: e.target.value }))}>
              {["Prefer not to say", "Beginner", "Intermediate", "Advanced"].map(v => <option key={v}>{v}</option>)}
            </select>
          </FL>
          <FL label="Risk Profile">
            <select style={selSt} value={draft?.risk_profile || "Moderate"} onChange={e => setDraft((d: any) => ({ ...d, risk_profile: e.target.value }))}>
              {["Prefer not to say", "Conservative", "Moderate", "Growth", "Aggressive"].map(v => <option key={v}>{v}</option>)}
            </select>
          </FL>
          <FL label="Income Bracket">
            <select style={selSt} value={draft?.income_bracket || "Under $50k"} onChange={e => setDraft((d: any) => ({ ...d, income_bracket: e.target.value }))}>
              {["Prefer not to say", "Under $50k", "$50k – $80k", "$80k – $120k", "$120k – $180k", "$180k+"].map(v => <option key={v}>{v}</option>)}
            </select>
          </FL>
          <FL label="Primary Goal">
            <select style={selSt} value={draft?.goals || "Wealth building"} onChange={e => setDraft((d: any) => ({ ...d, goals: e.target.value }))}>
              {["Prefer not to say", "Wealth building", "Retirement", "Income / Dividends", "Speculation", "Capital preservation", "Education"].map(v => <option key={v}>{v}</option>)}
            </select>
          </FL>
          <FL label="Life Stage">
            <select style={selSt} value={draft?.life_stage || "Working"} onChange={e => setDraft((d: any) => ({ ...d, life_stage: e.target.value }))}>
              {["Prefer not to say", "Student", "Early career", "Working", "Mid-career", "Pre-retirement", "Retired"].map(v => <option key={v}>{v}</option>)}
            </select>
          </FL>
          <button onClick={handleProfileSave} disabled={profSaving}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: profSaving ? "not-allowed" : "pointer", background: profStatus === "saved" ? C.pos : C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.3s" }}>
            {profSaving && <AcctSpinner />}
            {profStatus === "saved" ? "Saved ✓" : profSaving ? "Saving…" : "Save Financial Profile"}
          </button>
        </div>
      </Card>

      {/* ── Preferences ── */}
      <SectionHeader title="Preferences" />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Newsletter</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Weekly AI market insights</div>
          </div>
          <button onClick={() => setDraft((d: any) => ({ ...d, newsletter_enabled: !d?.newsletter_enabled }))}
            style={{ width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: draft?.newsletter_enabled ? C.accent : C.cardBorder, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 3, left: draft?.newsletter_enabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </button>
        </div>
      </Card>

      {/* ── Change Email ── */}
      <SectionHeader title="Change Email" />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>Current: <span style={{ color: C.text }}>{user?.email}</span></div>
          <FL label="New Email Address">
            <input style={{ ...inputSt, borderColor: emailStatus === "error" ? C.neg : C.cardBorder }}
              placeholder="new@email.com" type="email" autoCapitalize="none"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailStatus("idle"); setEmailError(null); }} />
          </FL>
          {emailStatus === "sent" && (
            <div style={{ fontSize: 13, color: C.pos, padding: "10px 12px", background: C.posDim, borderRadius: 8, lineHeight: 1.6 }}>
              Verification email sent to <strong>{newEmail}</strong>. Click the link to confirm your new email address.
            </div>
          )}
          {emailStatus === "error" && emailError && (
            <div style={{ fontSize: 12, color: C.neg, padding: "8px 10px", background: C.negDim, borderRadius: 8 }}>{emailError}</div>
          )}
          <button onClick={handleEmailChange} disabled={!emailValid || emailSaving}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: !emailValid || emailSaving ? "not-allowed" : "pointer", background: !emailValid ? C.cardBorder : C.accent, color: !emailValid ? C.textDim : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}>
            {emailSaving && <AcctSpinner />}
            Send Verification Email
          </button>
        </div>
      </Card>

      {/* ── Change Password ── */}
      <SectionHeader title="Change Password" />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FL label="New Password">
            <div style={{ position: "relative" }}>
              <input style={{ ...inputSt, paddingRight: 44, borderColor: newPw.length > 0 && newPw.length < 8 ? C.neg : C.cardBorder }}
                placeholder="Minimum 8 characters" type={showNewPw ? "text" : "password"}
                value={newPw} onChange={e => { setNewPw(e.target.value); setPwStatus("idle"); setPwError(null); }} />
              <AcctPwToggle show={showNewPw} onToggle={() => setShowNewPw(v => !v)} />
            </div>
            {newPw.length > 0 && newPw.length < 8 && (
              <div style={{ fontSize: 11, color: C.neg, marginTop: 3, paddingLeft: 2 }}>Password must be at least 8 characters</div>
            )}
          </FL>
          <FL label="Confirm New Password">
            <div style={{ position: "relative" }}>
              <input style={{ ...inputSt, paddingRight: 44, borderColor: confirmPw.length > 0 && confirmPw !== newPw ? C.neg : C.cardBorder }}
                placeholder="Re-enter new password" type={showCfPw ? "text" : "password"}
                value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwStatus("idle"); setPwError(null); }} />
              <AcctPwToggle show={showCfPw} onToggle={() => setShowCfPw(v => !v)} />
            </div>
            {confirmPw.length > 0 && confirmPw !== newPw && (
              <div style={{ fontSize: 11, color: C.neg, marginTop: 3, paddingLeft: 2 }}>Passwords do not match</div>
            )}
          </FL>
          {pwStatus === "success" && (
            <div style={{ fontSize: 13, color: C.pos, padding: "10px 12px", background: C.posDim, borderRadius: 8 }}>Password updated successfully</div>
          )}
          {pwStatus === "error" && pwError && (
            <div style={{ fontSize: 12, color: C.neg, padding: "8px 10px", background: C.negDim, borderRadius: 8 }}>{pwError}</div>
          )}
          <button onClick={handlePasswordChange} disabled={!pwReady || pwSaving}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: !pwReady || pwSaving ? "not-allowed" : "pointer", background: !pwReady ? C.cardBorder : C.accent, color: !pwReady ? C.textDim : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}>
            {pwSaving && <AcctSpinner />}
            Update Password
          </button>
        </div>
      </Card>

      {/* ── Sign Out ── */}
      <button onClick={handleSignOut} disabled={signingOut}
        style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: C.negDim, color: C.neg, fontWeight: 700, fontSize: 15, border: `1px solid ${C.neg}44`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
        {signingOut && <div style={{ width: 16, height: 16, border: `2px solid ${C.neg}44`, borderTopColor: C.neg, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
        Sign Out
      </button>

      {/* ── Close Account ── */}
      {(() => {
        const tier = (profile.subscription_tier || "").toLowerCase();
        const isPaid = ["core", "prime", "apex"].includes(tier);

        if (isPaid) {
          return (
            <div style={{ borderRadius: 10, background: C.negDim, border: `1px solid ${C.neg}44`, padding: "14px 16px", marginBottom: 8 }}>
              <p style={{ fontSize: 13, color: C.neg, lineHeight: 1.6, margin: 0, marginBottom: 10 }}>
                You have an active Maddex subscription. To close your account, please cancel your
                subscription first and wait until the end of your current billing period. Once your
                subscription has expired, you can return here to close your account.
              </p>
              <button style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "transparent", border: `1px solid ${C.neg}66`, color: C.neg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Manage Subscription
              </button>
            </div>
          );
        }

        return (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteStatus("idle"); setDeleteError(null); }}
              style={{ background: "none", border: "none", color: "#B45252", fontSize: 12, cursor: "pointer", padding: "4px 8px", opacity: 0.75 }}
            >
              Close Account
            </button>
          </div>
        );
      })()}

      <Disclaimer />

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}
          onClick={(e) => { if (e.target === e.currentTarget && deleteStatus !== "deleting") setShowDeleteModal(false); }}
        >
          <div style={{ width: "100%", maxWidth: 380, background: "#111B2E", borderRadius: 16, border: `1px solid ${C.cardBorder}`, padding: "28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            {/* Icon */}
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#3A1A1A", border: "1px solid #B4525244", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B45252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>

            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, color: C.text, textAlign: "center", margin: "0 0 12px" }}>
              Close your account?
            </h2>
            <p style={{ fontSize: 14, color: C.textMuted, textAlign: "center", lineHeight: 1.65, margin: "0 0 24px" }}>
              This will permanently delete your Maddex account, including your portfolio, watchlist, and all saved data. This cannot be undone.
            </p>

            {deleteStatus === "error" && deleteError && (
              <div style={{ borderRadius: 8, background: C.negDim, border: `1px solid ${C.neg}44`, padding: "10px 14px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: C.neg, margin: 0, lineHeight: 1.5 }}>{deleteError}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              {/* Cancel */}
              <button
                onClick={() => { if (deleteStatus !== "deleting") setShowDeleteModal(false); }}
                disabled={deleteStatus === "deleting"}
                style={{ flex: 1, padding: "13px 0", borderRadius: 10, background: "#1C2B42", border: `1px solid ${C.cardBorder}`, color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: deleteStatus === "deleting" ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              {/* Confirm Deletion */}
              <button
                onClick={handleDeleteAccount}
                disabled={deleteStatus === "deleting"}
                style={{ flex: 1, padding: "13px 0", borderRadius: 10, background: deleteStatus === "deleting" ? "#7A2222" : "#C0392B", border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: deleteStatus === "deleting" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {deleteStatus === "deleting" ? (
                  <>
                    <div style={{ width: 14, height: 14, border: "2px solid #fff4", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Deleting…
                  </>
                ) : (
                  "Confirm Deletion"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function MaddexApp() {
  const [tab, setTab]             = useState("home");
  const [marketFocus, setMarketFocus] = useState<"AUS" | "US">("AUS");
  const [marketData, setMarketData]   = useState<any>(null);
  const [session, setSession]         = useState<any>(undefined);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [sharedPortfolio, setSharedPortfolio]       = useState<any[]>([]);
  const [sharedExtraPrices, setSharedExtraPrices]   = useState<Record<string,{price:number,change24h:number}>>({});
  // Pre-loaded query that ChatScreen auto-sends when navigated to via a contextual button
  const [chatSeed, setChatSeed] = useState<string | null>(null);

  const navigateToChat = (initialMessage?: string) => {
    if (initialMessage) setChatSeed(initialMessage);
    setTab("chat");
  };

  // ── Auth bootstrap ─────────────────────────────────────────
  // Merges DB profile with auth user_metadata so first_name is always available
  // even for accounts created before the DB schema was set up.
  const buildProfile = (dbProfile: any, authUser: any) => {
    const base = dbProfile || {};
    return {
      ...base,
      first_name: base.first_name || authUser?.first_name || null,
      last_name:  base.last_name  || authUser?.last_name  || null,
      full_name:  base.full_name  || authUser?.full_name  || null,
    };
  };

  useEffect(() => {
    const initAuth = async () => {
      const s = await getSession();
      if (s?.user) {
        setSession(s);
        getUserProfile(s.user.id).then(p => setUserProfile(buildProfile(p, s.user)));
        getPortfolio(s.user.id).then(p => setSharedPortfolio(p || [])).catch(() => {});
      } else {
        setSession(null);
      }
      setAuthLoading(false);
    };
    initAuth();

    const sub = onAuthChange(s => {
      setSession(s);
      setAuthLoading(false);
      if (s?.user) {
        getUserProfile(s.user.id).then(p => setUserProfile(buildProfile(p, s.user)));
        getPortfolio(s.user.id).then(p => setSharedPortfolio(p || [])).catch(() => {});
      } else {
        setUserProfile(null);
        setSharedPortfolio([]);
      }
    });
    return () => sub?.unsubscribe?.();
  }, []);

  // ── Extra prices for holdings not in standard marketData ───
  useEffect(() => {
    if (sharedPortfolio.length === 0 || !marketData) return;
    fetchPricesForHoldings(sharedPortfolio, marketData).then(ep => {
      if (Object.keys(ep).length > 0) setSharedExtraPrices(prev => ({ ...prev, ...ep }));
    });
  }, [sharedPortfolio, marketData]);

  // ── Live market data ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAllMarketData();
        const enriched = {
          ...data,
          marketSentimentScore: calculateMarketSentimentScore(data),
          cryptoMomentumIndex:  calculateCryptoMomentumIndex(data),
          asxSentiment:         calculateASXSentiment(data),
          sectorStrength:       calculateSectorStrength(data),
        };
        setMarketData(enriched);
      } catch {
        // keep null — screens fall back to mock data
      }
    };
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: "portfolio", icon: "◈", label: "Portfolio" },
    { id: "trends",    icon: "↗", label: "Trends"    },
    { id: "home",      icon: "⊞", label: "Home"      },
    { id: "news",      icon: "◎", label: "News"       },
    { id: "chat",      icon: "✦", label: "AI Chat"    },
  ];

  const mkt = computeMarketStatus(marketFocus, marketData?.marketStatus);
  const user = session?.user ?? null;

  // ── Auth loading splash ─────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ ...S.root, flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, background: `linear-gradient(90deg, #fff 0%, ${C.accent} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.1em" }}>MADDEX</div>
        <div style={{ width: 28, height: 28, border: `2px solid ${C.cardBorder}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Not authenticated ───────────────────────────────────────
  if (!session) {
    return <LoginScreen onLogin={s => setSession(s)} />;
  }

  return (
    <div style={S.root}>
      <div style={S.appShell}>
        {/* GLOBAL BRAND HEADER */}
        <div style={S.brandBar}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={S.brandName}>MADDEX</div>
            <div style={{ marginTop: 2 }}>
              <div style={S.brandSub}>Powered by MaddenAI</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <button
              onClick={() => setMarketFocus(f => f === "AUS" ? "US" : "AUS")}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <div style={{ ...S.badge, background: mkt.color + "22", color: mkt.color, fontSize: 10 }}>
                {mkt.dot} {mkt.label}
              </div>
            </button>
            <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.04em" }}>
              tap to switch {marketFocus === "AUS" ? "→ US" : "→ AUS"}
            </div>
          </div>
        </div>

        {/* SCREEN */}
        <div style={S.screenArea}>
          {tab === "home"      && <HomeScreen      onChat={navigateToChat} marketData={marketData} userProfile={userProfile} onAccountOpen={() => setShowAccount(true)} portfolio={sharedPortfolio} extraPrices={sharedExtraPrices} />}
          {tab === "portfolio" && <PortfolioScreen onChat={navigateToChat} marketData={marketData} user={user} onPortfolioUpdate={p => setSharedPortfolio(p || [])} />}
          {tab === "trends"    && <TrendsScreen    onChat={navigateToChat} marketData={marketData} />}
          {tab === "news"      && <NewsScreen      onChat={navigateToChat} userProfile={userProfile} />}
          {tab === "chat"      && <ChatScreen      marketData={marketData} user={user} userProfile={userProfile} initialMessage={chatSeed} onMessageConsumed={() => setChatSeed(null)} />}
        </div>

        {/* ACCOUNT SLIDE-IN PANEL */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 200,
          pointerEvents: showAccount ? "auto" : "none",
        }}>
          {/* backdrop */}
          <div
            onClick={() => setShowAccount(false)}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.55)",
              opacity: showAccount ? 1 : 0,
              transition: "opacity 0.28s ease",
            }}
          />
          {/* panel */}
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0,
            width: "92%", maxWidth: 420,
            background: C.bg,
            transform: showAccount ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.3s cubic-bezier(0.32,0,0.18,1)",
            display: "flex", flexDirection: "column",
            overflowY: "auto",
            borderLeft: `1px solid ${C.cardBorder}`,
          }}>
            {/* close row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 0", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "0.04em" }}>Account</div>
              <button
                onClick={() => setShowAccount(false)}
                style={{ width: 32, height: 32, borderRadius: "50%", background: C.cardBorder, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 16 }}
              >✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 0 24px" }}>
              <AccountScreen
                user={user}
                onSignOut={() => { setShowAccount(false); setSession(null); setUserProfile(null); }}
                onProfileUpdate={p => setUserProfile(p)}
              />
            </div>
          </div>
        </div>

        {/* BOTTOM NAV */}
        <nav style={S.nav}>
          {navItems.map(t => (
            <button
              key={t.id}
              style={{
                ...S.navBtn,
                ...(tab === t.id ? S.navBtnActive : {}),
                ...(t.id === "home" ? S.navBtnHome : {}),
                ...(t.id === "home" && tab === t.id ? S.navBtnHomeActive : {}),
              }}
              onClick={() => setTab(t.id)}
            >
              <span style={{ ...S.navIcon, ...(t.id === "home" ? S.navIconHome : {}) }}>{t.icon}</span>
              <span style={S.navLabel}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; background: ${C.bg}; font-family: 'Space Grotesk', sans-serif; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.cardBorder}; border-radius: 2px; }
        button { font-family: 'Space Grotesk', sans-serif; cursor: pointer; border: none; background: none; }
        input, textarea { font-family: 'Space Grotesk', sans-serif; }
        textarea { resize: none; }
        textarea:focus, input:focus { outline: none; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:0.4;transform:scale(0.85)} 50%{opacity:1;transform:scale(1)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px rgba(40,123,255,0.4)} 50%{box-shadow:0 0 16px rgba(40,123,255,0.8)} }
        .fade-up { animation: fadeUp 0.4s ease both; }
        .recharts-tooltip-wrapper { z-index: 10; }
      `}</style>
    </div>
  );
}

// ============================================================
// SCORE TOOLTIP — tappable ⓘ that reveals explainScore() text
// ============================================================
function ScoreTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title="What drove this score?"
        style={{
          width: 16, height: 16, borderRadius: "50%",
          background: open ? C.accent + "33" : C.cardBorder,
          border: `1px solid ${C.cardBorder}`,
          fontSize: 9, fontWeight: 700, color: open ? C.accent : C.textDim,
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, lineHeight: 1,
        }}
      >i</button>
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", top: 22, left: 0, width: 240,
            background: "#0d1624", border: `1px solid ${C.accent}33`,
            borderRadius: 10, padding: "10px 12px",
            fontSize: 11, color: C.textMuted, lineHeight: 1.6,
            zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
          }}
        >
          {text}
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); }}
              style={{ fontSize: 10, color: C.accent, cursor: "pointer", background: "none", border: "none" }}
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// AI SIGNAL BANNER — prominent AI market intelligence card
// ============================================================
function AISignalBanner({ onChat, marketData }: { onChat: () => void; marketData?: any }) {
  // v2 score object — rich multi-factor object, or fall back to mock
  const sentObj = marketData?.marketSentimentScore;
  const liveScore: number   = sentObj?.score ?? aiMarketSignal.bullPct;
  const liveSentiment: string = sentObj?.label ?? aiMarketSignal.sentiment;
  const liveConf: number    = sentObj?.confidence ?? aiMarketSignal.confidence;
  const sentColor: string   = sentObj?.color ?? (
    liveSentiment.toLowerCase().includes("bull") ? C.pos
    : liveSentiment.toLowerCase().includes("bear") ? C.neg : C.neutral
  );
  // v2 breakdown from scoreToBullBearBreakdown
  const breakdown = sentObj?.breakdown ?? scoreToBullBearBreakdown(liveScore);
  const liveTime  = marketData?.fetchedAt
    ? new Date(marketData.fetchedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
    : aiMarketSignal.updatedAt;
  // v2 snapshot text (uses marketSentimentScore.score, cryptoMomentumIndex.score internally)
  const insightText = marketData ? generateSnapshotText(marketData) : aiMarketSignal.insight;
  const explainText = sentObj ? explainScore(sentObj) : null;

  return (
    <div
      className="fade-up"
      style={{
        background: `linear-gradient(135deg, #0d1a35 0%, #111827 100%)`,
        border: `1px solid ${C.accent}44`,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        cursor: "pointer",
        position: "relative",
        overflow: "visible",
      }}
      onClick={onChat}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>MaddenAI Market Signal</span>
          {explainText && <ScoreTooltip text={explainText} />}
        </div>
        <span style={{ fontSize: 10, color: C.textDim }}>Updated {liveTime}</span>
      </div>

      {/* Main sentiment display */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 38, fontWeight: 700, color: sentColor, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {liveScore}
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: sentColor, marginTop: 2 }}>
            {liveSentiment}
          </div>
        </div>
        <div style={{ flex: 1, paddingBottom: 4 }}>
          {/* Market Signal Confidence */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={S.label}>Market Signal Confidence</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: sentColor }}>{liveScore}/100</span>
          </div>
          <div style={{ position: "relative", height: 5, background: C.cardBorder, borderRadius: 3 }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${liveScore}%`, background: sentColor, borderRadius: 3 }} />
          </div>
        </div>
      </div>

      {/* Bull / Neutral / Bear split bar — from v2 scoreToBullBearBreakdown */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", gap: 2 }}>
          <div style={{ width: `${breakdown.bullish}%`, background: C.pos,     borderRadius: "4px 0 0 4px" }} />
          <div style={{ width: `${breakdown.neutral}%`, background: C.neutral }} />
          <div style={{ width: `${breakdown.bearish}%`, background: C.neg,     borderRadius: "0 4px 4px 0" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontSize: 10, color: C.pos }}>Bull {breakdown.bullish}%</span>
          <span style={{ fontSize: 10, color: C.neutral }}>Neutral {breakdown.neutral}%</span>
          <span style={{ fontSize: 10, color: C.neg }}>Bear {breakdown.bearish}%</span>
        </div>
      </div>

      {/* Insight — generateSnapshotText when live, static fallback */}
      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 10 }}>
        {insightText}
      </div>

      {/* Tap to ask */}
      <div style={{ marginTop: 8, textAlign: "right" }}>
        <span style={{ fontSize: 11, color: C.accent }}>Ask MaddenAI →</span>
      </div>
    </div>
  );
}

// Mini inline confidence indicator
function AISentimentPill({ sentiment, conf }: { sentiment: string; conf: number }) {
  const color = sentiment.toLowerCase().includes("bull") ? C.pos
    : sentiment.toLowerCase().includes("bear") ? C.neg : C.neutral;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ ...S.badge, background: color + "22", color, fontSize: 10, padding: "2px 7px" }}>
        {sentiment}
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{conf}%</span>
    </div>
  );
}

// ============================================================
// HOME SCREEN
// ============================================================
function getAESTGreeting(): { greeting: string } {
  // Sydney AEST = UTC+10, AEDT = UTC+11 (Oct–Apr).
  // We determine local Sydney hour via Intl.DateTimeFormat.
  const now = new Date();
  const sydhour = parseInt(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hour12: false }).format(now),
    10
  );
  if (sydhour >= 5  && sydhour < 12) return { greeting: "Good morning" };
  if (sydhour >= 12 && sydhour < 17) return { greeting: "Good afternoon" };
  if (sydhour >= 17 && sydhour < 21) return { greeting: "Good evening" };
  return { greeting: "Good night" };
}

// ============================================================
// DAILY BRIEF CARD
// ============================================================
const BRIEF_CACHE_KEY = "maddex_daily_brief_v1";
const BRIEF_TTL = 4 * 60 * 60 * 1000;

function DailyBriefCard({ marketData, userProfile, onChat }: {
  marketData?: any; userProfile?: any; onChat?: (msg?: string) => void;
}) {
  const [brief, setBrief] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [collapsed, setCollapsed] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    fetch("/api/news").then(r => r.json()).then(d => setNews(d.articles ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!news.length) return;
    try {
      const cached = JSON.parse(localStorage.getItem(BRIEF_CACHE_KEY) || "null");
      if (cached?.ts && Date.now() - cached.ts < BRIEF_TTL && cached.data) {
        setBrief(cached.data);
        setStatus("done");
        return;
      }
    } catch {}
    generateBrief(news);
  }, [news]);

  useEffect(() => {
    if (status !== "loading") return;
    const t = setInterval(() => setDotCount(d => (d + 1) % 4), 450);
    return () => clearInterval(t);
  }, [status]);

  const generateBrief = async (articles: any[]) => {
    setStatus("loading");
    setBrief(null);
    try {
      const topNews = articles.slice(0, 10).map((a: any) => `• ${a.headline} (${a.source}, ${a.category})`).join("\n");
      const gainers = (marketData?.topGainers ?? []).slice(0, 3).map((g: any) => `${g.symbol} +${(g.change24h ?? 0).toFixed(1)}%`).join(", ");
      const losers  = (marketData?.topLosers  ?? []).slice(0, 2).map((l: any) => `${l.symbol} ${(l.change24h ?? 0).toFixed(1)}%`).join(", ");
      const risk  = userProfile?.risk_profile    || "Moderate";
      const level = userProfile?.knowledge_level || "Beginner";

      const prompt = `You are MaddenAI, a sharp financial analyst for everyday Australians. Based on today's live news and market data, produce a concise daily market brief.

TODAY'S TOP HEADLINES:
${topNews}
${gainers ? `\nMARKET GAINERS: ${gainers}` : ""}
${losers  ? `\nMARKET LOSERS: ${losers}`  : ""}

USER PROFILE: ${level} investor, ${risk} risk appetite, based in Australia.

Respond ONLY with valid JSON — no markdown, no preamble, no explanation:
{
  "theme": "The single biggest market story today in 10 words or less",
  "mood": "Bullish",
  "summary": "2-3 sentences. What is driving markets right now. Australian perspective where relevant.",
  "movers": [
    { "ticker": "SYMBOL", "name": "Asset name", "direction": "up", "pct": 1.2, "reason": "10-word reason" },
    { "ticker": "SYMBOL", "name": "Asset name", "direction": "down", "pct": 0.8, "reason": "10-word reason" },
    { "ticker": "SYMBOL", "name": "Asset name", "direction": "up", "pct": 2.1, "reason": "10-word reason" }
  ],
  "opportunities": [
    { "ticker": "SYMBOL", "signal": "Watch", "reason": "One sentence explaining the opportunity or risk." },
    { "ticker": "SYMBOL", "signal": "Accumulate", "reason": "One sentence explaining the opportunity or risk." }
  ],
  "watch": "The single most important event or catalyst to monitor in the next 24–48 hours."
}

mood must be one of: Bullish, Bearish, Cautious, Mixed. Use real tickers from the news. Prioritise ASX stocks where possible.`;

      const KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 900,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const rawText = data.content?.find((b: any) => b.type === "text")?.text || "";
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no json");
      const result = JSON.parse(match[0]);
      localStorage.setItem(BRIEF_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result }));
      setBrief(result);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const moodColor = !brief ? C.accent
    : brief.mood === "Bullish"  ? C.pos
    : brief.mood === "Bearish"  ? C.neg
    : brief.mood === "Cautious" ? C.neutral
    : C.accent;

  if (status === "idle" || status === "loading") {
    return (
      <Card style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>2-Min Market Brief</span>
          </div>
          <span style={{ fontSize: 10, color: C.textDim }}>Generating{".".repeat(dotCount)}</span>
        </div>
        {[85, 68, 52].map((w, i) => (
          <div key={i} style={{ height: 10, borderRadius: 5, background: C.cardBorder, width: `${w}%`, marginBottom: 8, animation: "pulse 1.8s ease-in-out infinite", animationDelay: `${i * 200}ms` }} />
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 28, borderRadius: 8, background: C.cardBorder, flex: 1, animation: "pulse 1.8s ease-in-out infinite", animationDelay: `${(i + 3) * 150}ms` }} />
          ))}
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>Brief unavailable right now</span>
          <button onClick={() => generateBrief(news)} style={{ ...S.ghostBtn, fontSize: 12, color: C.accent }}>Retry →</button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
      {/* Header — always visible, tap to collapse */}
      <div
        style={{ padding: "13px 16px 12px", cursor: "pointer", borderBottom: collapsed ? "none" : `1px solid ${C.cardBorder}` }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: moodColor, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>2-Min Market Brief</span>
            <div style={{ ...S.badge, background: moodColor + "22", color: moodColor, fontSize: 9 }}>{brief.mood}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={e => { e.stopPropagation(); generateBrief(news); }}
              title="Refresh brief"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.textDim, lineHeight: 1, padding: "2px 4px" }}
            >↺</button>
            <span style={{ fontSize: 11, color: C.textDim }}>{collapsed ? "▸" : "▾"}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{brief.theme}</div>
      </div>

      {!collapsed && (
        <div style={{ padding: "12px 16px 14px" }}>
          {/* Summary */}
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, margin: "0 0 14px" }}>{brief.summary}</p>

          {/* Top Movers */}
          {brief.movers?.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 7 }}>Top Movers</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5, marginBottom: 14 }}>
                {(brief.movers as any[]).map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", background: C.bg, borderRadius: 8 }}>
                    <div style={{ minWidth: 54, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, color: C.text }}>{m.ticker}</div>
                    <div style={{ flex: 1, fontSize: 12, color: C.textMuted, lineHeight: 1.3 }}>{m.reason}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.direction === "up" ? C.pos : C.neg, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                      {m.direction === "up" ? "▲" : "▼"} {Math.abs(Number(m.pct)).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Opportunities */}
          {brief.opportunities?.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 7 }}>Opportunities & Watch</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5, marginBottom: 14 }}>
                {(brief.opportunities as any[]).map((o, i) => {
                  const sigColor = o.signal === "Accumulate" ? C.pos : o.signal === "Avoid" ? C.neg : C.accent;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 11px", background: C.bg, borderRadius: 8 }}>
                      <div style={{ ...S.badge, background: sigColor + "22", color: sigColor, fontSize: 9, flexShrink: 0, marginTop: 1 }}>{o.signal}</div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, color: C.text }}>{o.ticker} </span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{o.reason}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Watch */}
          {brief.watch && (
            <div style={{ padding: "10px 12px", background: C.accentDim, borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.accent, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>Watch Today</div>
              <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>{brief.watch}</div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => onChat?.(`Based on today's market brief — "${brief.theme}" — give me a deeper analysis and tell me what I should specifically do with my portfolio right now.`)}
            style={{ width: "100%", padding: "11px 0", background: C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.01em" }}
          >
            Discuss with MaddenAI →
          </button>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// HOME SCREEN
// ============================================================
function HomeScreen({ onChat, marketData, userProfile, onAccountOpen, portfolio, extraPrices }: { onChat: (msg?: string) => void; marketData?: any; userProfile?: any; onAccountOpen?: () => void; portfolio?: any[]; extraPrices?: Record<string,{price:number,change24h:number}> }) {
  const [period, setPeriod] = useState("1W");
  const [expandedGainerLoser, setExpandedGainerLoser] = useState<"gainer" | "loser" | null>(null);
  const [expandedRec, setExpandedRec] = useState<number | null>(null);

  // Real portfolio calculations
  const enrichedHoldings = calculatePortfolioValue(portfolio || [], marketData, extraPrices || {});
  const totalValue   = enrichedHoldings.reduce((s, h) => s + (h.totalValue ?? 0), 0);
  const hasPortfolio = totalValue > 0;

  // Live chart — anchored to real total value; falls back to mock when no portfolio
  const chartData  = hasPortfolio
    ? buildLiveChartData(totalValue, enrichedHoldings, period)
    : portfolioByPeriod[period];
  const startVal   = chartData[0].v;
  const endVal     = chartData[chartData.length - 1].v;
  const gain       = endVal - startVal;
  const gainPct    = fmtPct((gain / startVal) * 100);
  const isPos      = gain >= 0;
  const chartColor = isPos ? C.pos : C.neg;

  // Period label for the change sub-line
  const periodLabel: Record<string, string> = { "1D": "1 Day", "1W": "1 Week", "1M": "1 Month", "3M": "3 Months" };

  // Live news for Market Pulse — top 3 most relevant articles
  const [pulseNewsData, setPulseNewsData] = useState<{ articles: any[] } | null>(null);
  useEffect(() => {
    fetch("/api/news").then(r => r.json()).then(d => setPulseNewsData(d)).catch(() => {});
  }, []);

  // Score each article for homepage significance — must pass BOTH a major entity and a significant event.
  // Micro-cap / press release drivel is hard-blocked regardless of score.
  function majorMarketScore(a: any): number {
    const text = `${a.headline ?? ""} ${a.summary ?? ""}`.toLowerCase();

    // ── HARD BLOCKERS: junior miners, PR wire drivel, tiny company filings ──
    const blockers = [
      "exploration at","drilling results","near-mine","drill hole","assay results",
      "g/t au","g/t gold","globe newswire","maiden resource","inferred resource",
      "mineral resource estimate","tsxv:","tsx-v:","otc:","fra:",
      "kicks off exploration","drill program","soil sampling","geophysical survey",
      "stock picks","3 stocks","5 stocks","top stocks to buy","stocks that fall short",
      "two cheers","three reasons","why you should","should you buy",
    ];
    if (blockers.some(b => text.includes(b))) return 0;

    let score = 0;

    // ── GATE 1: Must name a major market entity (+35 first hit, +15 for second) ──
    const majorEntities = [
      // Global indices
      "asx 200","xjo","s&p 500","s&p500","nasdaq","dow jones","ftse 100","nikkei","hang seng","russell 2000",
      // Central banks & macro bodies
      "reserve bank of australia","rba ","federal reserve"," fed ","fed rate","imf ","world bank","opec","us treasury","australian treasury",
      // Mega-cap US companies that move markets
      "apple","microsoft","nvidia","google","alphabet","amazon","tesla","meta ","berkshire hathaway","warren buffett",
      "jpmorgan","goldman sachs","morgan stanley","citigroup","bank of america","blackrock","elon musk","spacex",
      // Major energy companies
      "bp plc","bp's","shell plc","chevron","exxonmobil","exxon mobil","totalenergies","woodside energy",
      // Major ASX blue-chips
      "bhp","rio tinto","commonwealth bank","cba ","westpac","anz bank","nab ","national australia bank",
      "woodside","fortescue","macquarie bank","qantas","wesfarmers","csl limited",
      // Crypto market leaders
      "bitcoin","btc ","ethereum","eth ","coinbase","binance",
      // Major commodity markets (price-focused phrases)
      "crude oil","brent crude","wti crude","oil price","gold price","iron ore price","natural gas futures","crude costs",
      // Geopolitical triggers that always move markets
      "iran war","iran sanctions","russia sanctions","opec cut","opec production",
      // Major economic releases
      "consumer price index","cpi report","gdp growth","gdp data","unemployment rate","nonfarm payrolls","jobs report","payrolls report",
    ];
    const entityHits = majorEntities.filter(e => text.includes(e));
    if (entityHits.length >= 1) score += 35;
    if (entityHits.length >= 2) score += 15;

    // ── GATE 2: Must describe a significant event (+25 first, +10 second) ──
    const bigEvents = [
      "record high","record low","all-time high","all-time low","hits record","breaks record",
      "rate cut","rate hike","cuts rates","hikes rates","raises rates","holds rates","rate decision","emergency meeting",
      "beats expectations","beat expectations","topped estimates","misses expectations","profit warning",
      "quarterly profit","quarterly earnings","annual profit","full year profit","record profit","record earnings",
      "merger","acquisition","takeover","buyout"," ipo ","stock split","share buyback",
      "bankruptcy","collapses","crisis","default",
      "surges","soars","plunges","plunge","crashes","crash","rallies","spikes","tanks","tumbles","skyrockets",
      "tariffs","sanctions","war","geopolitical",
    ];
    const eventHits = bigEvents.filter(e => text.includes(e));
    if (eventHits.length >= 1) score += 25;
    if (eventHits.length >= 2) score += 10;

    // ── BONUS signals ──
    // Percentage mentioned = something actually moved by a real number
    if (/\d+\.?\d*%/.test(text)) score += 12;
    // Dollar figure at scale = big money involved
    if (/\$\d+\s*(billion|trillion|million)/i.test(text)) score += 10;

    // Tier 1 source (AFR, Bloomberg, Reuters, FT) gives a boost
    if ((a.sourceTier ?? 3) === 1) score += 10;

    return score;
  }

  const pulseArticles = (pulseNewsData?.articles ?? [])
    .map((a: any) => ({ ...a, _mms: majorMarketScore(a) }))
    .filter((a: any) => a._mms >= 45 || a.impactScore >= 86)
    .sort((a: any, b: any) => b._mms - a._mms)
    .slice(0, 4);

  // Top gainer / loser — only live assets with real prices (no unlisted / no-price)
  const liveHoldings  = enrichedHoldings.filter(h => h.livePrice != null && h.change24h !== 0);
  const sortedByChange = [...liveHoldings].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const topGainer = sortedByChange.length > 0 ? sortedByChange[0] : null;
  const topLoser  = sortedByChange.length > 1 ? sortedByChange[sortedByChange.length - 1] : null;
  const topGainerSym = topGainer ? (topGainer.asset_symbol?.replace(".AX", "") || topGainer.asset_symbol || "—") : null;
  const topLoserSym  = topLoser  ? (topLoser.asset_symbol?.replace(".AX", "")  || topLoser.asset_symbol  || "—") : null;

  const firstName = userProfile?.first_name || userProfile?.full_name?.split(" ")[0] || "";
  const { greeting } = getAESTGreeting();

  // Compute avatar initials from profile — empty string when not yet loaded
  const initials = (() => {
    const fn = (userProfile?.first_name || "").trim();
    const ln = (userProfile?.last_name  || "").trim();
    if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
    if (fn)       return fn[0].toUpperCase();
    const full = (userProfile?.full_name || "").trim();
    const parts = full.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return "";   // no fallback character — show empty circle while loading
  })();

  const avatarUrl = userProfile?.avatar_url || null;

  const avatarBtn = onAccountOpen ? (
    <button
      onClick={onAccountOpen}
      title="Account"
      style={{
        width: 36, height: 36, borderRadius: "50%",
        background: avatarUrl ? "transparent" : C.accentDim,
        border: `1.5px solid ${avatarUrl ? C.cardBorder : C.accent + "44"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
        color: C.accent, cursor: "pointer", letterSpacing: "0.04em",
        flexShrink: 0, overflow: "hidden", padding: 0,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Profile"
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }}
        />
      ) : initials}
    </button>
  ) : undefined;

  // Build greeting title — passes a styled ReactNode so it sits lighter in the header
  const greetingTitle = firstName ? (
    <span style={{ fontWeight: 300, fontSize: 17, color: C.textMuted, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.01em" }}>
      {greeting}, {firstName}
    </span>
  ) : "Daily Snapshot";

  return (
    <Screen
      title={greetingTitle}
      action={avatarBtn}
    >
      {/* Daily Snapshot heading — full-size, same styling as other screen titles */}
      <div style={{ ...S.screenTitle, marginBottom: 14 }}>Daily Snapshot</div>

      {/* AI SIGNAL BANNER */}
      <AISignalBanner onChat={onChat} marketData={marketData} />

      {/* DAILY BRIEF CARD */}
      <DailyBriefCard marketData={marketData} userProfile={userProfile} onChat={onChat} />

      {/* PORTFOLIO CARD WITH INTERACTIVE AREA CHART */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={S.label}>Total Portfolio</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>
              {hasPortfolio ? `$${fmt$(totalValue)}` : "—"}
            </div>
            {hasPortfolio && (
              <div style={{ color: isPos ? C.pos : C.neg, fontSize: 13, fontWeight: 500, marginTop: 2 }}>
                {isPos ? "▲" : "▼"} {isPos ? "+" : ""}${fmt$(Math.abs(gain))} ({isPos ? "+" : ""}{gainPct}%)
              </div>
            )}
          </div>
          {hasPortfolio && (
            <div style={{ ...S.badge, background: isPos ? C.posDim : C.negDim, color: isPos ? C.pos : C.neg }}>{periodLabel[period] || period}</div>
          )}
        </div>

        {/* PERIOD SELECTOR */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, marginTop: 10 }}>
          {["1D", "1W", "1M", "3M"].map(p => (
            <button
              key={p}
              style={{
                ...S.periodBtn,
                ...(period === p ? S.periodBtnActive : {}),
              }}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="homeChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="d" hide />
            <YAxis domain={["auto", "auto"]} hide />
            <Tooltip
              contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: C.textMuted }}
              formatter={(v: any) => [`$${fmt$(Number(v))}`, "Value"]}
            />
            <Area type="monotone" dataKey="v" stroke={chartColor} strokeWidth={2} fill="url(#homeChartGrad)" dot={false} activeDot={{ r: 4, fill: chartColor }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* QUICK METRICS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          {
            label: "Holdings",
            value: hasPortfolio ? `${enrichedHoldings.length}` : "—",
            sub: "In portfolio",
            color: undefined,
            key: null,
          },
          {
            label: "Top Gainer",
            value: topGainer && topGainerSym
              ? `${topGainerSym} +${fmtPct(topGainer.change24h ?? 0)}%`
              : "Nil",
            sub: "24h · tap to expand",
            color: topGainer ? C.pos : C.textMuted,
            key: topGainer ? "gainer" : null,
          },
          {
            label: "Top Loser",
            value: topLoser && topLoserSym
              ? `${topLoserSym} -${fmtPct(Math.abs(topLoser.change24h ?? 0))}%`
              : "Nil",
            sub: "24h · tap to expand",
            color: topLoser ? C.neg : C.textMuted,
            key: topLoser ? "loser" : null,
          },
          { label: "AI Alerts", value: "2", sub: "New signals", color: undefined, key: null },
        ].map((m, i) => (
          <Card
            key={i}
            style={{ padding: "12px 14px", cursor: m.key ? "pointer" : "default" }}
            onClick={() => m.key && setExpandedGainerLoser(m.key as "gainer" | "loser")}
          >
            <div style={S.label}>{m.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: m.color || C.text, fontFamily: "'Space Grotesk', sans-serif", marginTop: 2 }}>{m.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{m.sub}</div>
          </Card>
        ))}
      </div>

      {/* AI RECOMMENDATIONS */}
      <SectionHeader title="AI Recommendations" action="See all" />
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {aiRecs.map((r, i) => (
          <Card
            key={i}
            style={{ minWidth: 140, padding: "14px", cursor: "pointer", animationDelay: `${i * 40}ms`, border: expandedRec === i ? `1px solid ${r.color}55` : undefined }}
            onClick={() => setExpandedRec(expandedRec === i ? null : i)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: C.text }}>{r.ticker}</div>
              <div style={{ ...S.badge, background: r.color + "22", color: r.color, fontSize: 10 }}>{r.signal}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", color: r.change > 0 ? C.pos : C.neg, fontSize: 12, marginBottom: 8 }}>
              <TrendLine up={r.change > 0} color={r.change > 0 ? C.pos : C.neg} />
              {Math.abs(r.change)}%
            </div>
            <div style={S.label}>AI Confidence</div>
            <div style={{ position: "relative", height: 4, background: C.cardBorder, borderRadius: 2, marginTop: 4 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${r.confidence}%`, background: r.color, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 12, color: r.color, marginTop: 4, fontWeight: 500 }}>{r.confidence}%</div>
          </Card>
        ))}
      </div>

      {/* MARKET PULSE */}
      <SectionHeader title="Market Pulse" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pulseArticles.length === 0 && [0,1,2].map(i => (
          <div key={i} style={{ background: C.card, borderRadius: 12, height: 96, animationDelay: `${i * 40}ms` }} />
        ))}
        {pulseArticles.map((n: any, i: number) => {
          const isBreaking = n.impactScore >= 75;
          const isNotable  = !isBreaking && n.impactScore >= 62;
          const accentColor = n.categoryColor ?? C.accent;
          return (
            <Card key={n.id ?? i} style={{
              padding: 0, overflow: "hidden", animationDelay: `${i * 40}ms`, position: "relative",
            }}>
              {/* Left accent strip */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accentColor, borderRadius: "12px 0 0 12px" }} />
              <div style={{ padding: "14px 15px 13px 17px" }}>
                {/* Top meta: category + age + badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: accentColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{n.category}</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>· {n.source}</span>
                  {isBreaking && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                      color: "#FF4444", background: "rgba(255,68,68,0.14)",
                      border: "1px solid rgba(255,68,68,0.35)", borderRadius: 3, padding: "1px 5px", flexShrink: 0,
                    }}>BREAKING</span>
                  )}
                  {isNotable && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                      color: "#E8A020", background: "rgba(232,160,32,0.14)",
                      border: "1px solid rgba(232,160,32,0.35)", borderRadius: 3, padding: "1px 5px", flexShrink: 0,
                    }}>NOTABLE</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 10, color: C.textMuted, whiteSpace: "nowrap", flexShrink: 0 }}>{n.ageStr}</span>
                </div>
                {/* Headline — big and bold */}
                <div style={{ fontSize: 15, color: C.text, fontWeight: 600, lineHeight: 1.45, marginBottom: n.summary ? 8 : 10 }}>
                  {decodeHtmlEntities(n.headline)}
                </div>
                {/* Summary snippet — if available */}
                {n.summary && (
                  <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, marginBottom: 10,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {decodeHtmlEntities(n.summary)}
                  </div>
                )}
                {/* Bottom row: sentiment pill */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <AISentimentPill sentiment={n.aiSentiment} conf={n.aiConf} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Disclaimer />

      {/* GAINER / LOSER EXPANDED MODAL */}
      {expandedGainerLoser && (() => {
        const isGainer = expandedGainerLoser === "gainer";
        const h = isGainer ? topGainer : topLoser;
        const sym = isGainer ? topGainerSym : topLoserSym;
        const chg = h?.change24h ?? 0;
        const price = h?.livePrice ?? 0;
        const openP = price / (1 + chg / 100);
        const color = isGainer ? C.pos : C.neg;
        const chartData = buildIntradayChart(price, chg);
        return (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 16px 32px", maxHeight: "78%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: C.text }}>{sym}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{isGainer ? "Top Gainer Today" : "Top Loser Today"} · 24h</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...S.badge, background: color + "22", color, fontSize: 12 }}>
                    {isGainer ? "+" : "-"}{fmtPct(Math.abs(chg))}%
                  </div>
                  <button onClick={() => setExpandedGainerLoser(null)} style={{ fontSize: 20, color: C.textMuted, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
                </div>
              </div>
              {/* Price stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Open",    val: `$${fmt$(openP)}` },
                  { label: "Current", val: `$${fmt$(price)}` },
                  { label: "Close",   val: price > 0 ? `$${fmt$(price * (1 + (Math.random() * 0.004 - 0.002)))}` : "—" },
                ].map(s => (
                  <div key={s.label} style={{ background: C.bg, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'Space Grotesk',sans-serif" }}>{s.val}</div>
                  </div>
                ))}
              </div>
              {/* Intraday chart */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>Today's Price</div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="glGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} width={54} tickFormatter={v => `$${v.toFixed(price < 10 ? 4 : 0)}`} />
                    <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`$${Number(v).toFixed(price < 10 ? 4 : 2)}`, sym ?? ""]} />
                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#glGrad)" dot={false} activeDot={{ r: 3, fill: color }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <button
                onClick={() => {
                  setExpandedGainerLoser(null);
                  const direction = isGainer ? `up ${fmtPct(Math.abs(chg))}%` : `down ${fmtPct(Math.abs(chg))}%`;
                  onChat(
                    `Give me a brief summary of ${sym}'s performance today. It's ${direction} in the last 24 hours. Cover what's likely driving the ${isGainer ? "gains" : "selling pressure"}, any key technical levels, and whether the momentum looks sustainable.`
                  );
                }}
                style={{ width: "100%", padding: "12px 0", background: C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Ask MaddenAI about {sym}
              </button>
            </div>
          </div>
        );
      })()}

      {/* AI REC EXPANDED MODAL */}
      {expandedRec !== null && (() => {
        const r = aiRecs[expandedRec];
        const chartData = buildIntradayChart(r.price, r.change);
        return (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 16px 32px", maxHeight: "85%", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: C.text }}>{r.ticker}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{r.name} · {r.market}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...S.badge, background: r.color + "22", color: r.color, fontSize: 12, fontWeight: 700 }}>{r.signal}</div>
                  <button onClick={() => setExpandedRec(null)} style={{ fontSize: 20, color: C.textMuted, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
                </div>
              </div>
              {/* Price stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Price",  val: r.price < 10 ? `$${r.price.toFixed(4)}` : `$${fmt$(r.price)}` },
                  { label: "Open",   val: r.price < 10 ? `$${r.open.toFixed(4)}` : `$${fmt$(r.open)}` },
                  { label: "High",   val: r.price < 10 ? `$${r.high.toFixed(4)}` : `$${fmt$(r.high)}` },
                  { label: "Low",    val: r.price < 10 ? `$${r.low.toFixed(4)}` : `$${fmt$(r.low)}` },
                ].map(s => (
                  <div key={s.label} style={{ background: C.bg, borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "'Space Grotesk',sans-serif" }}>{s.val}</div>
                  </div>
                ))}
              </div>
              {/* Intraday chart */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>Today's Price</div>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={r.color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={r.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} width={54} tickFormatter={v => r.price < 10 ? `$${v.toFixed(4)}` : `$${fmt$(v)}`} />
                    <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [r.price < 10 ? `$${Number(v).toFixed(4)}` : `$${fmt$(Number(v))}`, r.ticker]} />
                    <Area type="monotone" dataKey="v" stroke={r.color} strokeWidth={2} fill="url(#recGrad)" dot={false} activeDot={{ r: 3, fill: r.color }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* AI Confidence bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>AI Confidence</div>
                  <div style={{ fontSize: 10, color: r.color, fontWeight: 700 }}>{r.confidence}%</div>
                </div>
                <div style={{ position: "relative", height: 5, background: C.cardBorder, borderRadius: 3 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${r.confidence}%`, background: r.color, borderRadius: 3 }} />
                </div>
              </div>
              {/* AI reasoning */}
              <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>MaddenAI Reasoning</div>
                <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>{r.reason}</div>
              </div>
              <button
                onClick={() => {
                  setExpandedRec(null);
                  onChat(
                    `Give me a brief MaddenAI analysis of ${r.ticker} (${r.name}). Today it's ${r.change >= 0 ? "up" : "down"} ${Math.abs(r.change)}% and you've given it a ${r.signal} signal with ${r.confidence}% confidence. Summarise the key factors behind this call, the most important level to watch, and what would change the signal.`
                  );
                }}
                style={{ width: "100%", padding: "12px 0", background: C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Discuss {r.ticker} with MaddenAI
              </button>
            </div>
          </div>
        );
      })()}
    </Screen>
  );
}

// ============================================================
// STOCK CHART MODAL — full-screen overlay for a single holding
// ============================================================
function StockChartModal({ holding, onClose }: { holding: any; onClose: () => void }) {
  const [period, setPeriod] = useState("3M");
  const PERIODS = ["1W","1M","3M","6M","1Y"];

  const symbol   = holding.asset_symbol || holding.displaySym || "";
  const livePrice = holding.livePrice ?? 0;
  const change24h = holding.change24h ?? 0;
  const isPos     = change24h >= 0;

  // Fetch historical candles from our backend
  const [histData, setHistData] = useState<{ candles: { t: string; c: number; v: number }[]; synthetic: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!symbol) return;
    setIsLoading(true);
    setHistData(null);
    fetch(`/api/historical/${encodeURIComponent(symbol)}?period=${period}&price=${livePrice}`)
      .then(r => r.json())
      .then(d => { setHistData(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [symbol, period]);

  const candles = histData?.candles ?? [];
  const chartData = candles.map(c => ({ t: c.t.slice(5), v: c.c })); // "MM-DD" label

  const firstClose = candles[0]?.c ?? livePrice;
  const lastClose  = candles[candles.length - 1]?.c ?? livePrice;
  const periodChg     = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const periodChgAbs  = lastClose - firstClose;
  const periodPos     = periodChg >= 0;
  const chartColor    = periodPos ? C.pos : C.neg;

  const tickFmt = (v: number) => {
    if (livePrice >= 10000) return `$${Math.round(v / 1000)}k`;
    if (livePrice >= 100)   return `$${Math.round(v)}`;
    if (livePrice >= 1)     return `$${v.toFixed(2)}`;
    return `$${v.toFixed(4)}`;
  };

  const fullName = holding.asset_name || symbol;
  const displaySym = symbol.replace(".AX","");

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, background: C.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: `1px solid ${C.cardBorder}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{ ...S.ghostBtn, fontSize: 13, color: C.textMuted, padding: "4px 0" }}>← Back</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: C.text }}>{displaySym}</div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 1, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</div>
        </div>
        <div style={{ width: 50 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>
        {/* Price hero */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 32, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>
            {livePrice > 0 ? `$${livePrice >= 1 ? fmt$(livePrice) : livePrice.toFixed(4)}` : "—"}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: isPos ? C.pos : C.neg, fontWeight: 600 }}>
              {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{change24h.toFixed(2)}% today
            </span>
          </div>
          {/* Period change below */}
          {candles.length > 1 && (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {period} change:{" "}
              <span style={{ color: periodPos ? C.pos : C.neg, fontWeight: 600 }}>
                {periodPos ? "+" : ""}${Math.abs(periodChgAbs).toFixed(2)} ({periodPos ? "+" : ""}{periodChg.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Period selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {PERIODS.map(p => (
            <button key={p}
              onClick={() => setPeriod(p)}
              style={{
                ...S.chip,
                ...(period === p ? S.chipActive : {}),
                fontSize: 11, padding: "4px 10px",
              }}
            >{p}</button>
          ))}
        </div>

        {/* Chart */}
        <Card style={{ padding: "14px 8px 8px", marginBottom: 16 }}>
          {isLoading ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, border: `2px solid ${C.cardBorder}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : chartData.length > 1 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 4)} />
                  <YAxis domain={["auto","auto"]} tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} width={54} tickFormatter={tickFmt} />
                  <Tooltip
                    contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [tickFmt(Number(v)), displaySym]}
                    labelFormatter={(l) => l}
                  />
                  <ReferenceLine y={firstClose} stroke={C.cardBorder} strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="v" stroke={chartColor} strokeWidth={2} fill="url(#scGrad)" dot={false} activeDot={{ r: 3, fill: chartColor }} />
                </AreaChart>
              </ResponsiveContainer>
              {data?.synthetic && (
                <div style={{ textAlign: "center", fontSize: 9, color: C.textDim, marginTop: 4 }}>Indicative chart — live data pending</div>
              )}
            </>
          ) : (
            <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 12 }}>No chart data available</div>
          )}
        </Card>

        {/* Stats grid */}
        <SectionHeader title="Position Details" />
        <Card style={{ padding: 14, marginBottom: 16 }}>
          {[
            { label: "Shares / Units", val: holding.isUnlisted ? "—" : String(holding.shares ?? "—") },
            { label: "Current Price",  val: livePrice > 0 ? (livePrice >= 1 ? `$${fmt$(livePrice)}` : `$${livePrice.toFixed(4)}`) : "—" },
            { label: "Total Value",    val: holding.totalValue != null ? `$${fmt$(holding.totalValue)}` : "—" },
            { label: "24h Change",     val: holding.isUnlisted ? "—" : `${isPos ? "+" : ""}${change24h.toFixed(2)}%` },
            { label: "Asset Type",     val: getAssetTypeLabel(holding.asset_type) },
          ].map((s, i, arr) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{s.label}</span>
              <span style={{ fontSize: 13, color: i === 3 ? (isPos ? C.pos : C.neg) : C.text, fontWeight: 600 }}>{s.val}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// PORTFOLIO PERFORMANCE CHART — used at top of PortfolioScreen
// ============================================================
function PortfolioPerfChart({ enrichedHoldings, totalValue }: { enrichedHoldings: any[]; totalValue: number }) {
  const [period, setPeriod] = useState("1M");
  const PERIODS = ["1W","1M","3M","1Y"];

  // We fetch historical prices for every listed holding and combine them into a portfolio curve.
  const listedHoldings = useMemo(
    () => enrichedHoldings.filter(h => !h.isUnlisted && h.asset_symbol && h.livePrice > 0),
    [enrichedHoldings]
  );

  const [allCandlesData, setAllCandlesData] = useState<Array<{ symbol: string; shares: number; candles: { t: string; c: number }[]; synthetic: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [anySynthetic, setAnySynthetic] = useState(false);

  useEffect(() => {
    if (listedHoldings.length === 0) { setIsLoading(false); return; }
    setIsLoading(true);
    Promise.all(
      listedHoldings.map(h =>
        fetch(`/api/historical/${encodeURIComponent(h.asset_symbol)}?period=${period}&price=${h.livePrice}`)
          .then(r => r.json())
          .then((d: any) => ({ symbol: h.asset_symbol, shares: h.shares ?? 0, candles: d.candles ?? [], synthetic: d.synthetic }))
          .catch(() => ({ symbol: h.asset_symbol, shares: h.shares ?? 0, candles: [], synthetic: true }))
      )
    ).then(results => {
      setAllCandlesData(results);
      setAnySynthetic(results.some(r => r.synthetic));
      setIsLoading(false);
    });
  }, [listedHoldings.map(h => h.asset_symbol).join(","), period]);

  // Build combined portfolio value per date
  const combined = useMemo(() => {
    if (allCandlesData.length === 0) return [];
    const holdingCandles: Array<{ shares: number; map: Map<string, number> }> = allCandlesData
      .filter(d => d.candles.length > 0)
      .map(d => {
        const map = new Map<string, number>();
        d.candles.forEach(c => map.set(c.t, c.c));
        return { shares: d.shares, map };
      });
    if (holdingCandles.length === 0) return [];
    const dateSet = new Set<string>();
    holdingCandles.forEach(({ map }) => map.forEach((_, date) => dateSet.add(date)));
    const sortedDates = Array.from(dateSet).sort();
    return sortedDates.map(date => {
      let total = 0;
      holdingCandles.forEach(({ shares, map }) => {
        const price = map.get(date);
        if (price != null && price > 0) total += shares * price;
      });
      return { t: date.slice(5), v: parseFloat(total.toFixed(2)) };
    }).filter(p => p.v > 0);
  }, [allCandlesData, period]);

  const startV = combined[0]?.v ?? 0;
  const endV   = combined[combined.length - 1]?.v ?? totalValue;
  const chg    = startV > 0 ? ((endV - startV) / startV) * 100 : 0;
  const chgAbs = endV - startV;
  const isPos  = chg >= 0;
  const chartColor = isPos ? C.pos : C.neg;

  const tickFmt = (v: number) => v >= 1000 ? `$${Math.round(v/1000)}k` : `$${Math.round(v)}`;

  if (listedHoldings.length === 0) return null;

  return (
    <Card style={{ marginBottom: 16, padding: "14px 10px 10px" }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, paddingLeft: 4, paddingRight: 4 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 2 }}>Portfolio Performance</div>
          {combined.length > 1 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: isPos ? C.pos : C.neg }}>
              {isPos ? "+" : ""}${Math.abs(chgAbs).toFixed(0)} ({isPos ? "+" : ""}{chg.toFixed(2)}%)
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ ...S.chip, ...(period === p ? S.chipActive : {}), fontSize: 10, padding: "3px 8px" }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${C.cardBorder}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : combined.length > 1 ? (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={combined} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.floor(combined.length / 4)} />
              <YAxis domain={["auto","auto"]} tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} width={48} tickFormatter={tickFmt} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`$${fmt$(Number(v))}`, "Portfolio"]} />
              <ReferenceLine y={startV} stroke={C.cardBorder} strokeDasharray="3 3" />
              <Area type="monotone" dataKey="v" stroke={chartColor} strokeWidth={2} fill="url(#pfGrad)" dot={false} activeDot={{ r: 3, fill: chartColor }} />
            </AreaChart>
          </ResponsiveContainer>
          {anySynthetic && (
            <div style={{ textAlign: "center", fontSize: 9, color: C.textDim, marginTop: 2 }}>Indicative — live data pending</div>
          )}
        </>
      ) : (
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 12 }}>Loading chart data…</div>
      )}
    </Card>
  );
}

// ============================================================
// PORTFOLIO SCREEN
// ============================================================
function PortfolioScreen({ onChat, marketData, user, onPortfolioUpdate }: { onChat: () => void; marketData?: any; user: any; onPortfolioUpdate?: (p: any[]) => void }) {
  const [subTab, setSubTab]           = useState("holdings");
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [expandedForecast, setExpandedForecast] = useState<string | null>(null);
  const [chartHolding, setChartHolding] = useState<any | null>(null);

  // Supabase data
  const [portfolio, setPortfolio]     = useState<any[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Add-holding modal
  const [showAddModal, setShowAddModal]       = useState(false);
  const [addTarget, setAddTarget]             = useState<"holding" | "watchlist">("holding");
  const [assetMode, setAssetMode]             = useState<"listed" | "unlisted">("listed");
  const [unlistedType, setUnlistedType]       = useState<"cash" | "property" | "super" | "bonds" | "business" | "other">("cash");
  const [unlistedName, setUnlistedName]       = useState("");
  const [unlistedValue, setUnlistedValue]     = useState("");
  const [searchQuery, setSearchQuery]         = useState("");
  const [searchResults, setSearchResults]     = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset]     = useState<any>(null);
  const [sharesInput, setSharesInput]         = useState("");
  const [saving, setSaving]                   = useState(false);
  const [saveErr, setSaveErr]                 = useState("");
  const [searchingLive, setSearchingLive]     = useState(false);

  // Edit shares modal
  const [editItem, setEditItem]       = useState<any>(null);
  const [editShares, setEditShares]   = useState("");
  const [editSaving, setEditSaving]   = useState(false);

  // Long-press to delete
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [extraPrices, setExtraPrices] = useState<Record<string,{price:number,change24h:number}>>({});

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [p, w] = await Promise.all([
        getPortfolio(user.id),
        getWatchlist(user.id),
      ]);
      setPortfolio(p);
      setWatchlistItems(w);
      onPortfolioUpdate?.(p);
      // Fetch prices for any holdings not covered by the standard marketData lists
      if (p.length > 0) {
        fetchPricesForHoldings(p, marketData).then(ep => {
          if (Object.keys(ep).length > 0) setExtraPrices(prev => ({ ...prev, ...ep }));
        });
      }
    } catch { /* silent */ }
    setLoadingData(false);
  }, [user, marketData]);

  useEffect(() => { loadData(); }, [loadData]);

  // Calculate live values from Supabase portfolio
  const sc = (ch: number) => Math.round(Math.max(0, Math.min(100, 50 + ch * 8)));
  const enrichedHoldings = calculatePortfolioValue(portfolio, marketData, extraPrices).map(h => {
    const change = h.change24h ?? 0;
    const score  = sc(change);
    const isUnlisted = UNLISTED_TYPES.has(h.asset_type);
    // Unlisted assets use their human label as the display name; listed use ticker
    const displaySym = isUnlisted
      ? (h.asset_name || getAssetTypeLabel(h.asset_type))
      : (h.asset_symbol?.replace(".AX", "") || "—");
    return {
      ...h,
      displaySym,
      isUnlisted,
      change,
      sentiment:      scoreToLabel(score),
      sentimentColor: scoreToColor(score),
      bullPct:        score,
    };
  });

  // Portfolio totals
  const totalValue    = enrichedHoldings.reduce((s, h) => s + (h.totalValue ?? 0), 0);
  const totalDayChg   = enrichedHoldings.reduce((s, h) => s + (h.dayChangeAbs ?? 0), 0);
  const totalDayPct   = totalValue > 0 ? (totalDayChg / (totalValue - totalDayChg)) * 100 : 0;

  // Dynamic allocation from live holdings
  const typeGroupColors: Record<string, string> = {
    asx: C.accent, us: "#7B6BF5", crypto: C.gold, etf: C.pos,
    fx: "#A78BFA", commodity: "#FF8C42", super: "#00C389",
  };
  const allocationGroups: Record<string, number> = {};
  enrichedHoldings.forEach(h => {
    const key = h.asset_type || "other";
    allocationGroups[key] = (allocationGroups[key] || 0) + (h.totalValue ?? 0);
  });
  const allocationData = Object.entries(allocationGroups).map(([type, val]) => ({
    name: getAssetTypeLabel(type),
    value: totalValue > 0 ? Math.round((val / totalValue) * 100) : 0,
    color: typeGroupColors[type] || C.neutral,
  })).filter(a => a.value > 0);

  // Watchlist with live prices
  const enrichedWatchlist = watchlistItems.map(w => {
    let price: string | null = null;
    let change24h: number | null = null;
    if (marketData) {
      const sym = (w.asset_symbol || "").toUpperCase();
      if (w.asset_type === "crypto") {
        const found = marketData.crypto?.find((c: any) => c.symbol?.toUpperCase() === sym || c.symbol?.toUpperCase() === sym.replace("/",""));
        if (found) { price = formatPrice(found.price); change24h = found.change24h; }
      } else if (w.asset_type === "asx") {
        const found = marketData.asx?.find((a: any) => a.symbol?.toUpperCase() === sym || a.symbol?.toUpperCase() === sym.replace(".AX","") + ".AX");
        if (found) { price = formatPrice(found.price); change24h = found.change24h; }
      } else if (w.asset_type === "us") {
        const found = marketData.us?.find((u: any) => u.symbol?.toUpperCase() === sym);
        if (found) { price = formatPrice(found.price); change24h = found.change24h; }
      }
    }
    return { ...w, livePrice: price, change24h };
  });

  // Search handler — instant local results, then live API results after 500ms debounce
  useEffect(() => {
    if (searchQuery.length === 0) { setSearchResults([]); setSearchingLive(false); return; }
    // Show local ASSET_MAP matches immediately
    const local = searchAssets(searchQuery);
    setSearchResults(local);
    if (searchQuery.length < 2) return;
    // Debounce the live API search
    setSearchingLive(true);
    const timer = setTimeout(async () => {
      try {
        const live = await searchAssetsLive(searchQuery);
        setSearchResults(live);
      } catch { /* keep local results */ }
      setSearchingLive(false);
    }, 500);
    return () => { clearTimeout(timer); setSearchingLive(false); };
  }, [searchQuery]);

  const openAddModal = (target: "holding" | "watchlist") => {
    setAddTarget(target);
    setAssetMode("listed");
    setUnlistedType("cash");
    setUnlistedName("");
    setUnlistedValue("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedAsset(null);
    setSharesInput("");
    setSaveErr("");
    setShowAddModal(true);
  };

  const handleSelectAsset = (asset: any) => {
    setSelectedAsset(asset);
    setSearchQuery(asset.name);
    setSearchResults([]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr("");
    try {
      if (addTarget === "holding" && assetMode === "unlisted") {
        // Cash / Property / Other — dollar value stored in the shares column
        const dollarAmt = parseFloat(unlistedValue);
        if (!dollarAmt || dollarAmt <= 0) { setSaveErr("Enter a valid dollar amount"); setSaving(false); return; }
        const label = unlistedName.trim() ||
          getAssetTypeLabel(unlistedType);
        const symbol = `${unlistedType}_${Date.now()}`;
        await addToPortfolio(user.id, { symbol, name: label, type: unlistedType, sector: null }, dollarAmt);
      } else {
        if (!selectedAsset) { setSaveErr("Please select an asset"); setSaving(false); return; }
        if (addTarget === "holding") {
          if (!sharesInput.trim()) { setSaveErr("Enter number of shares"); setSaving(false); return; }
          const sharesNum = parseFloat(sharesInput);
          if (isNaN(sharesNum) || sharesNum <= 0) { setSaveErr("Enter a valid number of shares"); setSaving(false); return; }
          await addToPortfolio(user.id, selectedAsset, sharesNum);
        } else {
          await addToWatchlist(user.id, selectedAsset);
        }
      }
      await loadData();
      setShowAddModal(false);
    } catch (e: any) {
      setSaveErr(e.message || "Failed to save. Check Supabase table setup.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHolding = async (itemId: string) => {
    try {
      await removeFromPortfolio(itemId);
      setPortfolio(p => p.filter(x => x.id !== itemId));
    } catch { /* silent */ }
  };

  const handleDeleteWatchlist = async (itemId: string) => {
    try {
      await removeFromWatchlist(itemId);
      setWatchlistItems(w => w.filter(x => x.id !== itemId));
    } catch { /* silent */ }
  };

  const startLongPress = (id: string, type: "holding" | "watchlist") => {
    longPressRef.current = setTimeout(() => {
      if (window.confirm(type === "holding" ? "Remove this holding?" : "Remove from watchlist?")) {
        if (type === "holding") handleDeleteHolding(id);
        else handleDeleteWatchlist(id);
      }
    }, 700);
  };
  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleEditShares = async () => {
    if (!editItem) return;
    const n = parseFloat(editShares);
    if (isNaN(n) || n <= 0) return;
    setEditSaving(true);
    try {
      const updated = await updateShares(editItem.id, n);
      setPortfolio(p => p.map(x => x.id === editItem.id ? { ...x, shares: updated.shares } : x));
      setEditItem(null);
    } catch { /* silent */ }
    setEditSaving(false);
  };

  const formatVal = (v: number | null) =>
    v == null ? "—" : `$${fmt$(v)}`;

  const barData = enrichedHoldings
    .filter(h => h.totalValue)
    .map(h => ({ ticker: h.displaySym, value: Math.round(h.totalValue!), change: h.change }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative" }}>
      {/* Individual stock chart overlay */}
      {chartHolding && <StockChartModal holding={chartHolding} onClose={() => setChartHolding(null)} />}

      <div style={S.screenHeader}>
        <div style={S.screenTitle}>Portfolio</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => openAddModal("watchlist")} style={{ ...S.ghostBtn, fontSize: 11, border: `1px solid ${C.cardBorder}`, padding: "4px 10px", borderRadius: 8 }}>+ Watchlist</button>
          <button onClick={() => openAddModal("holding")}   style={{ ...S.ghostBtn, fontSize: 11, background: C.accentDim, border: `1px solid ${C.accent}44`, padding: "4px 10px", borderRadius: 8, color: C.accent }}>+ Holding</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: 80 }}>
        {loadingData ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.cardBorder}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* BALANCE HERO */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={S.label}>Total Portfolio Value</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700, color: C.text, letterSpacing: "-0.03em", marginTop: 4 }}>
                  {balanceHidden ? "••••••" : (totalValue > 0 ? `$${fmt$(totalValue)}` : "—")}
                </div>
                {!balanceHidden && totalValue > 0 && (
                  <div style={{ color: totalDayChg >= 0 ? C.pos : C.neg, fontSize: 13, fontWeight: 500, marginTop: 2 }}>
                    {totalDayChg >= 0 ? "▲" : "▼"} {totalDayChg >= 0 ? "+" : ""}${fmt$(Math.abs(totalDayChg))} today ({totalDayPct >= 0 ? "+" : ""}{fmtPct(totalDayPct)}%)
                  </div>
                )}
                {!balanceHidden && enrichedHoldings.length > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{enrichedHoldings.length} holding{enrichedHoldings.length !== 1 ? "s" : ""}</div>
                )}
              </div>
              <button
                onClick={() => setBalanceHidden(h => !h)}
                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "8px 12px", color: C.textMuted, cursor: "pointer", fontSize: 18 }}
              >
                {balanceHidden ? "◯" : "◎"}
              </button>
            </div>

            {/* PORTFOLIO PERFORMANCE CHART */}
            {enrichedHoldings.filter(h => !h.isUnlisted && h.livePrice > 0).length > 0 && (
              <PortfolioPerfChart enrichedHoldings={enrichedHoldings} totalValue={totalValue} />
            )}

            {/* ALLOCATION PIE */}
            {allocationData.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ position: "relative" }}>
                    <PieChart width={110} height={110}>
                      <Pie data={allocationData} cx={50} cy={50} innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}
                        onMouseEnter={(_, index) => setActiveSlice(index)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        {allocationData.map((a, i) => (
                          <Cell key={i} fill={a.color} opacity={activeSlice === null || activeSlice === i ? 1 : 0.4} style={{ cursor: "pointer", transition: "opacity 0.2s" }} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any, _: any, props: any) => [`${v}%`, props.payload.name]} />
                    </PieChart>
                    {activeSlice !== null && allocationData[activeSlice] && (
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 400, color: allocationData[activeSlice].color }}>{allocationData[activeSlice].value}%</div>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    {allocationData.map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, cursor: "pointer", opacity: activeSlice === null || activeSlice === i ? 1 : 0.5, transition: "opacity 0.2s" }}
                        onMouseEnter={() => setActiveSlice(i)} onMouseLeave={() => setActiveSlice(null)}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{a.name}</span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{a.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* HOLDINGS BAR CHART */}
            {barData.length > 0 && (
              <>
                <SectionHeader title="Holdings Value" />
                <Card style={{ marginBottom: 16 }}>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={barData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barSize={20}>
                      <XAxis dataKey="ticker" tick={{ fill: C.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis width={48} tick={{ fill: C.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v.toFixed(0)}`} />
                      <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`$${fmt$(Number(v))}`, "Value"]} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {barData.map((h, i) => <Cell key={i} fill={(h.change ?? 0) >= 0 ? C.accent : C.neg} fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </>
            )}

            {/* SUB TABS */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["holdings", "watchlist"].map(t => (
                <button key={t} style={{ ...S.chip, ...(subTab === t ? S.chipActive : {}) }} onClick={() => setSubTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {t === "holdings" && portfolio.length > 0 && (
                    <span style={{ marginLeft: 5, fontSize: 10, color: subTab === t ? C.accent : C.textDim }}>{portfolio.length}</span>
                  )}
                  {t === "watchlist" && watchlistItems.length > 0 && (
                    <span style={{ marginLeft: 5, fontSize: 10, color: subTab === t ? C.accent : C.textDim }}>{watchlistItems.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* HOLDINGS LIST */}
            {subTab === "holdings" && (
              <>
                {enrichedHoldings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>◈</div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>No holdings yet</div>
                    <button onClick={() => openAddModal("holding")} style={{ ...S.ghostBtn, fontSize: 13, border: `1px solid ${C.accent}44`, padding: "8px 20px", borderRadius: 10, background: C.accentDim }}>+ Add your first holding</button>
                  </div>
                ) : (
                  <>
                    {enrichedHoldings.map((h, i) => (
                      <Card
                        key={h.id || i}
                        style={{ padding: "12px 14px", marginBottom: 8, animationDelay: `${i * 40}ms`, cursor: "pointer" }}
                        onClick={() => {
                          if (!h.isUnlisted && h.livePrice > 0) {
                            setChartHolding(h);
                          } else {
                            setEditItem(h);
                            setEditShares(String(h.shares));
                          }
                        }}
                      >
                        <div
                          onPointerDown={() => startLongPress(h.id, "holding")}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ ...S.tickerBadge, background: getAssetTypeColor(h.asset_type) + "22", color: getAssetTypeColor(h.asset_type) }}>
                              {h.displaySym.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: C.text }}>{h.displaySym}</span>
                                  {!h.isUnlisted && h.livePrice > 0 && (
                                    <span style={{ fontSize: 9, color: C.textDim }}>↗ chart</span>
                                  )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: C.text }}>
                                    {balanceHidden ? "••••" : formatVal(h.totalValue)}
                                  </span>
                                  {(h.isUnlisted || !h.livePrice) && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditItem(h); setEditShares(String(h.shares)); }}
                                      style={{ fontSize: 10, color: C.textDim, background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}
                                    >Edit</button>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                <span style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                                  {h.isUnlisted ? getAssetTypeLabel(h.asset_type) : h.asset_name}
                                </span>
                                {!h.isUnlisted && (
                                  <span style={{ fontSize: 11, color: h.change >= 0 ? C.pos : C.neg, flexShrink: 0 }}>
                                    {h.change >= 0 ? "▲" : "▼"} {Math.abs(h.change).toFixed(2)}%
                                  </span>
                                )}
                                {h.isUnlisted && (
                                  <span style={{ ...S.badge, background: getAssetTypeColor(h.asset_type) + "22", color: getAssetTypeColor(h.asset_type), fontSize: 9 }}>Manual</span>
                                )}
                              </div>
                              {!h.isUnlisted && (
                                <>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                    <span style={{ fontSize: 10, color: C.textDim }}>{h.shares} shares · {h.livePrice != null ? formatPrice(h.livePrice) : "no price"}</span>
                                    {totalValue > 0 && h.totalValue != null && (
                                      <span style={{ fontSize: 10, color: C.textDim }}>{Math.round((h.totalValue / totalValue) * 100)}% of portfolio</span>
                                    )}
                                  </div>
                                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 9, color: C.textDim, fontWeight: 500, minWidth: 72 }}>24h Signal</span>
                                    <div style={{ flex: 1, position: "relative", height: 4, background: C.cardBorder, borderRadius: 2 }}>
                                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${h.bullPct}%`, background: h.sentimentColor, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 9, color: h.sentimentColor, fontWeight: 700, minWidth: 60, textAlign: "right" }}>{h.sentiment}</span>
                                  </div>
                                </>
                              )}
                              {h.isUnlisted && totalValue > 0 && h.totalValue != null && (
                                <div style={{ marginTop: 2 }}>
                                  <span style={{ fontSize: 10, color: C.textDim }}>{Math.round((h.totalValue / totalValue) * 100)}% of portfolio</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {/* Always-visible add button */}
                    <button
                      onClick={() => openAddModal("holding")}
                      style={{ width: "100%", marginTop: 4, padding: "12px 0", borderRadius: 12, background: "transparent", border: `1px dashed ${C.cardBorder}`, color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}
                    >+ Add holding</button>
                  </>
                )}
              </>
            )}

            {/* WATCHLIST */}
            {subTab === "watchlist" && (
              <>
                {enrichedWatchlist.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>◎</div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Watchlist is empty</div>
                    <button onClick={() => openAddModal("watchlist")} style={{ ...S.ghostBtn, fontSize: 13, border: `1px solid ${C.accent}44`, padding: "8px 20px", borderRadius: 10, background: C.accentDim }}>+ Add to Watchlist</button>
                  </div>
                ) : (
                  enrichedWatchlist.map((w, i) => (
                    <Card
                      key={w.id || i}
                      style={{ padding: "14px", marginBottom: 8, animationDelay: `${i * 40}ms`, cursor: "pointer" }}
                      onClick={onChat}
                    >
                      <div
                        onPointerDown={() => startLongPress(w.id, "watchlist")}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: C.text }}>
                              {w.asset_symbol?.replace(".AX", "")}
                            </span>
                            <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{w.asset_name}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                            {w.livePrice && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: C.text }}>{w.livePrice}</div>}
                            {w.change24h != null && (
                              <div style={{ fontSize: 11, color: w.change24h >= 0 ? C.pos : C.neg }}>
                                {w.change24h >= 0 ? "▲" : "▼"} {Math.abs(w.change24h).toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ ...S.badge, background: getAssetTypeColor(w.asset_type) + "22", color: getAssetTypeColor(w.asset_type), fontSize: 10 }}>
                            {getAssetTypeLabel(w.asset_type)}
                          </div>
                          {w.asset_sector && <div style={{ fontSize: 10, color: C.textDim }}>{w.asset_sector}</div>}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </>
            )}

            <SectionHeader title="AI Forecasts" style={{ marginTop: 8 }} />
            <Card style={{ padding: 14 }}>
              {([
                { asset: "BTC",     forecast: "Mildly bullish — momentum building toward resistance.", conf: 68, color: C.pos,     change: +2.8,  price: 98450, detail: "Spot ETF inflows remain elevated. On-chain accumulation by long-term holders is constructive. Watch $100k as next major resistance. A clean break could trigger further institutional FOMO." },
                { asset: "AUD/USD", forecast: "Likely range-bound — RBA hold limits upside.",          conf: 55, color: C.neutral, change: +0.4,  price: 0.6480, detail: "RBA's pause on rate cuts constrains upside. China stimulus uncertainty is the key swing factor. Fair value $0.63–$0.66 in current macro. No strong catalyst for breakout near-term." },
                { asset: "Super",   forecast: "Stable — long-term compounding remains optimal.",        conf: 85, color: C.pos,     change: +0.9,  price: 0, detail: "With the 3.1% super guarantee increase from 1 July 2025, salary sacrifice efficiency has improved. Balanced options delivering ~8% p.a. over 10 years. No reason to switch strategy in current market." },
              ] as const).map((f, i, arr) => {
                const isOpen = expandedForecast === f.asset;
                const chartData = f.price > 0 ? buildIntradayChart(f.price, f.change) : null;
                return (
                  <div key={i} style={{ paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, cursor: "pointer" }}
                      onClick={() => setExpandedForecast(isOpen ? null : f.asset)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: C.accent }}>{f.asset}</div>
                        <div style={{ ...S.badge, background: f.color + "22", color: f.color, fontSize: 9 }}>AI {f.conf}%</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: f.change >= 0 ? C.pos : C.neg }}>{f.change >= 0 ? "+" : ""}{f.change}%</span>
                        <span style={{ fontSize: 12, color: C.textDim }}>{isOpen ? "▴" : "▾"}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{f.forecast}</div>
                    {isOpen && (
                      <div style={{ marginTop: 12 }}>
                        {chartData && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4 }}>Today's Price</div>
                            <ResponsiveContainer width="100%" height={90}>
                              <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                  <linearGradient id={`fGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={f.color} stopOpacity={0.2} />
                                    <stop offset="100%" stopColor={f.color} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="t" tick={{ fill: C.textDim, fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                <YAxis domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 8 }} axisLine={false} tickLine={false} width={48} tickFormatter={v => f.price < 10 ? `$${v.toFixed(4)}` : `$${Math.round(v).toLocaleString()}`} />
                                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6, fontSize: 10 }} formatter={(v: any) => [f.price < 10 ? `$${Number(v).toFixed(4)}` : `$${fmt$(Number(v))}`, f.asset]} />
                                <Area type="monotone" dataKey="v" stroke={f.color} strokeWidth={1.5} fill={`url(#fGrad${i})`} dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        <div style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                          <div style={{ fontSize: 9, color: C.accent, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>MaddenAI Detail</div>
                          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>{f.detail}</div>
                        </div>
                        <div style={{ position: "relative", height: 4, background: C.cardBorder, borderRadius: 2 }}>
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${f.conf}%`, background: f.color, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: C.textDim, marginTop: 3 }}>{f.conf}% AI confidence · tap again to close</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
            <Disclaimer />
          </>
        )}
      </div>

      {/* ADD ASSET MODAL */}
      {showAddModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 16px 32px", maxHeight: "85%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: C.text }}>
                {addTarget === "holding" ? "Add Holding" : "Add to Watchlist"}
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ fontSize: 20, color: C.textMuted, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {/* Mode toggle — only shown for holdings */}
            {addTarget === "holding" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#0a1120", borderRadius: 10, padding: 4 }}>
                {(["listed", "unlisted"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setAssetMode(m); setSaveErr(""); }}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: assetMode === m ? C.accent : "transparent", color: assetMode === m ? "#fff" : C.textMuted, transition: "all 0.15s" }}
                  >
                    {m === "listed" ? "Listed Asset" : "Cash / Property / Other"}
                  </button>
                ))}
              </div>
            )}

            {/* LISTED ASSET form */}
            {(addTarget === "watchlist" || assetMode === "listed") && (
              <>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input
                    autoFocus
                    style={{ width: "100%", background: "#0a1120", border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "12px 40px 12px 14px", color: C.text, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}
                    placeholder="Search any ticker, name or crypto (e.g. QANTAS, SOL, QAN.AX)"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSelectedAsset(null); }}
                  />
                  {searchingLive && (
                    <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, border: `2px solid ${C.cardBorder}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  )}
                  {searchResults.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0a1120", border: `1px solid ${C.cardBorder}`, borderRadius: 10, marginTop: 4, overflow: "hidden", zIndex: 10, maxHeight: 220, overflowY: "auto" }}>
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectAsset(r)}
                          style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", borderBottom: i < searchResults.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}
                        >
                          <div style={{ textAlign: "left" }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{r.symbol?.replace(".AX","")}</div>
                          </div>
                          <div style={{ ...S.badge, background: getAssetTypeColor(r.type) + "22", color: getAssetTypeColor(r.type), fontSize: 10, flexShrink: 0 }}>
                            {getAssetTypeLabel(r.type)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedAsset && addTarget === "holding" && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Number of shares / units</div>
                    <input
                      style={{ width: "100%", background: "#0a1120", border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}
                      placeholder={selectedAsset.type === "crypto" ? "e.g. 0.5" : "e.g. 100"}
                      type="number" step="any" min="0"
                      value={sharesInput}
                      onChange={e => setSharesInput(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {/* UNLISTED ASSET form — Cash / Property / Other */}
            {addTarget === "holding" && assetMode === "unlisted" && (
              <>
                {/* Type picker — 2 × 3 grid */}
                {(() => {
                  const TYPES = [
                    { key: "cash",     label: "Cash"     },
                    { key: "property", label: "Property" },
                    { key: "super",    label: "Super"    },
                    { key: "bonds",    label: "Bonds"    },
                    { key: "business", label: "Business" },
                    { key: "other",    label: "Other"    },
                  ] as const;
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
                      {TYPES.map(({ key, label }) => {
                        const active = unlistedType === key;
                        const col    = getAssetTypeColor(key);
                        return (
                          <button
                            key={key}
                            onClick={() => setUnlistedType(key)}
                            style={{ padding: "9px 4px", borderRadius: 9, border: `1px solid ${active ? col : C.cardBorder}`, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: active ? col + "22" : "#0a1120", color: active ? col : C.textMuted, textAlign: "center" }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                {/* Name label */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                    {unlistedType === "cash"     ? "Account / label (optional)" :
                     unlistedType === "property" ? "Property name or address"   :
                     unlistedType === "super"    ? "Fund name (optional)"        :
                     unlistedType === "bonds"    ? "Bond / issuer name"          :
                     unlistedType === "business" ? "Business name"               :
                                                  "Asset name"}
                  </div>
                  <input
                    style={{ width: "100%", background: "#0a1120", border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}
                    placeholder={
                      unlistedType === "cash"     ? "e.g. Savings account"      :
                      unlistedType === "property" ? "e.g. 12 Main St, Sydney"   :
                      unlistedType === "super"    ? "e.g. AustralianSuper"      :
                      unlistedType === "bonds"    ? "e.g. Govt. bonds, hybrids" :
                      unlistedType === "business" ? "e.g. My Pty Ltd"           :
                                                   "e.g. Art, wine, collectibles"
                    }
                    value={unlistedName}
                    onChange={e => setUnlistedName(e.target.value)}
                  />
                </div>
                {/* Dollar value */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Current value (AUD $)</div>
                  <input
                    style={{ width: "100%", background: "#0a1120", border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}
                    placeholder="e.g. 850000"
                    type="number" step="any" min="0"
                    value={unlistedValue}
                    onChange={e => setUnlistedValue(e.target.value)}
                  />
                </div>
              </>
            )}

            {saveErr && (
              <div style={{ fontSize: 12, color: C.neg, marginBottom: 10, padding: "8px 12px", background: C.negDim, borderRadius: 8 }}>{saveErr}</div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: saving ? C.cardBorder : C.accent, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {saving && <div style={{ width: 16, height: 16, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
              {addTarget === "holding" ? "Save Holding" : "Add to Watchlist"}
            </button>
          </div>
        </div>
      )}

      {/* EDIT SHARES MODAL */}
      {editItem && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ background: C.card, borderRadius: "18px 18px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: C.text }}>
                Edit {editItem.displaySym}
              </div>
              <button onClick={() => setEditItem(null)} style={{ fontSize: 20, color: C.textMuted, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
              {editItem?.isUnlisted ? "Current value (AUD $)" : "Number of shares / units"}
            </div>
            <input
              autoFocus
              style={{ width: "100%", background: "#0a1120", border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 12 }}
              type="number" step="any" min="0"
              placeholder={editItem?.isUnlisted ? "e.g. 850000" : ""}
              value={editShares}
              onChange={e => setEditShares(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { if (window.confirm("Remove this holding?")) { handleDeleteHolding(editItem.id); setEditItem(null); } }}
                style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: C.negDim, color: C.neg, fontWeight: 700, fontSize: 14, border: `1px solid ${C.neg}44`, cursor: "pointer" }}
              >Remove</button>
              <button
                onClick={handleEditShares}
                disabled={editSaving}
                style={{ flex: 2, padding: "13px 0", borderRadius: 12, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {editSaving && <div style={{ width: 14, height: 14, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TRENDS SCREEN
// ============================================================
function TrendsScreen({ onChat, marketData }: { onChat: () => void; marketData?: any }) {
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [trendsPeriod, setTrendsPeriod] = useState("1D");
  const activeIndices = marketIndicesByPeriod[trendsPeriod];

  // ── Live crypto momentum — v2 object from calculateCryptoMomentumIndex ──
  const cryptoMomentumObj = marketData?.cryptoMomentumIndex;
  const liveCryptoScore: number   = cryptoMomentumObj?.score ?? cryptoMomentumScore;
  const liveSentimentLabel: string = cryptoMomentumObj?.label ?? scoreToLabel(liveCryptoScore);
  const liveSentimentColor: string = cryptoMomentumObj?.color ?? scoreToColor(liveCryptoScore);
  const liveCryptoBreakdown = marketData?.crypto?.slice(0, 6).map((c: any) => ({
    ticker: c.symbol,
    change: parseFloat(c.change24h?.toFixed(2) ?? "0"),
    score: Math.round(Math.max(0, Math.min(100, 50 + (c.change24h ?? 0) * 2.5 + (c.change7d ?? 0) * 1 + (c.change1h ?? 0) * 1.5))),
    note: `Price: ${formatPrice(c.price)} AUD  ·  7d: ${formatChange(c.change7d)}`,
  })) ?? cryptoBreakdown;
  const cryptoExplainText = cryptoMomentumObj ? explainScore(cryptoMomentumObj) : null;

  // ── Live market indices ────────────────────────────────────
  const scoreFrom = (ch: number) => Math.round(Math.max(0, Math.min(100, 50 + ch * 8)));
  const liveIndices = (() => {
    if (!marketData) return activeIndices;
    const btc   = marketData.crypto?.find((c: any) => c.symbol === "BTC");
    const spy   = marketData.us?.find((u: any) => u.symbol === "SPY");
    const qqq   = marketData.us?.find((u: any) => u.symbol === "QQQ");
    const audusd = marketData.fx?.find((f: any) => f.symbol === "AUD/USD");
    const gold  = marketData.gold;
    const asxAvgCh = marketData.asx?.length
      ? +(marketData.asx.reduce((s: number, a: any) => s + (a.change24h || 0), 0) / marketData.asx.length).toFixed(2)
      : 0.3;
    const mkEntry = (name: string, value: string, ch: number) => ({
      name, value, change: ch,
      aiSentiment: scoreToLabel(scoreFrom(ch)), bullPct: scoreFrom(ch),
    });
    return [
      mkEntry("S&P 500", spy  ? `$${fmt$(spy.price)}`  : "$5,820.00",  spy?.change24h ?? 0.8),
      mkEntry("NASDAQ",  qqq  ? `$${fmt$(qqq.price)}`  : "$18,340.00", qqq?.change24h ?? 1.4),
      mkEntry("ASX 200", "$8,120.00",                                                          asxAvgCh),
      mkEntry("BTC",     btc?.price   ? formatPrice(btc.price)   : "$98,450.00",              btc?.change24h ?? 2.8),
      mkEntry("Gold",    gold?.price  ? formatPrice(gold.price)  : "$3,024.00",               gold?.change24h ?? -0.4),
      mkEntry("AUD/USD", audusd ? `$${audusd.price.toFixed(4)}` : "$0.6480",                  audusd?.change24h ?? 0.4),
    ];
  })();

  // ── For non-1D periods keep scaled static data, 1D uses live ─
  const displayIndices = trendsPeriod === "1D" && marketData ? liveIndices : activeIndices;

  // ── Live top movers ────────────────────────────────────────
  const liveMovers = (() => {
    if (!marketData?.topGainers?.length) return topMovers;
    const picks = [
      ...(marketData.topGainers?.slice(0, 2) ?? []),
      ...(marketData.topLosers?.slice(0, 1) ?? []),
    ];
    return picks.map((a: any) => ({
      ticker: a.symbol,
      change: parseFloat((a.change24h ?? 0).toFixed(2)),
      why: `${a.market || "Market"} · ${formatPrice(a.price)} · ${a.change24h >= 0 ? "Leading gains" : "Under pressure"} on 24h volume.`,
    }));
  })();

  // ── Live sector strength — v2 from calculateSectorStrength ───
  const liveSectorBar = (() => {
    if (!marketData?.sectorStrength?.length) return sectorBarData;
    // v2 data already has color (scoreToColor), label, relativePerf, breadthPct
    const rows = marketData.sectorStrength.map((s: any) => ({
      name: s.sector,
      val: s.strength,
      color: s.color,                                     // pre-computed by scoreToColor
      label: s.label,
      relativePerf: s.relativePerf,
      breadthPct: s.breadthPct,
    }));
    if (!rows.find((r: any) => r.name === "Crypto")) {
      rows.unshift({ name: "Crypto", val: liveCryptoScore, color: liveSentimentColor, label: liveSentimentLabel, relativePerf: null, breadthPct: null });
    }
    return rows.sort((a: any, b: any) => b.val - a.val);
  })();

  return (
    <Screen title="Market Trends" subtitle="Global intelligence">
      {/* PERIOD SELECTOR */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["1H", "1D", "1W", "1M", "1Y"].map(p => (
          <button
            key={p}
            style={{ ...S.periodBtn, ...(trendsPeriod === p ? S.periodBtnActive : {}) }}
            onClick={() => setTrendsPeriod(p)}
          >{p}</button>
        ))}
      </div>

      {/* AI MARKET SIGNALS BOARD */}
      <Card style={{ marginBottom: 16, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>MaddenAI Signal Board</span>
          </div>
          <span style={{ fontSize: 9, color: C.textDim }}>Change ({trendsPeriod}) · AI Forecast</span>
        </div>
        {displayIndices.map((m, i) => {
          const sentColor = m.aiSentiment.toLowerCase().includes("bull") ? C.pos
            : m.aiSentiment.toLowerCase().includes("bear") ? C.neg : C.neutral;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: i < displayIndices.length - 1 ? 10 : 0, marginBottom: i < displayIndices.length - 1 ? 10 : 0, borderBottom: i < displayIndices.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
              <div style={{ width: 64, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, color: C.text }}>{m.name}</div>
              <div style={{ flex: 1 }}>
                <div style={{ position: "relative", height: 5, background: C.cardBorder, borderRadius: 3 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${m.bullPct}%`, background: sentColor, borderRadius: 3 }} />
                </div>
              </div>
              {/* Change rate */}
              <span style={{ fontSize: 11, color: m.change > 0 ? C.pos : C.neg, fontWeight: 600, minWidth: 44, textAlign: "right" }}>
                {m.change > 0 ? "+" : ""}{fmtPct(m.change)}%
              </span>
              {/* AI forecast badge */}
              <div style={{ ...S.badge, background: sentColor + "22", color: sentColor, fontSize: 9, padding: "2px 6px", minWidth: 48, textAlign: "center" }}>
                AI {Math.round(m.bullPct)}%
              </div>
            </div>
          );
        })}
      </Card>

      {/* MARKET OVERVIEW GRID */}
      <SectionHeader title="Market Indices" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {displayIndices.map((m, i) => {
          const sentColor = m.aiSentiment.toLowerCase().includes("bull") ? C.pos
            : m.aiSentiment.toLowerCase().includes("bear") ? C.neg : C.neutral;
          return (
            <Card key={i} style={{ padding: "12px 14px", animationDelay: `${i * 30}ms` }}>
              <div style={S.label}>{m.name}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>{m.value}</div>
              {/* Change — clearly labelled */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 1 }}>Change ({trendsPeriod})</div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700, color: m.change > 0 ? C.pos : m.change < 0 ? C.neg : C.neutral }}>
                    <TrendLine up={m.change >= 0} color={m.change >= 0 ? C.pos : C.neg} size={12} />
                    {fmtPct(Math.abs(m.change))}%
                  </div>
                </div>
                {/* AI forecast — clearly labelled */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 1 }}>AI Forecast</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: sentColor }}>{Math.round(m.bullPct)}%</div>
                </div>
              </div>
              <div style={{ marginTop: 6, position: "relative", height: 3, background: C.cardBorder, borderRadius: 2 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${m.bullPct}%`, background: sentColor, borderRadius: 2 }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* INTERACTIVE SECTOR BAR CHART */}
      <SectionHeader title="Sector Strength" />
      <Card style={{ marginBottom: 16, padding: "14px 14px 10px" }}>
        {/* Bar chart — tap a bar to focus */}
        <ResponsiveContainer width="100%" height={Math.max(200, liveSectorBar.length * 30)}>
          <BarChart data={liveSectorBar} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barSize={16}
            onClick={(d: any) => {
              if (d?.activePayload?.[0]) {
                const name = d.activePayload[0].payload.name;
                setActiveSector(prev => prev === name ? null : name);
              }
            }}
          >
            <XAxis type="number" domain={[0, 100]} tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} tickCount={6} />
            <YAxis type="category" dataKey="name" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
            <ReferenceLine x={50} stroke={C.cardBorder} strokeWidth={1.5} strokeDasharray="4 3" label={{ value: "50", position: "insideTopRight", fill: C.textDim, fontSize: 9, offset: 4 }} />
            <Bar dataKey="val" radius={[0, 4, 4, 0]} style={{ cursor: "pointer" }}>
              <LabelList dataKey="val" position="right" style={{ fontSize: 10, fontWeight: 700 }}
                formatter={(v: number) => `${v}`}
                content={(props: any) => {
                  const { x, y, width, height, value, index } = props;
                  const s = liveSectorBar[index];
                  const col = activeSector === null || activeSector === s?.name ? (s?.color || C.accent) : C.textDim;
                  return (
                    <text x={x + width + 5} y={y + height / 2 + 4} fill={col} fontSize={10} fontWeight={700} fontFamily="'Space Grotesk',sans-serif">{value}</text>
                  );
                }}
              />
              {liveSectorBar.map((s: any, i: number) => (
                <Cell
                  key={i}
                  fill={s.color}
                  fillOpacity={activeSector === null || activeSector === s.name ? 1 : 0.18}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Interactive detail panel — shows focused sector or tap-prompt */}
        <div style={{ marginTop: 12, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 10 }}>
          {activeSector ? (() => {
            const s = liveSectorBar.find((x: any) => x.name === activeSector);
            if (!s) return null;
            return (
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: s.color, fontFamily: "'Syne',sans-serif", marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
                  {/* Strength gauge */}
                  <div style={{ position: "relative", height: 6, background: C.cardBorder, borderRadius: 3, marginBottom: 4 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${s.val}%`, background: s.color, borderRadius: 3 }} />
                    <div style={{ position: "absolute", left: "50%", top: -2, height: 10, width: 1, background: C.textDim }} />
                  </div>
                  <div style={{ fontSize: 9, color: C.textDim }}>Score vs. neutral (50)</div>
                </div>
                <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>AI Score</div>
                  </div>
                  {s.relativePerf != null && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, color: s.relativePerf >= 0 ? C.pos : C.neg, lineHeight: 1 }}>
                        {s.relativePerf >= 0 ? "+" : ""}{s.relativePerf}%
                      </div>
                      <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Rel. Perf.</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {liveSectorBar.map((s: any) => (
                <button
                  key={s.name}
                  onClick={() => setActiveSector(s.name)}
                  style={{ background: s.color + "18", border: `1px solid ${s.color}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: s.color, cursor: "pointer", fontWeight: 500 }}
                >
                  {s.name}
                </button>
              ))}
              <div style={{ width: "100%", fontSize: 10, color: C.textDim, marginTop: 4 }}>Tap a bar or label to see sector detail</div>
            </div>
          )}
        </div>
      </Card>

      {/* RADAR CHART */}
      <SectionHeader title="Radar Overview" />
      <Card style={{ marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={sectorData}>
            <PolarGrid stroke={C.cardBorder} />
            <PolarAngleAxis dataKey="sector" tick={{ fill: C.textMuted, fontSize: 11 }} />
            <Radar dataKey="strength" stroke={C.accent} fill={C.accent} fillOpacity={0.15} strokeWidth={1.5} />
            <Tooltip
              contentStyle={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 12 }}
              formatter={(v: any) => [`${v}/100`, "Strength"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      {/* TOP MOVERS */}
      <SectionHeader title="Top Movers" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {liveMovers.map((m: any, i: number) => (
          <Card key={i} style={{ padding: "12px 14px", animationDelay: `${i * 40}ms` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={S.tickerBadge}>{m.ticker.slice(0, 2)}</div>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: C.text }}>{m.ticker}</span>
              <span style={{ marginLeft: "auto", color: m.change > 0 ? C.pos : C.neg, fontWeight: 600 }}>
                {m.change > 0 ? "+" : ""}{m.change}%
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{m.why}</div>
          </Card>
        ))}
      </div>

      {/* CRYPTO MOMENTUM — expanded with individual breakdowns */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Crypto Momentum Index</div>
        {cryptoExplainText && <ScoreTooltip text={cryptoExplainText} />}
      </div>
      <Card style={{ padding: "14px", marginBottom: 16 }}>
        {/* Overall gauge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: liveSentimentColor, lineHeight: 1 }}>{liveCryptoScore}</div>
            <div style={{ fontSize: 11, color: liveSentimentColor, fontWeight: 600, marginTop: 2 }}>{liveSentimentLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Composite Score</div>
            <div style={{ ...S.badge, background: liveSentimentColor + "22", color: liveSentimentColor }}>{liveCryptoBreakdown.length} cryptos tracked</div>
          </div>
        </div>
        <div style={{ position: "relative", height: 7, background: C.cardBorder, borderRadius: 4, marginBottom: 4 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${liveCryptoScore}%`, background: `linear-gradient(90deg, ${C.neg}, ${C.gold}, ${C.pos})`, borderRadius: 4 }} />
          <div style={{ position: "absolute", left: `${liveCryptoScore}%`, top: -3, width: 13, height: 13, borderRadius: "50%", background: liveSentimentColor, border: `2px solid ${C.bg}`, transform: "translateX(-50%)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 9, color: C.neg }}>Bearish</span>
          <span style={{ fontSize: 9, color: C.textMuted }}>Neutral</span>
          <span style={{ fontSize: 9, color: C.pos }}>Bullish</span>
        </div>
        {/* AI insight */}
        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.cardBorder}` }}>
          {cryptoAIInsight}
        </div>
        {/* Individual crypto breakdown */}
        {liveCryptoBreakdown.map((c: any, i: number) => {
          const scoreColor = scoreToColor(c.score);
          return (
            <div key={i} style={{ paddingBottom: i < liveCryptoBreakdown.length - 1 ? 10 : 0, marginBottom: i < liveCryptoBreakdown.length - 1 ? 10 : 0, borderBottom: i < liveCryptoBreakdown.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ ...S.tickerBadge, width: 30, height: 30, fontSize: 10, background: scoreColor + "22", color: scoreColor }}>{c.ticker.slice(0, 2)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: C.text }}>{c.ticker}</span>
                    <span style={{ color: c.change > 0 ? C.pos : C.neg, fontSize: 12, fontWeight: 600 }}>
                      {c.change > 0 ? "+" : ""}{c.change}%
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <div style={{ flex: 1, position: "relative", height: 3, background: C.cardBorder, borderRadius: 2 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${c.score}%`, background: scoreColor, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: scoreColor, fontWeight: 700 }}>{c.score}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>{c.note}</div>
            </div>
          );
        })}
        {/* Ask AI button */}
        <button
          style={{ width: "100%", marginTop: 14, padding: "9px", background: C.accentDim, border: `1px solid ${C.accent}44`, borderRadius: 10, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          onClick={onChat}
        >
          Ask MaddenAI for detailed crypto analysis →
        </button>
      </Card>

      <Disclaimer />
    </Screen>
  );
}

// ============================================================
// NEWS SCREEN
// ============================================================
const NEWS_CATEGORIES = ["All", "Macro", "Markets", "Tech", "Commodities", "Energy", "Banking", "FX", "Real Estate"];

// ── News AI analysis response renderer ────────────────────────
function renderAnalysisText(rawText: string) {
  const text = decodeHtmlEntities(rawText);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const nodes: any[] = [];
  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <div key={`h${i}`} style={{
          fontSize: 11,
          fontWeight: 800,
          color: C.accent,
          letterSpacing: 0.8,
          textTransform: "uppercase" as const,
          marginTop: i > 0 ? 22 : 0,
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: `1px solid ${C.cardBorder}`,
        }}>
          {part.slice(2, -2)}
        </div>
      );
    } else {
      part.split("\n").filter(l => l.trim()).forEach((line, j) => {
        nodes.push(
          <p key={`p${i}-${j}`} style={{
            fontSize: 13.5,
            color: C.text,
            lineHeight: 1.7,
            marginBottom: 10,
          }}>
            {line.trim()}
          </p>
        );
      });
    }
  });
  return nodes;
}

function NewsScreen({ onChat, userProfile }: { onChat: (msg?: string) => void; userProfile?: any }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    article: any;
    status: "loading" | "done" | "error";
    response: string;
  } | null>(null);
  const [dotPhase, setDotPhase] = useState(0);

  // Animate the loading dots
  useEffect(() => {
    if (!analysis || analysis.status !== "loading") return;
    const t = setInterval(() => setDotPhase(p => (p + 1) % 4), 420);
    return () => clearInterval(t);
  }, [analysis?.status]);

  const loadNews = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setArticles(json.articles ?? []);
      setFetchedAt(json.fetchedAt ?? Date.now());
    } catch (_) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  const askMaddenAI = useCallback(async (article: any) => {
    setAnalysis({ article, status: "loading", response: "" });
    try {
      // 1 — attempt to fetch full article body
      let articleBody = "";
      let contentQuality: "good" | "poor" | "unavailable" = "unavailable";

      if (article.url) {
        try {
          const r = await fetch(`/api/fetch-article?url=${encodeURIComponent(article.url)}`);
          if (r.ok) {
            const d = await r.json();
            contentQuality = d.quality || "poor";
            if (d.content && d.content.length > 200 && d.quality === "good") {
              articleBody = d.content;
            }
          }
        } catch (_) {}
      }

      // 2 — build system prompt with user profile
      const systemPrompt = buildCompleteSystemPrompt(userProfile, null);

      // 3 — compose the user message, adapting to what content we have
      const hasFullContent = contentQuality === "good" && articleBody.length > 200;

      const contentBlock = hasFullContent
        ? `FULL ARTICLE CONTENT:\n---\n${articleBody}\n---`
        : `RSS HEADLINE & SUMMARY:\nHeadline: ${article.headline}\nSummary: ${article.summary || "(none)"}

CONTEXT NOTE: Full article text was not retrievable. Use the headline, summary, source credibility, category context, and your expert financial knowledge to produce a thorough analysis. Do not mention or apologise for any content limitation.`;

      const userMessage =
        `MaddenAI Intelligence Briefing — analyse this news item to the standard of a Goldman Sachs morning note. Every sentence must carry information. No filler.

ARTICLE:
Headline: "${article.headline}"
Source: ${article.source}  |  Category: ${article.category}  |  Published: ${article.ageStr}

${contentBlock}

Respond using exactly these two sections with no preamble, no meta-commentary, and no apologies:

**What Happened**
2–3 tight paragraphs. State precisely what occurred, who is involved, the exact numbers and decisions at play, and the broader market context. Draw on expert financial knowledge to add depth beyond the headline. Every sentence must add new information — no repetition, no hedging, no filler.

**What It Means For You**
1–2 focused paragraphs tailored to this user's investor profile. Name specific sectors, stocks, ETFs, or actions worth considering. Quantify the opportunity or risk where possible. End with one clear, actionable next step.`;

      // 4 — call Claude
      const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") || "";
      if (!text) throw new Error("empty");
      setAnalysis(prev => prev ? { ...prev, status: "done", response: text } : null);
    } catch (_) {
      setAnalysis(prev => prev ? { ...prev, status: "error", response: "" } : null);
    }
  }, [userProfile]);

  // Sort: high-impact (score ≥ 75) pinned to top newest-first, then rest newest-first
  const sorted = [...articles].sort((a, b) => {
    const aBreaking = a.impactScore >= 75;
    const bBreaking = b.impactScore >= 75;
    if (aBreaking && !bBreaking) return -1;
    if (!aBreaking && bBreaking) return 1;
    return a.ageMinutes - b.ageMinutes; // newest first within each group
  });

  const filtered = activeCategory === "All"
    ? sorted
    : sorted.filter(a => a.category === activeCategory);

  const lastUpdated = fetchedAt
    ? (() => {
        const mins = Math.floor((Date.now() - fetchedAt) / 60000);
        return mins < 1 ? "Just now" : `${mins}m ago`;
      })()
    : null;

  const SkeletonCard = ({ h = 90 }: { h?: number }) => (
    <div style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 8, height: h, overflow: "hidden" }}>
      <div style={{ width: "40%", height: 10, borderRadius: 5, background: C.cardBorder, marginBottom: 10 }} />
      <div style={{ width: "90%", height: 12, borderRadius: 5, background: C.cardBorder, marginBottom: 7 }} />
      <div style={{ width: "75%", height: 12, borderRadius: 5, background: C.cardBorder, marginBottom: 7 }} />
      <div style={{ width: "60%", height: 10, borderRadius: 5, background: C.cardBorder }} />
    </div>
  );

  const dots = ".".repeat(dotPhase);

  return (
    <>
      {/* ── AI Analysis Modal ────────────────────────────────── */}
      {analysis && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: C.bg, display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: `1px solid ${C.cardBorder}`,
            flexShrink: 0,
          }}>
            <button
              onClick={() => setAnalysis(null)}
              style={{ ...S.ghostBtn, fontSize: 13, color: C.textMuted, padding: "4px 0" }}
            >
              ← Back
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.accent, letterSpacing: 1.5 }}>MADDENAI</div>
              <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 0.5, marginTop: 1 }}>FINANCIAL INTELLIGENCE</div>
            </div>
            <div style={{ width: 44 }} />
          </div>

          {/* Article context strip */}
          <div style={{
            padding: "10px 16px 12px",
            background: C.card,
            borderBottom: `1px solid ${C.cardBorder}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: analysis.article.categoryColor, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: analysis.article.categoryColor, fontWeight: 700 }}>{analysis.article.category}</span>
              <span style={{ fontSize: 10, color: C.textMuted }}>· {analysis.article.source} · {analysis.article.ageStr}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>
              {decodeHtmlEntities(analysis.article.headline)}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px 32px" }}>
            {analysis.status === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, paddingTop: 80 }}>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:0.4;transform:scale(0.85)}50%{opacity:1;transform:scale(1)}}`}</style>
                {/* Dual-ring spinner */}
                <div style={{ position: "relative", width: 72, height: 72 }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${C.accent}33` }} />
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: C.accent, animation: "spin 1s linear infinite" }} />
                  <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: `1.5px solid ${C.accent}22` }} />
                  <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: C.accent + "99", animation: "spin 1.6s linear infinite reverse" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: C.accent, letterSpacing: 1 }}>M</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>MaddenAI is analysing</div>
                  <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>Reading the article and building your briefing...</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 220}ms`, opacity: 0.7 }} />
                  ))}
                </div>
              </div>
            )}

            {analysis.status === "error" && (
              <div style={{ textAlign: "center", paddingTop: 64 }}>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                  Unable to load this analysis right now.
                </div>
                <button
                  style={{ ...S.ghostBtn, color: C.accent }}
                  onClick={() => askMaddenAI(analysis.article)}
                >
                  Try again →
                </button>
              </div>
            )}

            {analysis.status === "done" && (
              <div>{renderAnalysisText(analysis.response)}</div>
            )}
          </div>

          {/* Footer — read full article */}
          {analysis.article.url && analysis.status === "done" && (
            <div style={{
              padding: "12px 16px 24px",
              borderTop: `1px solid ${C.cardBorder}`,
              flexShrink: 0,
            }}>
              <a
                href={analysis.article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", textAlign: "center",
                  fontSize: 13, fontWeight: 600,
                  color: C.accent, textDecoration: "none",
                }}
              >
                Read full article →
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── News feed ─────────────────────────────────────────── */}
      <Screen title="Market News" subtitle={refreshing ? "Refreshing…" : lastUpdated ? `Updated ${lastUpdated}` : "AI-filtered intelligence"}>

        {/* Category filter pills */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 16, scrollbarWidth: "none" }}>
          {NEWS_CATEGORIES.map(cat => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: 20,
                  fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  background: active ? C.accent : C.card,
                  color: active ? "#fff" : C.textMuted,
                  transition: "background 0.15s",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <>
            <SectionHeader title="Loading news…" />
            {[105, 100, 100, 95, 95].map((h, i) => <SkeletonCard key={i} h={h} />)}
          </>
        )}

        {/* Error state */}
        {!loading && error && (
          <Card style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>Unable to load live news right now.</div>
            <button style={{ ...S.ghostBtn, color: C.accent }} onClick={() => loadNews()}>Retry</button>
          </Card>
        )}

        {/* News feed */}
        {!loading && !error && (
          <>
            <SectionHeader
              title={activeCategory === "All" ? "Latest Finance News" : activeCategory}
              action={
                <button style={{ ...S.ghostBtn, fontSize: 11, color: C.accent }} onClick={() => loadNews(true)}>
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              }
            />
            {filtered.length === 0 && (
              <Card style={{ padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: C.textMuted }}>No {activeCategory} news right now.</div>
              </Card>
            )}
            {filtered.map((n, i) => {
              // Importance band
              const isBreaking = n.impactScore >= 75;
              const isNotable = !isBreaking && n.impactScore >= 62;

              return (
              <Card key={n.id} style={{ marginBottom: 8, padding: "14px 14px 12px", animationDelay: `${i * 20}ms` }}>
                {/* Meta row */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.categoryColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: n.categoryColor, fontWeight: 700 }}>{n.category}</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>·</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{n.source}</span>
                  {/* Importance indicator */}
                  {isBreaking && (
                    <span style={{
                      marginLeft: 3,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 0.8,
                      color: "#FF4444",
                      background: "rgba(255,68,68,0.12)",
                      border: "1px solid rgba(255,68,68,0.3)",
                      borderRadius: 3,
                      padding: "1px 5px",
                      flexShrink: 0,
                    }}>BREAKING</span>
                  )}
                  {isNotable && (
                    <span style={{
                      marginLeft: 3,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 0.8,
                      color: "#E8A020",
                      background: "rgba(232,160,32,0.12)",
                      border: "1px solid rgba(232,160,32,0.3)",
                      borderRadius: 3,
                      padding: "1px 5px",
                      flexShrink: 0,
                    }}>NOTABLE</span>
                  )}
                  <span style={{ fontSize: 10, color: C.textMuted, marginLeft: "auto", flexShrink: 0 }}>{n.ageStr}</span>
                </div>
                {/* Headline */}
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 6 }}>{decodeHtmlEntities(n.headline)}</div>
                {/* Summary */}
                {n.summary && n.summary.length > 20 && (
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, marginBottom: 10 }}>{decodeHtmlEntities(n.summary)}</div>
                )}
                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.cardBorder}`, paddingTop: 10 }}>
                  {n.url ? (
                    <a
                      href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: "none" }}
                    >
                      Read article →
                    </a>
                  ) : <span />}
                  <button
                    style={S.ghostBtn}
                    onClick={() => askMaddenAI(n)}
                  >
                    Ask MaddenAI →
                  </button>
                </div>
              </Card>
              );
            })}
          </>
        )}

        <Disclaimer />
      </Screen>
    </>
  );
}

// ============================================================
// CHAT SCREEN
// ============================================================
function ChatScreen({ marketData, user, userProfile, initialMessage, onMessageConsumed }: { marketData?: any; user?: any; userProfile?: any; initialMessage?: string | null; onMessageConsumed?: () => void }) {
  const [messages, setMessages] = useState<Array<{
    role: string;
    content?: string;          // user messages
    type?: string;             // "structured" | "conversational" | "error" | "demo"
    data?: any;                // structured AI card data
    text?: string;             // conversational / error text
  }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(!!initialMessage);
  const [fetchingFor, setFetchingFor] = useState<string[]>([]);
  const [apiLive] = useState(!!import.meta.env.VITE_ANTHROPIC_API_KEY);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const didAutoSend = useRef(false);

  // ASX status — computed fresh each render (no need to store in state)
  const asxStatus = getASXStatus();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, fetchingFor]);

  const send = async (text?: string, silent = false) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");

    // Detect mentioned assets synchronously so we can show "Fetching live data..." immediately
    const detectedAssets = parseAssetsFromQuery(q);

    // silent=true when triggered by contextual buttons from other tabs — omit the user bubble
    const newMsgs = silent ? messages : [...messages, { role: "user", content: q }];
    setMessages(newMsgs);
    setLoading(true);
    if (detectedAssets.length > 0) {
      setFetchingFor(detectedAssets.map((a: any) => a.name || a.symbol));
    }

    // Build conversation history (all prior messages in role/content format)
    const convHistory = messages.map(m => ({
      role: m.role,
      content: m.content || m.text || (m.data ? JSON.stringify(m.data).slice(0, 200) : ""),
    })).filter(m => m.content);

    let freshProfile = userProfile || null;
    if (user?.id) {
      try {
        const p = await getUserProfile(user.id);
        if (p) freshProfile = p;
      } catch (_) {}
    }

    const result = await handleChatMessage(q, convHistory, freshProfile, marketData);
    setFetchingFor([]);

    const aiMsg = {
      role: "assistant",
      type: result.type,
      data: result.type === "structured" ? result.data : undefined,
      text: result.type !== "structured" ? result.text : undefined,
    };

    setMessages([...newMsgs, aiMsg]);
    setLoading(false);
    inputRef.current?.focus();
  };

  // Auto-send any pre-seeded message (from contextual buttons in other screens)
  // silent=true so no user bubble appears — just loading indicator → AI response
  useEffect(() => {
    if (initialMessage && !didAutoSend.current) {
      didAutoSend.current = true;
      send(initialMessage, true);
      onMessageConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* HEADER */}
      <div style={S.screenHeader}>
        <div>
          <div style={S.screenTitle}>MaddenAI</div>
          <div style={S.screenSubtitle}>Financial Intelligence Engine</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ ...S.badge, background: apiLive ? C.posDim : C.goldDim, color: apiLive ? C.pos : C.gold }}>
            {apiLive ? "● Live" : "● Demo mode"}
          </div>
          {userProfile?.knowledge_level && userProfile.knowledge_level !== "Prefer not to say" && (
            <div style={{ ...S.badge, background: C.accent + "18", color: C.accent, fontSize: 9 }}>
              {[userProfile.knowledge_level, userProfile.risk_profile, userProfile.goals]
                .filter(v => v && v !== "Prefer not to say")
                .slice(0, 2)
                .join(" · ")}
            </div>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>

        {/* Full-screen loading ring — shown for every send, from chat or any contextual button */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "40px 24px" }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:0.4;transform:scale(0.85)}50%{opacity:1;transform:scale(1)}}`}</style>
            {/* Animated logo ring */}
            <div style={{ position: "relative", width: 72, height: 72 }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: `2px solid ${C.accent}33`,
              }} />
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: `2px solid transparent`,
                borderTopColor: C.accent,
                animation: "spin 1s linear infinite",
              }} />
              <div style={{
                position: "absolute", inset: 8, borderRadius: "50%",
                border: `1.5px solid ${C.accent}22`,
              }} />
              <div style={{
                position: "absolute", inset: 8, borderRadius: "50%",
                border: `1.5px solid transparent`,
                borderTopColor: C.accent + "99",
                animation: "spin 1.6s linear infinite reverse",
              }} />
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: C.accent, letterSpacing: 1,
              }}>M</div>
            </div>

            {/* Status text */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                MaddenAI is analysing
              </div>
              <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
                {fetchingFor.length > 0
                  ? `Fetching live data for ${fetchingFor.join(", ")}...`
                  : "Pulling live market data and building your briefing..."}
              </div>
            </div>

            {/* Animated dots */}
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: "50%", background: C.accent,
                  animation: "pulse 1.2s ease-in-out infinite",
                  animationDelay: `${i * 220}ms`,
                  opacity: 0.7,
                }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Welcome / empty state */}
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                  {userProfile?.first_name
                    ? `G'day ${userProfile.first_name}.`
                    : "Ask MaddenAI anything."}
                </div>
                <div style={{ fontSize: 13.5, color: C.textMuted, marginBottom: 8, lineHeight: 1.6 }}>
                  {userProfile?.knowledge_level && userProfile.knowledge_level !== "Prefer not to say"
                    ? `Personalised for your ${userProfile.knowledge_level.toLowerCase()} profile`
                    : "Markets · Super · Investing · Tax · Crypto"}
                </div>
                {userProfile?.knowledge_level && userProfile.knowledge_level !== "Prefer not to say" && (
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 20 }}>
                    {[userProfile.risk_profile, userProfile.income_bracket, userProfile.goals, userProfile.life_stage]
                      .filter(v => v && v !== "Prefer not to say")
                      .join("  ·  ")}
                  </div>
                )}
                {(!userProfile?.knowledge_level || userProfile.knowledge_level === "Prefer not to say") && (
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 20 }}>
                    Set your profile in Account for personalised responses
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {getProfilePrompts(userProfile).map(p => (
                    <button key={p} style={S.chip} onClick={() => send(p)}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Message history */}
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === "user" ? (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <div style={S.userBubble}>{m.content}</div>
                  </div>
                ) : m.type === "structured" ? (
                  <AIResponseCard data={m.data} user={user} />
                ) : (
                  <AITextBubble text={m.text || ""} isError={m.type === "error"} />
                )}
              </div>
            ))}

          </>
        )}

        <div ref={endRef} />
      </div>

      {/* INPUT */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.cardBorder}` }}>
        {messages.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
            {getProfilePrompts(userProfile).slice(3, 6).map(p => (
              <button key={p} style={{ ...S.chip, whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => send(p)}>{p}</button>
            ))}
          </div>
        )}
        <div style={S.inputRow}>
          <textarea
            ref={inputRef}
            style={S.textarea}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about markets, super, investing..."
            rows={1}
          />
          <button
            style={{ ...S.sendBtn, opacity: input.trim() && !loading ? 1 : 0.3 }}
            onClick={() => send()}
            disabled={!input.trim() || loading}
          >↑</button>
        </div>
        {!apiLive && (
          <div style={{ fontSize: 10.5, color: C.textMuted, textAlign: "center", marginTop: 8 }}>
            Demo mode — add VITE_ANTHROPIC_API_KEY to Secrets to go live
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// AI TEXT BUBBLE — for conversational and error responses
// ============================================================
function AITextBubble({ text: rawText, isError }: { text: string; isError?: boolean }) {
  if (!rawText) return null;
  const text = decodeHtmlEntities(rawText);
  // Split into paragraphs for readable rendering
  const paragraphs = text.split(/\n\n+/).filter(Boolean);

  return (
    <div style={{ marginBottom: 16 }} className="fade-up">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <div style={S.aiDot} />
        <span style={{ fontSize: 11, color: C.textMuted }}>MaddenAI</span>
      </div>
      <div style={{
        background: isError ? C.negDim : C.card,
        border: `1px solid ${isError ? C.neg + "44" : C.cardBorder}`,
        borderRadius: 16,
        padding: "14px 16px",
        maxWidth: "100%",
      }}>
        {paragraphs.map((para, i) => {
          // Render single-line items that start with dashes/bullets as styled lines
          const lines = para.split("\n");
          return (
            <div key={i} style={{ marginBottom: i < paragraphs.length - 1 ? 12 : 0 }}>
              {lines.map((line, j) => {
                const isBullet = /^[-•*]/.test(line.trim());
                const isHeader = /^\*\*(.+)\*\*/.test(line.trim());
                const cleaned = line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/^[-•*]\s*/, "");
                return (
                  <div key={j} style={{
                    fontSize: 13.5,
                    color: isError ? C.neg : (isHeader ? C.text : C.textMuted),
                    lineHeight: 1.65,
                    fontWeight: isHeader ? 600 : 400,
                    paddingLeft: isBullet ? 12 : 0,
                    marginBottom: j < lines.length - 1 ? 4 : 0,
                    position: "relative",
                  }}>
                    {isBullet && (
                      <span style={{ position: "absolute", left: 0, color: C.accent }}>·</span>
                    )}
                    {cleaned}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// AI RESPONSE CARD — for structured asset analysis
// ============================================================
function AIResponseCard({ data, user }: { data: any; user?: any }) {
  const [watchlistStatus, setWatchlistStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!data) return null;
  const sentColor = data.sentiment?.toLowerCase().includes("bull") ? C.pos
    : data.sentiment?.toLowerCase().includes("bear") ? C.neg : C.neutral;

  const riskText  = data.keyRisk  || data.riskNote;
  const watchText = data.watchFor || data.nextStep;

  const handleAddToWatchlist = async () => {
    if (!user || watchlistStatus !== "idle") return;
    const ticker = data.ticker || data.asset;
    if (!ticker) return;
    setWatchlistStatus("saving");
    try {
      await addToWatchlist(user.id, {
        symbol: ticker,
        name:   data.asset || ticker,
        type:   ticker.endsWith(".AX") ? "asx" : (["BTC","ETH","SOL","BNB","XRP"].includes(ticker) ? "crypto" : "us"),
      });
      setWatchlistStatus("saved");
      setTimeout(() => setWatchlistStatus("idle"), 3000);
    } catch {
      setWatchlistStatus("error");
      setTimeout(() => setWatchlistStatus("idle"), 2000);
    }
  };

  return (
    <div style={{ marginBottom: 16 }} className="fade-up">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <div style={S.aiDot} />
        <span style={{ fontSize: 11, color: C.textMuted }}>MaddenAI</span>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* Asset header */}
        <div style={{ padding: "14px 14px 12px", borderBottom: `1px solid ${C.cardBorder}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: C.text }}>{data.asset}</div>
              {data.ticker && data.ticker !== data.asset && (
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{data.ticker}</div>
              )}
              {data.price && data.price !== "N/A" && (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: C.textMuted, marginTop: 2 }}>{data.price}</div>
              )}
            </div>
            {data.change && (
              <div style={{ fontSize: 13, color: data.change?.startsWith("+") ? C.pos : C.neg, fontWeight: 500 }}>{data.change}</div>
            )}
          </div>
        </div>

        {/* Buy probability + Sentiment */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.cardBorder}`, borderBottom: `1px solid ${C.cardBorder}` }}>
            <div style={S.label}>Buy Probability</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: C.accent, marginTop: 2 }}>{data.buyProbability}%</div>
            <div style={{ position: "relative", height: 3, background: C.cardBorder, borderRadius: 2, marginTop: 6 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${data.buyProbability}%`, background: C.accent, borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.cardBorder}` }}>
            <div style={S.label}>Sentiment</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: sentColor, marginTop: 2 }}>{data.sentiment}</div>
            <div style={{ position: "relative", height: 3, background: C.cardBorder, borderRadius: 2, marginTop: 6 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${data.sentimentScore}%`, background: sentColor, borderRadius: 2 }} />
            </div>
          </div>
        </div>

        {/* AI Insight */}
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}` }}>
          <div style={S.label}>AI Insight</div>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, marginTop: 6 }}>{data.insight}</div>
        </div>

        {/* Macro / Fundamental / Technical / Sentiment views — if present */}
        {(data.macroContext || data.fundamentalView || data.technicalView || data.sentimentView) && (
          <div style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
            {[
              { label: "Macro", text: data.macroContext },
              { label: "Fundamental", text: data.fundamentalView },
              { label: "Technical", text: data.technicalView },
              { label: "Market Sentiment", text: data.sentimentView },
            ].filter(v => v.text).map((v, i, arr) => (
              <div key={v.label} style={{
                padding: "8px 14px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none",
              }}>
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, marginBottom: 2 }}>{v.label.toUpperCase()}</div>
                <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{v.text}</div>
              </div>
            ))}
          </div>
        )}

        {/* Key Risk */}
        {riskText && (
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.cardBorder}`, background: C.negDim }}>
            <div style={{ fontSize: 11, color: C.neg, fontWeight: 600, marginBottom: 3 }}>KEY RISK</div>
            <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{riskText}</div>
          </div>
        )}

        {/* Watch For */}
        {watchText && (
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.cardBorder}`, background: C.accentDim }}>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 600, marginBottom: 3 }}>WATCH FOR</div>
            <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{watchText}</div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
          <button
            style={{
              ...S.actionBtn,
              color: watchlistStatus === "saved" ? C.pos : watchlistStatus === "error" ? C.neg : C.textMuted,
              borderColor: watchlistStatus === "saved" ? C.pos + "44" : watchlistStatus === "error" ? C.neg + "44" : C.cardBorder,
            }}
            onClick={handleAddToWatchlist}
            disabled={watchlistStatus === "saving" || watchlistStatus === "saved" || !user}
          >
            {watchlistStatus === "saving" ? "Saving…" : watchlistStatus === "saved" ? "✓ Saved" : watchlistStatus === "error" ? "Failed" : "+ Watchlist"}
          </button>
          <button style={S.actionBtn}>Compare</button>
          <button style={S.actionBtn}>Show chart</button>
        </div>

        {/* Disclaimer */}
        <div style={{ padding: "8px 14px", background: C.bg, borderTop: `1px solid ${C.cardBorder}` }}>
          <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.5 }}>⚠ {data.disclaimer}</div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function Screen({ title, subtitle, action, children }: { title: React.ReactNode; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ ...S.screenHeader, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={S.screenTitle}>{title}</div>
          {subtitle && <div style={S.screenSubtitle}>{subtitle}</div>}
        </div>
        {action && <div style={{ flexShrink: 0, paddingTop: 2 }}>{action}</div>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {children}
      </div>
    </div>
  );
}

function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      className="fade-up"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 14, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, action, style }: { title: string; action?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, ...style }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 600, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{title}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const S: Record<string, React.CSSProperties> = {
  root: { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#060c18", fontFamily: "'Space Grotesk', sans-serif" },
  appShell: { width: "100%", maxWidth: 430, height: "100vh", display: "flex", flexDirection: "column", background: C.bg, position: "relative", overflow: "hidden" },

  brandBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 16px 10px",
    borderBottom: `1px solid ${C.cardBorder}`,
    background: "linear-gradient(135deg, #0B1222 0%, #0d1a35 100%)",
    flexShrink: 0,
  },
  brandName: {
    fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
    color: "#fff", letterSpacing: "0.12em",
    background: `linear-gradient(90deg, #fff 0%, ${C.accent} 100%)`,
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  brandSub: { fontSize: 9.5, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1 },

  screenArea: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },

  screenHeader: { padding: "14px 16px 12px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  screenTitle: { fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" },
  screenSubtitle: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  nav: { display: "flex", alignItems: "flex-end", background: C.card, borderTop: `1px solid ${C.cardBorder}`, flexShrink: 0, paddingBottom: 4 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 4px 8px", color: C.textMuted, transition: "color 0.15s" },
  navBtnActive: { color: C.accent },
  navBtnHome: {
    position: "relative",
    marginTop: -18,
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: "50%",
    width: 56, height: 56,
    flexShrink: 0,
    padding: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 2,
    boxShadow: `0 -4px 16px rgba(0,0,0,0.4)`,
  },
  navBtnHomeActive: {
    background: C.accentDim,
    border: `1px solid ${C.accent}`,
    animation: "glow 2s ease-in-out infinite",
  },
  navIcon: { fontSize: 18, lineHeight: 1 },
  navIconHome: { fontSize: 20 },
  navLabel: { fontSize: 9.5, letterSpacing: "0.04em" },

  label: { fontSize: 10.5, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500 },
  badge: { display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500 },

  chip: { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: C.textMuted, cursor: "pointer" },
  chipActive: { background: C.accentDim, border: `1px solid ${C.accent}`, color: C.accent },

  periodBtn: { padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 500, color: C.textMuted, background: "transparent", border: `1px solid transparent`, cursor: "pointer" },
  periodBtnActive: { background: C.accentDim, color: C.accent, border: `1px solid ${C.accent}` },

  tickerBadge: { width: 36, height: 36, borderRadius: 10, background: C.accentDim, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 },

  ghostBtn: { fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 },
  actionBtn: { flex: 1, padding: "7px 0", background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 8, fontSize: 11.5, color: C.textMuted, cursor: "pointer" },

  userBubble: { background: C.accent, color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "10px 14px", maxWidth: "80%", fontSize: 14, lineHeight: 1.5 },
  aiDot: { width: 24, height: 24, borderRadius: 7, background: C.accentDim, border: `1px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: C.accent, fontWeight: 700 },

  inputRow: { display: "flex", gap: 10, alignItems: "flex-end", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: "10px 10px 10px 14px" },
  textarea: { flex: 1, background: "none", border: "none", color: C.text, fontSize: 14, lineHeight: 1.5, maxHeight: 120, overflowY: "auto" },
  sendBtn: { width: 34, height: 34, minWidth: 34, borderRadius: 10, background: C.accent, color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", transition: "opacity 0.15s" },
};
