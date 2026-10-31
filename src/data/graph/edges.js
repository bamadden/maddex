// Relationships graph — edges. Every row carries its source; see schema.js
// for what each confidence level means and TODO.md for what is still missing.
//
// Nothing here is generated. Rows were read from the document named in their
// source on the date given, by a person.

import { TOP20, PEOPLE, personId } from './nodes.js'
import { COMPANY_FACTS, INDEX_CODE, factsSource } from './companyFacts.js'
import { COMMODITY_WEIGHTS } from './commodityWeights.js'

const READ = '2026-10-31'
const ANN = (path) => `https://announcements.asx.com.au/asxpdf/${path}.pdf`
const asxProfile = (sym) => ({ label: `ASX company profile — ${sym}`, url: `https://www.asx.com.au/markets/company/${sym}`, date: READ })

const edge = (from, type, to, confidence, source, extra = {}) =>
  ({ from, type, to, weight: null, confidence, source, lastVerified: READ, ...extra })

// ── Ownership — read from the primary document ────────────────────────────
// Ten were asked for. Nine are here: the notices for top-20 companies could
// not be reached in this pass (TODO.md). A Macquarie notice for Contact
// Energy (5.04%, 20 May 2026) was left out deliberately: it was an
// underwriting position on Infratil's sell-down, transient by design, and
// would read as an investment it is not.
const TCL_CPPIB = { label: 'Transurban ASX release: acquisition of CPPIB interests in NWRG and STP', url: ANN('20261001/pdf/074src9yl556mn'), date: '2026-10-01' }
const OWNERSHIP = [
  edge('TCL', 'owns', 'co:nwrg', 'VERIFIED', TCL_CPPIB, { weight: 50, note: 'Rises to 75.0% on completion of the CPPIB acquisition (conditional).' }),
  edge('TCL', 'owns', 'co:stp', 'VERIFIED', TCL_CPPIB, { weight: 50, note: 'Rises to 60.5% on completion of the CPPIB acquisition (conditional).' }),
  edge('fund:cppib', 'owns', 'co:nwrg', 'VERIFIED', TCL_CPPIB, { weight: 25, note: 'Being sold to Transurban (conditional).' }),
  edge('fund:cppib', 'owns', 'co:stp', 'VERIFIED', TCL_CPPIB, { weight: 10.5, note: 'Being sold to Transurban (conditional).' }),
  edge('WES', 'owns', 'BWP', 'VERIFIED',
    { label: 'BWP investor presentation, 6 May 2026 ("BWP\'s largest securityholder")', url: ANN('20260506/pdf/06z9c43p7cht8l'), date: '2026-05-06' },
    { weight: 23.4 }),
  edge('FMG', 'owns', 'MAG', 'VERIFIED',
    { label: 'Form 604, Fortescue / FMG Resources / Tattarang — Magmatic Resources', url: ANN('20250702/pdf/06ldbvztkpvwgy'), date: '2025-06-30' },
    { weight: 18.77, note: 'Voting power held with Tattarang (associate). Change dated 30 Jun 2025; check for a later notice.' }),
  edge('MQG', 'owns', 'PPT', 'VERIFIED',
    { label: 'Form 603, Macquarie Group — Perpetual', url: ANN('20250829/pdf/06nm78mn1qj5m0'), date: '2025-08-26' },
    { weight: 5.02, note: 'Became substantial 26 Aug 2025. Includes stock-lending and managed-fund interests.' }),
  edge('MQG', 'owns', 'LIC', 'VERIFIED',
    { label: 'Form 603, Macquarie Group — Lifestyle Communities', url: ANN('20250915/pdf/06p7pnzhvwsjj1'), date: '2025-09-10' },
    { weight: 5.99, note: 'Became substantial 10 Sep 2025. Includes stock-lending and managed-fund interests.' }),
  edge('MQG', 'owns', 'ACL', 'VERIFIED',
    { label: 'Form 603, Macquarie Group — Australian Clinical Labs', url: ANN('20250624/pdf/06l22ydrhdmkh4'), date: '2025-06-19' },
    { weight: 5.05, note: 'Became substantial 19 Jun 2025.' }),
]

