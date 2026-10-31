// Relationships graph — nodes.
//
// Kept separate from the edges so a page that only needs to know "is this
// ticker in the graph?" (the stock modal, the Global map) can import this
// small list without pulling in the edges or the graph module.
//
export const TOP20_LABEL = 'S&P/ASX 20 MEMBER — PER ASX COMPANY PROFILES, 31 OCT 2026'

// TOP 20: the S&P/ASX 20 constituents, as listed in the "indices" section of
// each company's ASX profile, read 31 Oct 2026 — exactly twenty companies
// carry index XTL. Numbered by the market cap on the same profiles (Friday
// 30 Oct close). This replaced a plain market-cap ranking on 31 Oct 2026:
// Block (XYZ) and ResMed (RMD) rank in the top 20 by market cap but are not
// in the index; Coles (COL) and Brambles (BXB) are. Sector and industry group
// are the GICS classifications on the same profiles. Re-read after each
// quarterly rebalance (third Friday of Mar, Jun, Sep, Dec).
//
// The other companies are in the graph because a sourced edge reaches them:
// a producer of a tracked commodity, or the other side of an ownership edge.

export const GRAPH_AS_OF = '2026-10-31'

const co = (ticker, name, sector, industry, country = 'AU', extra = {}) =>
  ({ id: ticker, type: 'company', name, ticker, sector, industry, country, ...extra })

export const TOP20 = ['BHP', 'CBA', 'NAB', 'WBC', 'ANZ', 'MQG', 'CSL', 'WES', 'WDS', 'GMG', 'RIO', 'TLS', 'WOW', 'FMG', 'TCL', 'QBE', 'ALL', 'NST', 'COL', 'BXB']

