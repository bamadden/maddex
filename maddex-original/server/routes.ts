import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import pool from "./db";
import { signToken, requireAuth } from "./auth";

// ── News types ────────────────────────────────────────────────
interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  sourceTier: number;
  publishedAt: string;
  ageStr: string;
  ageMinutes: number;
  category: string;
  categoryColor: string;
  aiSentiment: "Bullish" | "Bearish" | "Neutral";
  aiConf: number;
  impactScore: number;
  priority: "high" | "normal";
}

// ── News cache ────────────────────────────────────────────────
const NEWS_CACHE_TTL = 12 * 60 * 1000; // 12 min
let newsCache: { articles: NewsArticle[]; fetchedAt: number } | null = null;

// ── Category colours ──────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Macro: "#F5A623",
  Banking: "#22C55E",
  Tech: "#287BFF",
  Commodities: "#F97316",
  Energy: "#EF4444",
  FX: "#A78BFA",
  Markets: "#00C389",
  "Real Estate": "#EC4899",
};

// ── Simple RSS parser (no extra packages) ─────────────────────
function extractTag(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    results.push(m[1].replace(/\s+/g, " ").trim());
  }
  return results;
}

function stripCDATA(s: string) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function decodeEntities(s: string) {
  return s
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
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// ── Source normalisation ──────────────────────────────────────
// Maps raw RSS source names / URL domains to clean labels + quality tier.
// Tier 1 = premium institutional, Tier 2 = reputable financial, Tier 3 = generic
const SOURCE_NAME_MAP: Record<string, { label: string; tier: number }> = {
  "reuters": { label: "Reuters", tier: 1 },
  "associated press": { label: "AP", tier: 1 },
  "bloomberg": { label: "Bloomberg", tier: 1 },
  "financial times": { label: "FT", tier: 1 },
  "australian financial review": { label: "AFR", tier: 1 },
  "afr": { label: "AFR", tier: 1 },
  "abc news": { label: "ABC News", tier: 1 },
  "abc": { label: "ABC News", tier: 1 },
  "wall street journal": { label: "WSJ", tier: 1 },
  "cnbc": { label: "CNBC", tier: 1 },
  "reserve bank of australia": { label: "RBA", tier: 1 },
  "rba": { label: "RBA", tier: 1 },
  "asx": { label: "ASX", tier: 1 },
  "barron's": { label: "Barron's", tier: 2 },
  "barrons": { label: "Barron's", tier: 2 },
  "marketwatch": { label: "MarketWatch", tier: 2 },
  "market watch": { label: "MarketWatch", tier: 2 },
  "yahoo finance": { label: "Yahoo Finance", tier: 2 },
  "the motley fool": { label: "Motley Fool", tier: 2 },
  "motley fool": { label: "Motley Fool", tier: 2 },
  "seeking alpha": { label: "Seeking Alpha", tier: 2 },
  "the australian": { label: "The Australian", tier: 2 },
  "sydney morning herald": { label: "SMH", tier: 2 },
  "smh": { label: "SMH", tier: 2 },
  "the guardian": { label: "Guardian", tier: 2 },
  "guardian": { label: "Guardian", tier: 2 },
  "investing.com": { label: "Investing.com", tier: 2 },
  "forbes": { label: "Forbes", tier: 2 },
  "fortune": { label: "Fortune", tier: 2 },
  "business insider": { label: "Business Insider", tier: 2 },
  "ap": { label: "AP", tier: 1 },
};

const DOMAIN_MAP: Record<string, { label: string; tier: number }> = {
  "reuters.com": { label: "Reuters", tier: 1 },
  "bloomberg.com": { label: "Bloomberg", tier: 1 },
  "ft.com": { label: "FT", tier: 1 },
  "wsj.com": { label: "WSJ", tier: 1 },
  "afr.com": { label: "AFR", tier: 1 },
  "abc.net.au": { label: "ABC News", tier: 1 },
  "rba.gov.au": { label: "RBA", tier: 1 },
  "asx.com.au": { label: "ASX", tier: 1 },
  "apnews.com": { label: "AP", tier: 1 },
  "cnbc.com": { label: "CNBC", tier: 1 },
  "barrons.com": { label: "Barron's", tier: 2 },
  "marketwatch.com": { label: "MarketWatch", tier: 2 },
  "finance.yahoo.com": { label: "Yahoo Finance", tier: 2 },
  "fool.com": { label: "Motley Fool", tier: 2 },
  "seekingalpha.com": { label: "Seeking Alpha", tier: 2 },
  "theaustralian.com.au": { label: "The Australian", tier: 2 },
  "smh.com.au": { label: "SMH", tier: 2 },
  "theguardian.com": { label: "Guardian", tier: 2 },
  "investing.com": { label: "Investing.com", tier: 2 },
  "forbes.com": { label: "Forbes", tier: 2 },
  "fortune.com": { label: "Fortune", tier: 2 },
  "businessinsider.com": { label: "Business Insider", tier: 2 },
  "businessinsider.com.au": { label: "Business Insider", tier: 2 },
};

function normalizeSource(rawSource: string, link: string): { label: string; tier: number } {
  const s = rawSource.toLowerCase().trim();
  // Try name map first
  for (const [key, val] of Object.entries(SOURCE_NAME_MAP)) {
    if (s === key || s.includes(key)) return val;
  }
  // Try URL domain
  try {
    const hostname = new URL(link).hostname.replace(/^www\./, "");
    for (const [domain, val] of Object.entries(DOMAIN_MAP)) {
      if (hostname === domain || hostname.endsWith("." + domain)) return val;
    }
    // Last resort: clean up the domain into a readable label (tier 3)
    const parts = hostname.split(".");
    const name = parts.length >= 2 ? parts[parts.length - 2] : hostname;
    return { label: name.charAt(0).toUpperCase() + name.slice(1), tier: 3 };
  } catch {
    return { label: "Financial News", tier: 3 };
  }
}

function parseRSS(xml: string): Array<{ title: string; link: string; description: string; pubDate: string; source: string; sourceTier: number }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string; source: string; sourceTier: number }> = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const rawTitle = extractTag(block, "title")[0] ?? "";
    const title = decodeEntities(stripCDATA(rawTitle));
    if (!title || title.length < 15) continue;

    const link = extractTag(block, "link")[0] ?? extractTag(block, "guid")[0] ?? "";
    const rawDesc = extractTag(block, "description")[0] ?? "";
    const description = decodeEntities(stripCDATA(rawDesc)).slice(0, 280);
    const pubDate = extractTag(block, "pubDate")[0] ?? "";

    const srcMatch = block.match(/<source[^>]*>([^<]+)<\/source>/i);
    const rawSource = srcMatch ? srcMatch[1].trim() : "";
    const { label, tier } = normalizeSource(rawSource, link);

    items.push({ title, link, description, pubDate, source: label, sourceTier: tier });
  }
  return items;
}