// ── Substantial holders of the top 10 — from each latest annual report ──
// DISCLOSED: the company's own table of the substantial holding notices it
// has received, not the notices themselves. A percentage is carried only
// where the report prints one, and it is the holder's percentage at its own
// last notice, which can be years old (the note says when). Where the report
// gives share counts without a percentage, the edge has no weight: dividing
// an old notice's share count by today's share count would mix two dates.
// Block (XYZ) is a US company and publishes no such table (TODO.md); it is
// no longer an S&P/ASX 20 member either.
const NAB_AR = 'https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-annual-report.pdf'
const AR = {
  BHP: { label: 'BHP Annual Report 2026 — substantial shareholders, as at 9 Jul 2026', url: `${ANN('20260818/pdf/072vxpfhmy9lfk')}#page=238`, date: '2026-07-09' },
  CBA: { label: 'CBA 2026 Annual Report p342 — substantial shareholding, as at 11 Aug 2026', url: `${ANN('20260812/pdf/072nfthfnhfmbx')}#page=344`, date: '2026-08-11' },
  NAB: { label: 'NAB 2025 Annual Report — substantial shareholders, as at 10 Oct 2025', url: `${NAB_AR}#page=252`, date: '2025-10-10' },
  WBC: { label: 'Westpac 2025 Annual Report p248 — substantial shareholders, as at 30 Sep 2025', url: 'https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-annual-report-2025.pdf#page=248', date: '2025-09-30' },
  ANZ: { label: 'ANZ Group 2025 Annual Report — substantial shareholders, as at 1 Oct 2025', url: 'https://www.anz.com/content/dam/anzcom/shareholder/2025-annual-report/anz-2025-annual-report.pdf#page=226', date: '2025-10-01' },
  MQG: { label: 'Macquarie Group 2026 Annual Report — substantial shareholders, as at 31 Mar 2026', url: `${ANN('20260508/pdf/06zcwby8r05n9g')}#page=335`, date: '2026-03-31' },
  CSL: { label: 'CSL Annual Report 2026 — substantial shareholders, as at 31 Jul 2026', url: 'https://investors.csl.com/annualreport/2026/164/', date: '2026-07-31' },
  WES: { label: 'Wesfarmers 2026 Annual Report p206 — substantial shareholders, as at the report date', url: `${ANN('20260827/pdf/0738z357pt1vhl')}#page=209`, date: '2026-08-27' },
  WDS: { label: 'Woodside 2025 Annual Report p273 — substantial shareholders (released 24 Feb 2026)', url: `${ANN('20260224/pdf/06wnjpjvgshc5z')}#page=275`, date: '2026-02-24' },
  // Added 31 Oct 2026, for the S&P/ASX 20 members that joined the top ten
  // (GMG) or the list (COL, BXB).
  GMG: { label: 'Goodman Group Annual Report 2026 p288 — substantial securityholders, as at 31 Jul 2026', url: 'https://www.goodman.com/-/media/project/goodman/global/files/investor-centre/gmg-goodman-group/announcements/asx-announcements/2026/2-goodman-2026-annual-report-1.pdf#page=288', date: '2026-07-31' },
  COL: { label: 'Coles Group 2026 Annual Report — substantial shareholdings, as at 20 Jul 2026', url: 'https://www.colesgroup.com.au/FormBuilder/_Resource/_module/ir5sKeTxxEOndzdh00hWJw/file/Annual_Report.pdf#page=90', date: '2026-07-20' },
  BXB: { label: 'Brambles Annual Report 2026 p78 — substantial shareholders, as at 31 Jul 2026', url: 'https://www.brambles.com/Content/cms/FY26-Results/pdf/Brambles-FY26-Annual-Report-Print.pdf#page=80', date: '2026-07-31' },
}
const H = { ss: 'fund:state-street', br: 'fund:blackrock', vg: 'fund:vanguard', as: 'fund:australiansuper', citi: 'co:citigroup-gma' }
// asAt: the date of the holder's own notice where the report prints one —
// the figure is that old, whatever the report's date.
const holder = (co, h, weight, note, asAt) => edge(H[h], 'owns', co, 'DISCLOSED', AR[co], { weight, note, ...(asAt ? { asAt } : {}) })
const ANNUAL_REPORT_HOLDERS = [
  holder('BHP', 'ss', 7.13, 'At its last notice (change 30 Jan 2025).', '2025-01-30'),
  holder('BHP', 'br', 6.85, 'At its last notice (change 31 Jan 2022), plus ADRs worth 0.08%.', '2022-01-31'),
  holder('BHP', 'vg', 6.001, 'At its last notice (change 16 Apr 2025).', '2025-04-16'),
  holder('BHP', 'citi', 5.2988, 'At its last notice (change 12 May 2025). Likely stock lending or prime broking, not an investment: Citigroup Global Markets Australia\'s substantial-holder notices typically arise from securities-lending and market contracts (e.g. its Form 605 for Boss Energy, 6 Jun 2025, announcements.asx.com.au/asxpdf/20250606/pdf/06khyyx0y3x64j.pdf). Not confirmed for BHP: its own BHP notice has not been read.', '2025-05-12'),
  holder('CBA', 'ss', 7, 'At its last notice (as at 16 Dec 2024); the report rounds to whole per cent.', '2024-12-16'),
  holder('CBA', 'br', 6, 'At its last notice (as at 6 Mar 2020); the report rounds to whole per cent.', '2020-03-06'),
  holder('CBA', 'vg', 6, 'At its last notice (as at 28 Apr 2025); the report rounds to whole per cent.', '2025-04-28'),
  holder('NAB', 'ss', 7.24, 'At its last notice (as at 9 Jan 2025).', '2025-01-09'),
  holder('NAB', 'vg', 6.014, 'At its last notice (as at 19 Dec 2024).', '2024-12-19'),
  holder('NAB', 'br', 6.02, 'At its last notice (as at 18 Mar 2020).', '2020-03-18'),
  holder('NAB', 'as', 5.01, 'At its last notice (as at 19 Sep 2025).', '2025-09-19'),
  holder('WBC', 'br', null, 'Substantial (5%+) at 30 Sep 2025; report gives 221,964,794 securities as at 24 Mar 2020, no percentage.', '2020-03-24'),
  holder('WBC', 'ss', null, 'Substantial (5%+) at 30 Sep 2025; report gives 226,119,322 securities as at 6 Aug 2024, no percentage.', '2024-08-06'),
  holder('WBC', 'vg', null, 'Substantial (5%+) at 30 Sep 2025; report gives 206,182,459 securities as at 18 Dec 2024, no percentage.', '2024-12-18'),
  holder('ANZ', 'ss', 7.33, 'At its last notice (as at 16 Dec 2024).', '2024-12-16'),
  holder('ANZ', 'vg', 6.275, 'At its last notice (as at 15 May 2025).', '2025-05-15'),
  holder('ANZ', 'br', 6.07, 'At its last notice (as at 2 Dec 2019).', '2019-12-02'),
  holder('MQG', 'ss', null, 'Registered as substantial; report gives 26,047,723 shares, no percentage.'),
  holder('MQG', 'br', null, 'Registered as substantial; report gives 22,929,594 shares, no percentage.'),
  holder('MQG', 'vg', null, 'Registered as substantial; report gives 23,027,534 shares, no percentage.'),
  holder('CSL', 'ss', null, 'Substantial; report gives 39,466,383 shares, no percentage.'),
  holder('CSL', 'br', null, 'Substantial; report gives 33,347,498 shares plus 396,757 ADRs, no percentage.'),
  holder('CSL', 'vg', null, 'Substantial; report gives 29,109,134 shares, no percentage.'),
  holder('WES', 'ss', 7.14, 'As at the report date.'),
  holder('WES', 'br', 6.04, 'As at the report date.'),
  holder('WES', 'vg', 6.0, 'As at the report date.'),
  holder('WDS', 'ss', 8.13, 'At its last notice (change 4 Mar 2025).', '2025-03-04'),
  holder('WDS', 'as', 7.14, 'At its last notice (change 11 Mar 2025).', '2025-03-11'),
  holder('WDS', 'br', 7.03, 'At its last notice (change 5 Feb 2024), plus ADRs.', '2024-02-05'),
  holder('WDS', 'vg', 6.031, 'At its last notice (change 26 Sep 2024), plus ADRs.', '2024-09-26'),
  holder('GMG', 'br', null, 'Substantial; report gives 162,980,356 securities, no percentage.'),
  holder('GMG', 'ss', null, 'Substantial; report gives 201,652,872 securities, no percentage.'),
  holder('GMG', 'vg', null, 'Substantial; report gives 203,896,226 securities, no percentage.'),
  holder('COL', 'vg', null, 'Substantial; report gives 94,165,553 shares, no percentage.'),
  holder('COL', 'br', null, 'Substantial; report gives 83,226,846 shares, no percentage.'),
  holder('COL', 'ss', null, 'Substantial; report gives 97,093,717 shares, no percentage.'),
  holder('BXB', 'ss', 8.26, 'As disclosed in its substantial holding notice.'),
  holder('BXB', 'br', 8.12, 'As disclosed in its notice; also 0.12% through ADRs. (The report prints "8.122" — the trailing 2 is a footnote marker.)'),
  holder('BXB', 'vg', 6.01, 'As disclosed in its substantial holding notice.'),
]