export const NODES = [
  // ── S&P/ASX 20, numbered by ASX-reported market cap, 30 Oct 2026 close ──
  co('BHP', 'BHP Group', 'Materials', 'Materials', 'AU', { top20: 1 }),
  co('CBA', 'Commonwealth Bank of Australia', 'Financials', 'Banks', 'AU', { top20: 2 }),
  co('NAB', 'National Australia Bank', 'Financials', 'Banks', 'AU', { top20: 3 }),
  co('WBC', 'Westpac Banking Corporation', 'Financials', 'Banks', 'AU', { top20: 4 }),
  co('ANZ', 'ANZ Group Holdings', 'Financials', 'Banks', 'AU', { top20: 5 }),
  co('MQG', 'Macquarie Group', 'Financials', 'Financial Services', 'AU', { top20: 6 }),
  co('CSL', 'CSL', 'Health Care', 'Pharmaceuticals, Biotechnology & Life Sciences', 'AU', { top20: 7 }),
  co('WES', 'Wesfarmers', 'Consumer Discretionary', 'Consumer Discretionary Distribution & Retail', 'AU', { top20: 8 }),
  co('WDS', 'Woodside Energy Group', 'Energy', 'Energy', 'AU', { top20: 9 }),
  co('GMG', 'Goodman Group', 'Real Estate', 'Equity REITs', 'AU', { top20: 10 }),
  co('RIO', 'Rio Tinto', 'Materials', 'Materials', 'AU', { top20: 11 }),
  co('TLS', 'Telstra Group', 'Communication Services', 'Telecommunication Services', 'AU', { top20: 12 }),
  co('WOW', 'Woolworths Group', 'Consumer Staples', 'Consumer Staples Distribution & Retail', 'AU', { top20: 13 }),
  co('FMG', 'Fortescue', 'Materials', 'Materials', 'AU', { top20: 14 }),
  co('TCL', 'Transurban Group', 'Industrials', 'Transportation', 'AU', { top20: 15 }),
  co('QBE', 'QBE Insurance Group', 'Financials', 'Insurance', 'AU', { top20: 16 }),
  co('ALL', 'Aristocrat Leisure', 'Consumer Discretionary', 'Consumer Services', 'AU', { top20: 17 }),
  co('NST', 'Northern Star Resources', 'Materials', 'Materials', 'AU', { top20: 18 }),
  co('COL', 'Coles Group', 'Consumer Staples', 'Consumer Staples Distribution & Retail', 'AU', { top20: 19 }),
  co('BXB', 'Brambles', 'Industrials', 'Commercial & Professional Services', 'AU', { top20: 20 }),

  // ── Large by market cap but not S&P/ASX 20 members (US-domiciled, ASX-listed CDIs) ──
  co('XYZ', 'Block, Inc.', 'Financials', 'Financial Services', 'US'),
  co('RMD', 'ResMed', 'Health Care', 'Health Care Equipment & Services', 'US'),

  // ── Producers of tracked commodities, outside the top 20 ──
  co('STO', 'Santos', 'Energy', 'Energy'),
  co('EVN', 'Evolution Mining', 'Materials', 'Materials'),
  co('PLS', 'PLS Group', 'Materials', 'Materials'),
  co('ORG', 'Origin Energy', 'Utilities', 'Utilities'),

  // ── The other side of a sourced ownership or customer edge ──
  co('BWP', 'BWP Group', 'Real Estate', 'Equity REITs'),
  co('PPT', 'Perpetual', 'Financials', 'Financial Services'),
  co('LIC', 'Lifestyle Communities', 'Real Estate', null),
  co('ACL', 'Australian Clinical Labs', 'Health Care', null),
  co('MAG', 'Magmatic Resources', 'Materials', 'Materials'),
  { id: 'co:nwrg', type: 'company', name: 'NorthWestern Roads Group (Westlink M7, NorthConnex)', ticker: null, sector: 'Industrials', country: 'AU' },
  { id: 'co:stp', type: 'company', name: 'Sydney Transport Partners (WestConnex)', ticker: null, sector: 'Industrials', country: 'AU' },
  { id: 'fund:cppib', type: 'fund', name: 'Canada Pension Plan Investment Board', ticker: null, sector: null, country: 'CA' },

  // ── Substantial holders named in the top-10 annual reports ──
  { id: 'fund:state-street', type: 'fund', name: 'State Street Corporation', ticker: null, sector: null, country: 'US' },
  { id: 'fund:blackrock', type: 'fund', name: 'BlackRock Group', ticker: null, sector: null, country: 'US' },
  { id: 'fund:vanguard', type: 'fund', name: 'The Vanguard Group', ticker: null, sector: null, country: 'US' },
  { id: 'fund:australiansuper', type: 'fund', name: 'AustralianSuper', ticker: null, sector: null, country: 'AU' },
  { id: 'co:citigroup-gma', type: 'company', name: 'Citigroup Global Markets Australia', ticker: null, sector: 'Financials', country: 'AU' },

  // ── Commodities ──
  { id: 'cmd:iron-ore', type: 'commodity', name: 'Iron ore' },
  { id: 'cmd:copper', type: 'commodity', name: 'Copper' },
  { id: 'cmd:gold', type: 'commodity', name: 'Gold' },
  { id: 'cmd:oil', type: 'commodity', name: 'Crude oil' },
  { id: 'cmd:lng', type: 'commodity', name: 'LNG' },
  { id: 'cmd:lithium', type: 'commodity', name: 'Lithium' },

  // ── Macro ──
  { id: 'macro:rba-cash-rate', type: 'macro', name: 'RBA cash rate', country: 'AU' },

  // ── Indices and the ETFs that track them ──
  { id: 'idx:asx20', type: 'index', name: 'S&P/ASX 20', ticker: 'XTL', country: 'AU' },
  { id: 'idx:asx200', type: 'index', name: 'S&P/ASX 200', country: 'AU' },
  { id: 'idx:asx300', type: 'index', name: 'S&P/ASX 300', country: 'AU' },
  { id: 'idx:solactive200', type: 'index', name: 'Solactive Australia 200', country: 'AU' },
  { id: 'etf:IOZ', type: 'etf', name: 'iShares Core S&P/ASX 200 ETF', ticker: 'IOZ', country: 'AU' },
  { id: 'etf:VAS', type: 'etf', name: 'Vanguard Australian Shares Index ETF', ticker: 'VAS', country: 'AU' },
  { id: 'etf:A200', type: 'etf', name: 'Betashares Australia 200 ETF', ticker: 'A200', country: 'AU' },
]