// ── Keyword categorisation ────────────────────────────────────
function categorise(title: string, desc: string): string {
  const t = (title + " " + desc).toLowerCase();
  if (/\brba\b|cash rate|interest rate|inflation|\bcpi\b|\bgdp\b|treasurer|federal budget|unemployment|recession|reserve bank|monetary policy|consumer confidence|cost of living|wages|wage growth/.test(t)) return "Macro";
  if (/\bcba\b|commonwealth bank|\bnab\b|\banz\b|westpac|macquarie bank|banking sector|big four|bank result|bank earn|lending rate|home loan/.test(t)) return "Banking";
  if (/nvidia|amd\b|intel\b|microsoft|apple\b|alphabet|meta\b|amazon\b|semiconductor|artificial intel|machine learn|tech sector|\bnasdaq\b|software|cloud|cybersecurity|generative ai|data centre/.test(t)) return "Tech";
  if (/\bgold\b|iron ore|copper|lithium|coal|nickel|zinc|\bbhp\b|rio tinto|fortescue|pilbara|mineral|mining|base metal|palladium|silver/.test(t)) return "Commodities";
  if (/\boil\b|crude|brent|wti|\blng\b|natural gas|energy sector|woodside|santos|petroleum|petrol|diesel|fuel cost|renewable|solar|wind farm|electricity/.test(t)) return "Energy";
  if (/aud\/usd|aud\/|\/usd|forex|currency|exchange rate|australian dollar|greenback|\byen\b|\beuro\b|pound sterling|fed rate|federal reserve/.test(t)) return "FX";
  if (/property|housing|real estate|mortgage|dwelling|construction|renter|house price|home value/.test(t)) return "Real Estate";
  return "Markets";
}