// ── Customer — from the supplier's own disclosure ─────────────────────────
const CUSTOMERS = [
  edge('WES', 'customer_of', 'BWP', 'VERIFIED',
    { label: 'BWP investor presentation, 6 May 2026 (tenant concentration risk)', url: ANN('20260506/pdf/06z9c43p7cht8l'), date: '2026-05-06' },
    { weight: 76.7, weightLabel: '% of BWP gross income', note: 'Through Bunnings, a Wesfarmers business; as at 31 Dec 2025.' }),
]

// ── Commodity exposure ────────────────────────────────────────────────────
// DISCLOSED with a weight where the producer's latest annual report gives the
// revenue split (commodityWeights.js: % of revenue, both inputs quoted with
// their pages). Otherwise INFERRED from the company's own description of its
// business, unweighted.
const FMG_SITE = { label: 'Fortescue — What we do ("Nearly 200 million tonnes of iron ore…")', url: 'https://www.fortescue.com/en/what-we-do', date: READ }
const COMMODITY = [
  ['BHP', 'cmd:iron-ore'], ['BHP', 'cmd:copper'],
  ['RIO', 'cmd:iron-ore'], ['RIO', 'cmd:copper'],
  ['WDS', 'cmd:lng'], ['WDS', 'cmd:oil'],
  ['STO', 'cmd:oil'],
  ['NST', 'cmd:gold'], ['EVN', 'cmd:gold'],
  ['PLS', 'cmd:lithium'],
].map(([co, cmd]) => edge(co, 'exposed_to', cmd, 'INFERRED', asxProfile(co), { note: 'Producer; named in the company\'s own description. No segment split carried.' }))
  .concat([edge('FMG', 'exposed_to', 'cmd:iron-ore', 'INFERRED', FMG_SITE, { note: 'Producer. No segment split carried.' })])
  .map((e) => {
    const w = COMMODITY_WEIGHTS[`${e.from}|${e.to}`]
    if (!w) return e
    return edge(e.from, 'exposed_to', e.to, 'DISCLOSED', w.source, {
      weight: w.weight, weightLabel: w.weightLabel ?? '% of revenue', ...(w.weightTip ? { weightTip: w.weightTip } : {}), note: `${w.basis}.`,
      quote: w.numerator.quote, page: w.numerator.page, calc: { numerator: w.numerator, denominator: w.denominator },
    })
  })

