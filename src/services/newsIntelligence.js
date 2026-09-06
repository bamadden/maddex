// Reading structure out of a news feed.
//
// Four things a terminal should do to a wire that a reader should not have to
// do themselves: name the companies a story is about, say how much it is
// likely to matter, group the four versions of the same story together, and
// say what the market is doing right now.
//
// All four are LEXICAL. Nothing here calls a model, and nothing here invents a
// figure: every output is a fact about the text it was given ("this headline
// contains the word Fortescue", "these two headlines share three rare terms")
// or about the clock. That matters because these annotations sit on top of
// real journalism, and an AI-generated impact score that looked authoritative
// while being a guess would be worse than no score at all.

// ─── Ticker extraction ───────────────────────────────────────────────────────
//
// The existing extractTickers in api.js matches uppercase tokens against a
// whitelist, which catches "BHP" and misses "Commonwealth Bank" — the form a
// journalist actually writes. This adds the company names.
//
// Order matters within an entry: longer, more specific names first, so
// "Commonwealth Bank" is not shadowed by a looser pattern. Each alias is
// matched with word boundaries — a bare substring test put "Port Moresby" in
// the shipping feed earlier in this project, and 'ANZ' inside another word or
// 'CSL' inside a URL is the same trap.
const COMPANY_TICKERS = [
  ['BHP.AX',  ['BHP', 'BHP Group', 'BHP Billiton']],
  ['CBA.AX',  ['Commonwealth Bank', 'CommBank', 'CBA']],
  ['CSL.AX',  ['CSL Limited', 'CSL']],
  ['WBC.AX',  ['Westpac', 'WBC']],
  ['ANZ.AX',  ['ANZ Group', 'ANZ Bank', 'ANZ']],
  ['NAB.AX',  ['National Australia Bank', 'NAB']],
  ['FMG.AX',  ['Fortescue Metals', 'Fortescue', 'FMG']],
  ['RIO.AX',  ['Rio Tinto', 'RIO']],
  ['WES.AX',  ['Wesfarmers', 'WES']],
  ['WOW.AX',  ['Woolworths', 'WOW']],
  ['MQG.AX',  ['Macquarie Group', 'Macquarie', 'MQG']],
  ['WDS.AX',  ['Woodside Energy', 'Woodside', 'WDS']],
  ['STO.AX',  ['Santos', 'STO']],
  ['NEM.AX',  ['Newmont', 'NCM', 'Newcrest']],
  ['TLS.AX',  ['Telstra', 'TLS']],
  ['QAN.AX',  ['Qantas', 'QAN']],
  ['COL.AX',  ['Coles Group', 'Coles', 'COL']],
  ['GMG.AX',  ['Goodman Group', 'GMG']],
  ['TCL.AX',  ['Transurban', 'TCL']],
  ['WTC.AX',  ['WiseTech Global', 'WiseTech', 'WTC']],
  ['XRO.AX',  ['Xero', 'XRO']],
  ['REA.AX',  ['REA Group', 'realestate.com.au']],
  ['ALL.AX',  ['Aristocrat Leisure', 'Aristocrat']],
  ['MIN.AX',  ['Mineral Resources', 'MinRes']],
  ['QBE.AX',  ['QBE Insurance', 'QBE']],
  ['AGL.AX',  ['AGL Energy', 'AGL']],
  ['S32.AX',  ['South32', 'S32']],
  ['PLS.AX',  ['Pilbara Minerals']],
  ['ORG.AX',  ['Origin Energy']],
  ['SUN.AX',  ['Suncorp']],
]

// Aliases of three characters or fewer are almost always the ticker itself, so
// they must match in capitals only — "all" the English word appears in most
// headlines, "ALL" the Aristocrat ticker does not. Longer names match
// case-insensitively, since a headline may title-case or sentence-case them.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const ALIAS_PATTERNS = COMPANY_TICKERS.map(([ticker, aliases]) => ({
  ticker,
  tests: aliases.map((a) => ({
    alias: a,
    re: new RegExp(`\\b${escapeRe(a)}\\b`, a.length <= 3 ? '' : 'i'),
  })),
}))