// ── Keyword sentiment ─────────────────────────────────────────
function quickSentiment(title: string): { sentiment: "Bullish" | "Bearish" | "Neutral"; conf: number } {
  const t = title.toLowerCase();
  const b = /\bsurge|jump|soar|climb|rally|gain|rise\b|beat|record high|record-high|strong|boost|upgraded|outperform|buy signal|bull|rebound|recovers|jumps/.test(t);
  const n = /\bfall|drop|plunge|sink|decline|tumble|miss|weak|concern|warning|pressure|downgrade|sell signal|bear|loss|slump|slide|falls|drops|crash/.test(t);
  if (b && !n) return { sentiment: "Bullish", conf: 65 + Math.floor(Math.random() * 14) };
  if (n && !b) return { sentiment: "Bearish", conf: 62 + Math.floor(Math.random() * 14) };
  return { sentiment: "Neutral", conf: 44 + Math.floor(Math.random() * 14) };
}

// ── AU relevance boost ────────────────────────────────────────
function auBoost(title: string, desc: string): number {
  const t = (title + " " + desc).toLowerCase();
  if (/\basx\b|australia[n]?|qantas|commonwealth bank|\bcba\b|\bnab\b|\banz\b|westpac|fortescue|\bfmg\b|rio tinto|\bbhp\b|woodside|rba|sydney|melbourne|brisbane/.test(t)) return 18;
  return 0;
}

// ── Impact score (0–100) ──────────────────────────────────────
function impactScore(category: string, title: string, desc: string, ageMinutes: number, sourceTier = 3): number {
  let score = 50;
  const t = title.toLowerCase();
  if (/rba|rate cut|rate hike|rate hold|gdp|recession|crash|crisis|emergency|federal budget|market crash/.test(t)) score += 28;
  else if (/earnings|result|forecast|guidance|record high|record low|ipo|acquisition|merger|profit|revenue/.test(t)) score += 16;
  else if (/asx|s&p 500|dow jones|nasdaq/.test(t)) score += 10;
  const catW: Record<string, number> = { Macro: 14, Banking: 10, Energy: 8, Commodities: 8, Tech: 6, FX: 5, Markets: 3, "Real Estate": 3 };
  score += catW[category] ?? 0;
  score += auBoost(title, desc);
  // Source quality boost
  if (sourceTier === 1) score += 12;
  else if (sourceTier === 2) score += 5;
  // Recency decay — lose 1 pt per 8 minutes, capped at -38
  score -= Math.min(38, Math.floor(ageMinutes / 8));
  return Math.max(0, Math.min(100, score));
}

// ── Finance relevance gate ────────────────────────────────────
// Returns true only if the article is clearly finance/market related
function isFinanceRelevant(title: string, desc: string): boolean {
  const t = (title + " " + desc).toLowerCase();
  return /\bstock|share[s]?|market|index|indices|asx\b|nyse|nasdaq|s&p|dow jones|earnings|revenue|profit|loss|dividend|ipo|merger|acquisition|takeover|interest rate|inflation|\bcpi\b|\bgdp\b|recession|rba\b|federal reserve|\bfed\b|central bank|rate cut|rate hike|rate hold|rate rise|quantitative|fiscal|monetary|bond[s]?\b|yield|treasury|equity|equities|invest|portfolio|fund[s]?\b|etf\b|superannuation|\bsuper\b|retirement|wealth|\bgold\b|silver|copper|iron ore|lithium|coal|oil\b|crude|brent|wti|natural gas|lng\b|commodity|commodities|mining|mineral|crypto|bitcoin|ethereum|blockchain|currency|forex|aud\b|usd\b|exchange rate|bank[s]?\b|banking|lending|mortgage|loan|credit|debt|capital|asset[s]?\b|trade deficit|trade surplus|export|import|manufacturing|pmi\b|jobs|unemployment|payroll|wage[s]?\b|cost of living|housing|property|real estate|asx 200|all ordinaries|fortescue|\bbhp\b|rio tinto|woodside|santos|qantas|cba\b|commonwealth bank|\bnab\b|\banz\b|westpac|macquarie|bhp|woolworths|wesfarmers|newcrest|pilbara/.test(t);
}