// ── Rate exposure — INFERRED ──────────────────────────────────────────────
// The banks' margins and loan books move with the cash rate; the RBA's own
// explainer describes the channel. Which way, and by how much, is not on the
// edge — this graph shows exposure, not effect.
const RBA_TRANSMISSION = { label: 'RBA — The Transmission of Monetary Policy (explainer)', url: 'https://www.rba.gov.au/education/resources/explainers/the-transmission-of-monetary-policy.html', date: READ }
const RATES = ['CBA', 'NAB', 'WBC', 'ANZ'].map((b) =>
  edge(b, 'exposed_to', 'macro:rba-cash-rate', 'INFERRED', RBA_TRANSMISSION, { note: 'Bank lending and deposit rates follow the cash rate; GICS industry group Banks.' }))

// ── Indices and ETFs ──────────────────────────────────────────────────────
// What each ETF tracks is the fund's own statement (DISCLOSED).
const ETFS = [
  edge('etf:IOZ', 'exposed_to', 'idx:asx200', 'DISCLOSED',
    { label: 'iShares IOZ product page ("performance of the S&P/ASX 200 Accumulation Index")', url: 'https://www.blackrock.com/au/products/251852/ishares-core-sp-asx-200-etf', date: READ }, { note: 'Tracks the index.' }),
  edge('etf:VAS', 'exposed_to', 'idx:asx300', 'DISCLOSED',
    { label: 'Vanguard VAS product page (tracks the S&P/ASX 300; confirmed via Morningstar and Stockspot)', url: 'https://www.vanguard.com.au/personal/invest-with-us/etf?portId=8205', date: READ }, { note: 'Tracks the index.' }),
  edge('etf:A200', 'exposed_to', 'idx:solactive200', 'DISCLOSED',
    { label: 'Betashares A200 product page ("Solactive Australia 200 Index")', url: 'https://www.betashares.com.au/fund/australia-200-etf/', date: READ }, { note: 'Tracks the index.' }),
]
// S&P/ASX 20, 200 and 300 membership is DISCLOSED: each company's ASX
// profile lists the indices it is in (companyFacts.js, read 31 Oct 2026).
// Solactive Australia 200 is not on ASX profiles, so its membership stays
// INFERRED from market-cap rank — every S&P/ASX 20 company is far above its
// cut-off.
const SOLACTIVE = { label: 'Solactive Australia 200 — membership inferred from ASX market-cap rank (A200 page)', url: 'https://www.betashares.com.au/fund/australia-200-etf/', date: READ }
const MEMBERSHIP = [
  ...Object.entries(COMPANY_FACTS).flatMap(([t, f]) => f.indices.filter((code) => INDEX_CODE[code])
    .map((code) => edge(t, 'member_of', INDEX_CODE[code], 'DISCLOSED', factsSource(t), { note: `ASX lists ${t} in index ${code}.` }))),
  ...TOP20.map((t) => edge(t, 'member_of', 'idx:solactive200', 'INFERRED', SOLACTIVE)),
]