// People: chair and chief executive of each top-20 company as listed in the
// ASX company directory on 31 Oct 2026, read directly from each profile.
// One node per person — Scott Perkins chairs both WOW and ORG.
export const PEOPLE = [
  ['Ross McEwan', [['BHP', 'Chair']]], ['Brandon Craig', [['BHP', 'CEO']]],
  ["Paul O'Malley", [['CBA', 'Chair']]], ['Matthew Comyn', [['CBA', 'Managing Director & CEO']]],
  ['Philip Chronican', [['NAB', 'Chair']]], ['Andrew Irvine', [['NAB', 'Managing Director & CEO']]],
  ['Steven Gregg', [['WBC', 'Chair']]], ['Anthony Miller', [['WBC', 'Managing Director & CEO']]],
  ["Paul O'Sullivan", [['ANZ', 'Chair']]], ['Nuno Matos', [['ANZ', 'CEO']]],
  ['Glenn Stevens', [['MQG', 'Chair']]],
  // Macquarie 2026 Annual Report (8 May 2026), PDF p46; Macquarie release of
  // 23 Jul 2026: retires 6 Nov 2026, Greg Ward to succeed from 7 Nov subject
  // to approvals. Swap the edge on 7 Nov (TODO.md).
  ['Shemara Wikramanayake', [['MQG', 'Managing Director & CEO (retires 6 Nov 2026; Greg Ward from 7 Nov, subject to approvals)']]],
  ['Brian McNamee', [['CSL', 'Chair']]],
  // WES chair: Michael Chaney left the board at the 29 Oct 2026 AGM (final
  // director's interest notice lodged 30 Oct). Ken MacKenzie's chairmanship
  // is from Wesfarmers' own directors page, read 31 Oct 2026 — the ASX
  // directory still listed Chaney that day. A third element gives a role its
  // own source and quote when it is not from the ASX directory.
  ['Ken MacKenzie', [['WES', 'Chair', {
    source: { label: 'Wesfarmers — Directors (company website)', url: 'https://www.wesfarmers.com.au/who-we-are/directors', date: '2026-10-31' },
    quote: 'Ken MacKenzie Chairman Ken rejoined the Board as a non-executive director in June 2026 and became Chairman in October 2026.',
  }]]],
  ['Rob Scott', [['WES', 'Managing Director']]],
  ['Jack Dorsey', [['XYZ', 'Chair & CEO']]],
  ['Richard Goyder', [['WDS', 'Chair']]], ['Liz Westcott', [['WDS', 'Managing Director & CEO']]],
  ['Stephen Johns', [['GMG', 'Chair']]], ['Gregory Goodman', [['GMG', 'Managing Director & CEO']]],
  ['Dominic Barton', [['RIO', 'Chair']]], ['Simon Trott', [['RIO', 'CEO']]],
  ['Craig Dunn', [['TLS', 'Chair']]], ['Vicki Brady', [['TLS', 'CEO']]],
  ['Peter Farrell', [['RMD', 'Chair']]], ['Michael Farrell', [['RMD', 'CEO']]],
  ['Scott Perkins', [['WOW', 'Chair'], ['ORG', 'Chair']]], ['Amanda Bardwell', [['WOW', 'Managing Director & CEO']]],
  ['Andrew Forrest', [['FMG', 'Executive Chair']]],
  ['Craig Drummond', [['TCL', 'Chair']]], ['Michelle Jablko', [['TCL', 'CEO']]],
  ['Andrew Horton', [['QBE', 'CEO']]],
  ['Neil Chatfield', [['ALL', 'Chair']]], ['Trevor Croker', [['ALL', 'Managing Director & CEO']]],
  // One person: Wesfarmers' 2026 Annual Report (PDF p105) lists his other office
  // as "Chairman of Northern Star Resources Limited (since July 2021)".
  ['Michael Chaney', [['NST', 'Chair']]],
  ['Peter Allen', [['COL', 'Chair']]], ['Leah Weckert', [['COL', 'Managing Director']]],
  ['John Mullen', [['BXB', 'Chair']]], ['Graham Chipchase', [['BXB', 'CEO']]], ['Suresh Vadnagra', [['NST', 'Managing Director']]],
]

export const personId = (name) => `person:${name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`

export const ALL_NODES = [
  ...NODES,
  ...PEOPLE.map(([name]) => ({ id: personId(name), type: 'person', name })),
]

// "Is this ticker in the graph?" — for the Open in Relationships links.
const BY_TICKER = new Map(ALL_NODES.filter((n) => n.ticker).map((n) => [n.ticker, n.id]))
export const graphNodeForTicker = (sym) => BY_TICKER.get(String(sym ?? '').toUpperCase().replace(/\.AX$/, '')) ?? null

const BY_COMMODITY = { 'iron ore': 'cmd:iron-ore', copper: 'cmd:copper', gold: 'cmd:gold', 'crude oil': 'cmd:oil', oil: 'cmd:oil', lng: 'cmd:lng', lithium: 'cmd:lithium' }
export const graphNodeForCommodity = (name) => BY_COMMODITY[String(name ?? '').toLowerCase().trim()] ?? null