// ── Fetch & build articles ────────────────────────────────────
async function fetchNews(): Promise<NewsArticle[]> {
  const FEEDS: Array<{ url: string; cap: number }> = [
    // ASX blue-chips + indices — today's AU market news (Yahoo aggregates Reuters, AP, etc.)
    { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EAXJO,BHP.AX,CBA.AX,RIO.AX,WBC.AX,NAB.AX,ANZ.AX,WOW.AX,CSL.AX,FMG.AX,MQG.AX,WDS.AX&region=AU&lang=en-AU", cap: 20 },
    // Global movers relevant to AU investors
    { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,NVDA,MSFT,AMZN,GOOGL,TSLA,BTC-USD,ETH-USD,%5EGSPC,%5EIXIC&region=US&lang=en-US", cap: 15 },
    // Commodities & FX
    { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC%3DF,SI%3DF,CL%3DF,NG%3DF,HG%3DF,AUDUSD%3DX&region=AU&lang=en-AU", cap: 12 },
    // ABC News — Australian Business & Economy (Tier 1 AU source)
    { url: "https://www.abc.net.au/news/feed/2942460/rss.xml", cap: 12 },
    // MarketWatch RSS — global markets
    { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", cap: 10 },
  ];

  const raw: Array<{ title: string; link: string; description: string; pubDate: string; source: string; sourceTier: number }> = [];

  await Promise.allSettled(
    FEEDS.map(async ({ url, cap }) => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; MaddexNewsBot/1.0; +https://maddex.app)" },
          signal: AbortSignal.timeout(9000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        raw.push(...parseRSS(xml).slice(0, cap));
      } catch (_) {}
    })
  );

  // Deduplicate by normalised title prefix, finance-gate, and prefer Tier 1/2 sources
  const seen = new Set<string>();
  const unique = raw.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 55);
    if (seen.has(key)) return false;
    seen.add(key);
    // Only include Tier 1/2 sources OR well-known financial articles from Tier 3
    if (item.sourceTier > 2 && !isFinanceRelevant(item.title, item.description)) return false;
    return isFinanceRelevant(item.title, item.description);
  });

  const now = Date.now();

  const articles: NewsArticle[] = unique.slice(0, 30).map((item, i) => {
    const pub = item.pubDate ? new Date(item.pubDate).getTime() : now;
    const ageMinutes = Math.max(0, Math.floor((now - pub) / 60_000));

    let ageStr: string;
    if (ageMinutes < 60) ageStr = `${ageMinutes}m ago`;
    else if (ageMinutes < 1440) ageStr = `${Math.floor(ageMinutes / 60)}h ago`;
    else ageStr = `${Math.floor(ageMinutes / 1440)}d ago`;

    const category = categorise(item.title, item.description);
    const { sentiment, conf } = quickSentiment(item.title);
    const score = impactScore(category, item.title, item.description, ageMinutes, item.sourceTier);

    return {
      id: `n${i}-${item.title.slice(0, 18).replace(/\s/g, "")}`,
      headline: item.title,
      summary: item.description || "Tap to read the full article.",
      url: item.link,
      source: item.source,
      sourceTier: item.sourceTier,
      publishedAt: new Date(pub).toISOString(),
      ageStr,
      ageMinutes,
      category,
      categoryColor: CATEGORY_COLORS[category] ?? "#6B7280",
      aiSentiment: sentiment,
      aiConf: conf,
      impactScore: score,
      priority: score >= 72 ? "high" : "normal",
    };
  });

  return articles.sort((a, b) => b.impactScore - a.impactScore);
}