// Returns { ticker, matched } for every company named in the text.
export function extractCompanies(text) {
  const hay = String(text ?? '')
  if (!hay) return []
  const out = []
  for (const { ticker, tests } of ALIAS_PATTERNS) {
    const hit = tests.find((t) => t.re.test(hay))
    if (hit) out.push({ ticker, matched: hit.alias })
  }
  return out
}

// ─── Market impact ───────────────────────────────────────────────────────────
//
// A crude, transparent heuristic, and labelled as one in the UI. It reports
// what words are present, not what the market will do — the distinction the
// tooltip makes, because a confident-looking HIGH on a story that turns out to
// be routine is the kind of thing a reader would act on.
//
// Scored highest-first and returns on the first hit, so "RBA rate decision"
// does not get downgraded to LOW by the word "said" later in the sentence.
const IMPACT_RULES = [
  {
    level: 'HIGH',
    colour: '#A83232',
    re: /\b(RBA|rate decision|cash rate|interest rate decision|FOMC|Federal Reserve|GDP|CPI|inflation data|unemployment rate|merger|acquisition|takeover|profit warning|earnings|full[- ]year results|half[- ]year results|capital raising|administration|receivership)\b|\b(cut|cuts|slash\w*|lower\w*|downgrade\w*|withdraw\w*)\b[^.]{0,20}\bguidance\b/i,
  },
  {
    level: 'MED',
    colour: '#C9A84C',
    re: /\b(quarterly|trading update|guidance|outlook|analysts?|upgrade[sd]?|downgrade[sd]?|broker|dividend|buyback|appoint\w*|resign\w*|contract win|production report)\b/i,
  },
]

export function impactOf(text) {
  const hay = String(text ?? '')
  for (const rule of IMPACT_RULES) {
    if (rule.re.test(hay)) return { level: rule.level, colour: rule.colour }
  }
  return { level: 'LOW', colour: '#4A6080' }
}

// ─── Clustering ──────────────────────────────────────────────────────────────
//
// Four outlets covering one iron ore move should read as one item with three
// more behind it, not as four items crowding out everything else.
//
// Similarity is rare-term overlap. Common words carry no signal about whether
// two stories are the same story, so they are dropped; what is left is names,
// numbers and jargon, and two headlines sharing several of those are almost
// always about the same event.

const STOPWORDS = new Set(`a an and are as at be been but by for from has have how in into is it its
of on or that the their there these this to was were what when where which who will with after over under
says said new more most than then they you your we our us not no can could would should may might just
about against amid ahead as up down out off back one two three first last week month year day today
market markets stock stocks share shares price prices report reports`.split(/\s+/))

function terms(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s.$%-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  )
}

function overlap(a, b) {
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  const smaller = Math.min(a.size, b.size)
  return smaller === 0 ? 0 : shared / smaller
}

// Greedy single-pass clustering: each story joins the first cluster whose lead
// it is similar enough to, or starts its own. O(n·clusters) rather than the
// O(n²) of all-pairs, and it preserves feed order — the newest story of a
// group leads it, which is what a reader expects from a wire.
//
// Two stories also cluster when they share a company AND any meaningful term
// overlap, which catches "Fortescue guidance cut" beside "FMG lowers outlook"
// where wording differs but the subject does not.
export function clusterStories(articles, { threshold = 0.42, maxClusterSpanHours = 36 } = {}) {
  const clusters = []

  for (const a of articles) {
    const t = terms(`${a.headline} ${a.summary ?? ''}`)
    const companies = new Set((a.companies ?? []).map((c) => c.ticker))

    let placed = false
    for (const c of clusters) {
      // Only group stories close in time. The same words a year apart are two
      // different events, and merging them would hide the newer one.
      const hours = Math.abs((a.pubDate ?? 0) - (c.leadAt ?? 0)) / 3600000
      if (hours > maxClusterSpanHours) continue

      const sim = overlap(t, c.terms)
      const sharesCompany = [...companies].some((x) => c.companies.has(x))
      if (sim >= threshold || (sharesCompany && sim >= threshold * 0.6)) {
        c.items.push(a)
        for (const x of t) c.terms.add(x)
        for (const x of companies) c.companies.add(x)
        placed = true
        break
      }
    }

    if (!placed) {
      clusters.push({
        id: a.link ?? a.headline,
        items: [a],
        terms: t,
        companies,
        leadAt: a.pubDate ?? 0,
      })
    }
  }

  return clusters.map((c) => ({
    id: c.id,
    lead: c.items[0],
    items: c.items,
    count: c.items.length,
    // A label for multi-story clusters: the terms the group actually shares,
    // which is what makes them a group. Falls back to the lead headline's
    // opening words when nothing distinctive is common to all of them.
    label: c.items.length > 1 ? clusterLabel(c.items) : null,
  }))
}