// ── Peers — INFERRED from the GICS industry group on each ASX profile ─────
const PEER_GROUPS = [
  ['Banks', ['CBA', 'NAB', 'WBC', 'ANZ']],
  ['Supermarkets (Consumer Staples Distribution & Retail)', ['WOW', 'COL']],
  ['Iron ore producers (Materials)', ['BHP', 'RIO', 'FMG']],
  ['Gold producers (Materials)', ['NST', 'EVN']],
  ['Oil and gas (Energy)', ['WDS', 'STO']],
]
const PEERS = PEER_GROUPS.flatMap(([group, members]) => members.flatMap((a, i) => members.slice(i + 1).map((b) =>
  edge(a, 'competes_with', b, 'INFERRED',
    { ...asxProfile(a), label: `ASX company profiles — GICS classification (${a}, ${b})` }, { note: `Peer group: ${group}.` }))))

// ── Directors — DISCLOSED, ASX company directory ──────────────────────────
const DIRECTORS = PEOPLE.flatMap(([name, roles]) => roles.map(([co, role, own]) =>
  edge(personId(name), 'director_of', co, 'DISCLOSED', own?.source ?? asxProfile(co), { note: role, ...(own?.quote ? { quote: own.quote } : {}) })))

export const EDGES = [...OWNERSHIP, ...ANNUAL_REPORT_HOLDERS, ...CUSTOMERS, ...COMMODITY, ...RATES, ...ETFS, ...MEMBERSHIP, ...PEERS, ...DIRECTORS]