// ── Article text extractor ────────────────────────────────────
// Attempts to isolate the article body from HTML, with quality gating.
// Returns { text, quality } where quality is "good" | "poor".
function extractArticleText(html: string): { text: string; quality: "good" | "poor" } {
  // ── Step 1: Try to narrow to article-specific containers ──────
  // Try semantic elements first, then common content div patterns
  const CONTAINER_PATTERNS = [
    // Semantic article tag
    /<article(?:\s[^>]*)?>([\s\S]*?)<\/article>/i,
    // <main> element
    /<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i,
    // Divs with content-related class or id names
    /<div[^>]+(?:class|id)="[^"]*(?:article[-_]?body|story[-_]?body|post[-_]?body|entry[-_]?content|article[-_]?content|story[-_]?content|content[-_]?body|article[-_]?text|story[-_]?text|news[-_]?body|news[-_]?article)[^"]*"[^>]*>([\s\S]{600,}?)<\/div>/i,
    // Generic content/body divs (broader, used as last resort)
    /<div[^>]+(?:class|id)="[^"]*(?:content|body|story|article|post)[^"]*"[^>]*>([\s\S]{800,}?)<\/div>/i,
  ];

  let target = html;
  for (const pat of CONTAINER_PATTERNS) {
    const m = html.match(pat);
    if (m) {
      const candidate = m[1] || m[0];
      if (candidate.length > 500) { target = candidate; break; }
    }
  }

  // ── Step 2: Strip boilerplate tags and normalise ──────────────
  const cleaned = target
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|noscript|figure|figcaption|iframe|svg|button|input|select|textarea)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|section|article|main|tr|td|th|span)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'").replace(/&rsquo;/g, "\u2019").replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D").replace(/&ldquo;/g, "\u201C")
    .replace(/&ndash;/g, "\u2013").replace(/&mdash;/g, "\u2014").replace(/&hellip;/g, "\u2026")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // ── Step 3: Quality gate ─────────────────────────────────────
  // Count tokens that look like real English words (≥4 consecutive alpha chars)
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const realWords = tokens.filter(t => /^[A-Za-z]{4,}$/.test(t)).length;
  const density = tokens.length > 0 ? realWords / tokens.length : 0;

  // Good = at least 30% readable words AND at least 400 chars
  if (density < 0.30 || cleaned.length < 400) {
    return { text: "", quality: "poor" };
  }

  return { text: cleaned.slice(0, 6000), quality: "good" };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ── GET /api/fetch-article ────────────────────────────────────
  // Fetches and extracts the plain text body of a news article URL.
  // Called client-side before sending to Claude so Claude gets full content.
  app.get("/api/fetch-article", async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ error: "Invalid URL" });
    }
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-AU,en;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return res.status(502).json({ error: `Upstream returned ${response.status}` });
      }
      const html = await response.text();
      const { text, quality } = extractArticleText(html);
      res.json({ content: text, quality, url });
    } catch (err: any) {
      res.status(502).json({ error: err.message || "Fetch failed" });
    }
  });

  // ── GET /api/news ─────────────────────────────────────────────
  app.get("/api/news", async (_req, res) => {
    try {
      const now = Date.now();
      if (newsCache && now - newsCache.fetchedAt < NEWS_CACHE_TTL) {
        return res.json({ articles: newsCache.articles, source: "cache", fetchedAt: newsCache.fetchedAt });
      }

      const articles = await fetchNews();

      if (articles.length > 0) {
        newsCache = { articles, fetchedAt: now };
      }

      res.json({ articles, source: "live", fetchedAt: now });
    } catch (err: any) {
      console.error("[news] error:", err.message);
      // Return stale cache on error rather than an empty result
      if (newsCache) {
        return res.json({ articles: newsCache.articles, source: "stale", fetchedAt: newsCache.fetchedAt });
      }
      res.status(500).json({ articles: [], error: "Failed to fetch news" });
    }
  });

  // ── GET /api/historical/:symbol ──────────────────────────────
  // Returns OHLC candle data for a given symbol and period.
  // Uses Alpha Vantage TIME_SERIES_DAILY (free tier). Falls back to
  // deterministic synthetic data when quota is exceeded.
  const HIST_CACHE = new Map<string, { data: any; fetchedAt: number }>();
  const HIST_TTL = 60 * 60 * 1000; // 1 hour

  function syntheticHistory(symbol: string, currentPrice: number, days: number): { t: string; o: number; h: number; l: number; c: number; v: number }[] {
    // Deterministic walk seeded by symbol so the same stock always gets the same "history"
    let seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return ((seed >>> 0) / 0xffffffff); };
    const result: { t: string; o: number; h: number; l: number; c: number; v: number }[] = [];
    let price = currentPrice / (1 + (rand() - 0.5) * 0.25); // start slightly different to today
    const now = new Date();
    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      // skip weekends for equity-like feel
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const drift = (rand() - 0.48) * 0.02; // slight upward bias
      const vol   = rand() * 0.015;
      const open  = price;
      price = open * (1 + drift);
      const high  = Math.max(open, price) * (1 + rand() * vol);
      const low   = Math.min(open, price) * (1 - rand() * vol);
      result.push({
        t: d.toISOString().slice(0, 10),
        o: parseFloat(open.toFixed(4)),
        h: parseFloat(high.toFixed(4)),
        l: parseFloat(low.toFixed(4)),
        c: parseFloat(price.toFixed(4)),
        v: Math.round(rand() * 5_000_000),
      });
    }
    return result;
  }

  app.get("/api/historical/:symbol", async (req, res) => {
    const rawSymbol = (req.params.symbol || "").toUpperCase().trim();
    if (!rawSymbol) return res.status(400).json({ error: "symbol required" });

    const period = (req.query.period as string) || "3M";
    const periodDays: Record<string, number> = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
    const days = periodDays[period] ?? 90;

    const cacheKey = `${rawSymbol}:${period}`;
    const cached = HIST_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < HIST_TTL) {
      return res.json(cached.data);
    }

    const AV_KEY = process.env.VITE_ALPHA_VANTAGE_KEY || "demo";

    // Determine asset class and resolve symbol for Alpha Vantage
    // Crypto uses DIGITAL_CURRENCY_DAILY; equities use TIME_SERIES_DAILY
    const CRYPTO_IDS = new Set(["BTC","ETH","SOL","XRP","BNB","ADA","DOGE","AVAX","DOT","LINK","MATIC","SHIB","TRX","LTC","UNI","ATOM","NEAR","XLM","ICP","INJ"]);
    const isCrypto = CRYPTO_IDS.has(rawSymbol);

    // Build the clean exchange symbol (strip .AX suffix for AV)
    const avSymbol = rawSymbol.replace(/\.AX$/, "");

    try {
      let candles: { t: string; o: number; h: number; l: number; c: number; v: number }[] = [];
      let usedFallback = false;

      if (AV_KEY !== "demo") {
        const endpoint = isCrypto
          ? `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=${avSymbol}&market=AUD&apikey=${AV_KEY}`
          : `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${avSymbol}&outputsize=compact&apikey=${AV_KEY}`;

        const avRes = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
        if (avRes.ok) {
          const avJson = await avRes.json();

          if (isCrypto) {
            const series = avJson["Time Series (Digital Currency Daily)"];
            if (series && !avJson["Note"] && !avJson["Information"]) {
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - days);
              candles = Object.entries(series)
                .filter(([date]) => new Date(date) >= cutoff)
                .map(([date, vals]: [string, any]) => ({
                  t: date,
                  o: parseFloat(vals["1a. open (AUD)"] ?? vals["1. open"]),
                  h: parseFloat(vals["2a. high (AUD)"] ?? vals["2. high"]),
                  l: parseFloat(vals["3a. low (AUD)"]  ?? vals["3. low"]),
                  c: parseFloat(vals["4a. close (AUD)"]?? vals["4. close"]),
                  v: parseFloat(vals["5. volume"] ?? 0),
                }))
                .sort((a, b) => a.t.localeCompare(b.t));
            }
          } else {
            const series = avJson["Time Series (Daily)"];
            if (series && !avJson["Note"] && !avJson["Information"]) {
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - days);
              candles = Object.entries(series)
                .filter(([date]) => new Date(date) >= cutoff)
                .map(([date, vals]: [string, any]) => ({
                  t: date,
                  o: parseFloat(vals["1. open"]),
                  h: parseFloat(vals["2. high"]),
                  l: parseFloat(vals["3. low"]),
                  c: parseFloat(vals["5. adjusted close"] ?? vals["4. close"]),
                  v: parseInt(vals["6. volume"] ?? vals["5. volume"] ?? "0"),
                }))
                .sort((a, b) => a.t.localeCompare(b.t));
            }
          }
        }
      }

      // Fallback: generate synthetic data anchored to current price supplied by client
      if (candles.length < 5) {
        usedFallback = true;
        const seedPrice = parseFloat((req.query.price as string) || "100");
        candles = syntheticHistory(rawSymbol, isNaN(seedPrice) ? 100 : seedPrice, days);
      }

      const payload = { symbol: rawSymbol, period, days, candles, synthetic: usedFallback };
      HIST_CACHE.set(cacheKey, { data: payload, fetchedAt: Date.now() });
      res.json(payload);
    } catch (err: any) {
      // Even on error, return synthetic data so the UI always has something
      const seedPrice = parseFloat((req.query.price as string) || "100");
      const candles = syntheticHistory(rawSymbol, isNaN(seedPrice) ? 100 : seedPrice, days);
      res.json({ symbol: rawSymbol, period, days, candles, synthetic: true });
    }
  });

  // ── Auth ─────────────────────────────────────────────────────

  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, firstName, lastName, country } = req.body;
    if (!email || !password || !firstName || !lastName)
      return res.status(400).json({ error: "Missing required fields" });
    const client = await pool.connect();
    try {
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
      if (existing.rows.length > 0) return res.status(409).json({ error: "An account with this email already exists" });
      const hash = await bcrypt.hash(password, 12);
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, full_name, country)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, full_name, avatar_url`,
        [email.toLowerCase(), hash, firstName.trim(), lastName.trim(), fullName, country || "Australia"]
      );
      const user = userRes.rows[0];
      await client.query(
        `INSERT INTO user_profiles (id, knowledge_level, risk_profile, subscription_tier, newsletter_enabled)
         VALUES ($1, 'Beginner', 'Moderate', 'Trial', false)`,
        [user.id]
      );
      const token = signToken(user.id);
      res.json({ token, user });
    } finally { client.release(); }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT id, email, password_hash, first_name, last_name, full_name, avatar_url, deleted_at FROM users WHERE email = $1",
        [email.toLowerCase()]
      );
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: "Invalid email or password" });
      if (user.deleted_at) return res.status(401).json({ error: "This account has been deleted" });
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Invalid email or password" });
      const { password_hash: _, deleted_at: __, ...safeUser } = user;
      const token = signToken(safeUser.id);
      res.json({ token, user: safeUser });
    } finally { client.release(); }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const userId = (req as any).userId;
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT id, email, first_name, last_name, full_name, avatar_url, deleted_at FROM users WHERE id = $1",
        [userId]
      );
      const user = result.rows[0];
      if (!user || user.deleted_at) return res.status(401).json({ error: "User not found" });
      const { deleted_at: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } finally { client.release(); }
  });

  app.post("/api/auth/update-email", requireAuth, async (req, res) => {
    const userId = (req as any).userId;
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });
    const client = await pool.connect();
    try {
      const existing = await client.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email.toLowerCase(), userId]);
      if (existing.rows.length > 0) return res.status(409).json({ error: "Email already in use" });
      await client.query("UPDATE users SET email = $1 WHERE id = $2", [email.toLowerCase(), userId]);
      res.json({ success: true });
    } finally { client.release(); }
  });

  app.post("/api/auth/update-password", requireAuth, async (req, res) => {
    const userId = (req as any).userId;
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const client = await pool.connect();
    try {
      const hash = await bcrypt.hash(password, 12);
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
      res.json({ success: true });
    } finally { client.release(); }
  });

  // ── Profile ───────────────────────────────────────────────────

  app.get("/api/profile/:userId", requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const [uRes, pRes] = await Promise.all([
        client.query("SELECT first_name, last_name, full_name, avatar_url, country FROM users WHERE id = $1", [req.params.userId]),
        client.query("SELECT * FROM user_profiles WHERE id = $1", [req.params.userId]),
      ]);
      const u = uRes.rows[0] || {};
      const p = pRes.rows[0] || {};
      res.json({ profile: { ...p, ...u, id: req.params.userId, avatar_url: p.avatar_url || u.avatar_url } });
    } finally { client.release(); }
  });

  app.put("/api/profile/:userId", requireAuth, async (req, res) => {
    const { first_name, last_name, full_name, country, knowledge_level, risk_profile, income_bracket, goals, life_stage, newsletter_enabled } = req.body;
    const client = await pool.connect();
    try {
      await client.query(
        "UPDATE users SET first_name=$1, last_name=$2, full_name=$3, country=$4 WHERE id=$5",
        [first_name, last_name, full_name, country, req.params.userId]
      );
      await client.query(
        `INSERT INTO user_profiles (id, knowledge_level, risk_profile, income_bracket, goals, life_stage, newsletter_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET knowledge_level=$2, risk_profile=$3, income_bracket=$4, goals=$5, life_stage=$6, newsletter_enabled=$7`,
        [req.params.userId, knowledge_level, risk_profile, income_bracket, goals, life_stage, newsletter_enabled ?? false]
      );
      const [uRes, pRes] = await Promise.all([
        client.query("SELECT first_name, last_name, full_name, avatar_url, country FROM users WHERE id=$1", [req.params.userId]),
        client.query("SELECT * FROM user_profiles WHERE id=$1", [req.params.userId]),
      ]);
      res.json({ profile: { ...pRes.rows[0], ...uRes.rows[0], id: req.params.userId } });
    } finally { client.release(); }
  });

  app.post("/api/profile/:userId/avatar", requireAuth, async (req, res) => {
    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: "Missing image data" });
    const client = await pool.connect();
    try {
      await client.query("UPDATE users SET avatar_url=$1 WHERE id=$2", [base64, req.params.userId]);
      await client.query("UPDATE user_profiles SET avatar_url=$1 WHERE id=$2", [base64, req.params.userId]);
      res.json({ avatar_url: base64 });
    } finally { client.release(); }
  });

  app.delete("/api/profile/:userId", requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM portfolio_items WHERE user_id=$1", [req.params.userId]);
      await client.query("DELETE FROM watchlist_items WHERE user_id=$1", [req.params.userId]);
      await client.query("DELETE FROM user_profiles WHERE id=$1", [req.params.userId]);
      await client.query("UPDATE users SET deleted_at=NOW() WHERE id=$1", [req.params.userId]);
      res.json({ success: true });
    } finally { client.release(); }
  });

  // ── Portfolio ─────────────────────────────────────────────────

  app.get("/api/portfolio/:userId", requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM portfolio_items WHERE user_id=$1 ORDER BY created_at DESC",
        [req.params.userId]
      );
      res.json({ items: result.rows });
    } finally { client.release(); }
  });

  app.post("/api/portfolio/:userId", requireAuth, async (req, res) => {
    const { asset_symbol, asset_name, asset_type, asset_sector, shares } = req.body;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO portfolio_items (user_id, asset_symbol, asset_name, asset_type, asset_sector, shares)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.userId, asset_symbol, asset_name, asset_type, asset_sector, shares]
      );
      res.json({ item: result.rows[0] });
    } finally { client.release(); }
  });

  app.patch("/api/portfolio/item/:id", requireAuth, async (req, res) => {
    const { shares } = req.body;
    const client = await pool.connect();
    try {
      const result = await client.query(
        "UPDATE portfolio_items SET shares=$1 WHERE id=$2 RETURNING *",
        [shares, req.params.id]
      );
      res.json({ item: result.rows[0] });
    } finally { client.release(); }
  });

  app.delete("/api/portfolio/item/:id", requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM portfolio_items WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } finally { client.release(); }
  });

  // ── Watchlist ─────────────────────────────────────────────────

  app.get("/api/watchlist/:userId", requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM watchlist_items WHERE user_id=$1 ORDER BY created_at DESC",
        [req.params.userId]
      );
      res.json({ items: result.rows });
    } finally { client.release(); }
  });

  app.post("/api/watchlist/:userId", requireAuth, async (req, res) => {
    const { asset_symbol, asset_name, asset_type, asset_sector } = req.body;
    const client = await pool.connect();
    try {
      const existing = await client.query(
        "SELECT id FROM watchlist_items WHERE user_id=$1 AND asset_symbol=$2",
        [req.params.userId, asset_symbol]
      );
      if (existing.rows.length > 0) return res.json({ item: existing.rows[0] });
      const result = await client.query(
        `INSERT INTO watchlist_items (user_id, asset_symbol, asset_name, asset_type, asset_sector)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.params.userId, asset_symbol, asset_name, asset_type, asset_sector]
      );
      res.json({ item: result.rows[0] });
    } finally { client.release(); }
  });

  app.delete("/api/watchlist/item/:id", requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM watchlist_items WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } finally { client.release(); }
  });

  const httpServer = createServer(app);
  return httpServer;
}