function clusterLabel(items) {
  const sets = items.map((i) => terms(i.headline))
  const [first, ...rest] = sets
  const common = [...first].filter((t) => rest.every((s) => s.has(t)))
  const pick = common.filter((t) => /^[a-z]/i.test(t)).slice(0, 3)
  if (pick.length >= 2) return pick.join(' ').toUpperCase()
  return items[0].headline.split(/\s+/).slice(0, 4).join(' ').toUpperCase()
}

// ─── Market session ──────────────────────────────────────────────────────────
//
// Pinned to Australia/Brisbane for the same reason the morning brief is: a
// market session is a Sydney fact, and reading the browser's clock would tell
// a user in London that the ASX was open at 3am. Queensland has no daylight
// saving, so the boundary is a stable UTC+10 all year.
const AU_TZ = 'Australia/Brisbane'

function auParts(d = new Date()) {
  const s = d.toLocaleString('en-AU', {
    timeZone: AU_TZ, hour12: false,
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  })
  const weekday = s.slice(0, 3)
  const m = s.match(/(\d{2}):(\d{2})/)
  return { weekday, hour: m ? Number(m[1]) : 0, minute: m ? Number(m[2]) : 0 }
}

const OPEN_MIN = 10 * 60
const CLOSE_MIN = 16 * 60

export function marketSession(now = new Date()) {
  const { weekday, hour, minute } = auParts(now)
  const mins = hour * 60 + minute
  const weekend = weekday === 'Sat' || weekday === 'Sun'

  const fmtGap = (m) => {
    const h = Math.floor(m / 60)
    const r = m % 60
    return h > 0 ? `${h}h ${r}m` : `${r}m`
  }

  if (weekend) {
    return { key: 'weekend', label: 'WEEKEND', detail: 'ASX closed until Monday', colour: '#4A6080' }
  }
  if (mins >= 5 * 60 && mins < OPEN_MIN) {
    return { key: 'pre', label: 'PRE-MARKET', detail: `ASX opens in ${fmtGap(OPEN_MIN - mins)}`, colour: '#C9A84C' }
  }
  if (mins >= OPEN_MIN && mins < CLOSE_MIN) {
    return { key: 'open', label: 'MARKET OPEN', detail: `${fmtGap(CLOSE_MIN - mins)} remaining`, colour: '#2D8A50' }
  }
  if (mins >= CLOSE_MIN) {
    return { key: 'after', label: 'AFTER HOURS', detail: 'ASX closed', colour: '#8BA3C4' }
  }
  return { key: 'overnight', label: 'OVERNIGHT', detail: 'US markets active', colour: '#7C6BC4' }
}

// ─── Annotation ──────────────────────────────────────────────────────────────
//
// One pass that attaches everything above, plus whether the story touches the
// user's watchlist. Watchlist symbols arrive in either form (BHP or BHP.AX),
// so both are compared with the suffix stripped.
export function annotateArticles(articles = [], watchlist = []) {
  const watched = new Set(
    watchlist.map((w) => String(w).toUpperCase().replace(/\.AX$/, '')).filter(Boolean),
  )

  return articles.map((a) => {
    const text = `${a.headline} ${a.summary ?? ''}`
    const companies = extractCompanies(text)
    // Merge with whatever api.js already found, without duplicating.
    const seen = new Set(companies.map((c) => c.ticker))
    for (const t of a.tickers ?? []) {
      const norm = t.toUpperCase()
      const withSuffix = norm.endsWith('.AX') ? norm : `${norm}.AX`
      if (!seen.has(withSuffix) && !seen.has(norm)) {
        companies.push({ ticker: norm, matched: norm })
        seen.add(norm)
      }
    }
    const inWatchlist = companies.some((c) => watched.has(c.ticker.replace(/\.AX$/, '')))
    return { ...a, companies, impact: impactOf(text), inWatchlist }
  })
}
