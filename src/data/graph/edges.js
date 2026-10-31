// Relationships graph — edges. Every row carries its source; see schema.js
// for what each confidence level means and TODO.md for what is still missing.
//
// Nothing here is generated. Rows were read from the document named in their
// source on the date given, by a person.

import { TOP20, PEOPLE, personId } from './nodes'

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

// ── Customer — from the supplier's own disclosure ─────────────────────────
const CUSTOMERS = [
  edge('WES', 'customer_of', 'BWP', 'VERIFIED',
    { label: 'BWP investor presentation, 6 May 2026 (tenant concentration risk)', url: ANN('20260506/pdf/06z9c43p7cht8l'), date: '2026-05-06' },
    { weight: 76.7, weightLabel: '% of BWP gross income', note: 'Through Bunnings, a Wesfarmers business; as at 31 Dec 2025.' }),
]

// ── Commodity exposure — INFERRED ─────────────────────────────────────────
// Each company names the commodity in its own description of its business,
// but none of these rows carries the company's reported segment split, so
// none is weighted. Adding the split from the latest annual report turns a
// row DISCLOSED with a weight (TODO.md).
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

// ── Rate exposure — INFERRED ──────────────────────────────────────────────
// The banks' margins and loan books move with the cash rate; the RBA's own
// explainer describes the channel. Which way, and by how much, is not on the
// edge — this graph shows exposure, not effect.
const RBA_TRANSMISSION = { label: 'RBA — The Transmission of Monetary Policy (explainer)', url: 'https://www.rba.gov.au/education/resources/explainers/the-transmission-of-monetary-policy.html', date: READ }
const RATES = ['CBA', 'NAB', 'WBC', 'ANZ'].map((b) =>
  edge(b, 'exposed_to', 'macro:rba-cash-rate', 'INFERRED', RBA_TRANSMISSION, { note: 'Bank lending and deposit rates follow the cash rate; GICS industry group Banks.' }))

// ── Indices and ETFs ──────────────────────────────────────────────────────
// What each ETF tracks is the fund's own statement (DISCLOSED). Which
// companies are in each index is INFERRED from market-cap rank — every top-20
// company is far above the cut-off for all three — until it is checked
// against the provider's constituent list.
const ETFS = [
  edge('etf:IOZ', 'exposed_to', 'idx:asx200', 'DISCLOSED',
    { label: 'iShares IOZ product page ("performance of the S&P/ASX 200 Accumulation Index")', url: 'https://www.blackrock.com/au/products/251852/ishares-core-sp-asx-200-etf', date: READ }, { note: 'Tracks the index.' }),
  edge('etf:VAS', 'exposed_to', 'idx:asx300', 'DISCLOSED',
    { label: 'Vanguard VAS product page (tracks the S&P/ASX 300; confirmed via Morningstar and Stockspot)', url: 'https://www.vanguard.com.au/personal/invest-with-us/etf?portId=8205', date: READ }, { note: 'Tracks the index.' }),
  edge('etf:A200', 'exposed_to', 'idx:solactive200', 'DISCLOSED',
    { label: 'Betashares A200 product page ("Solactive Australia 200 Index")', url: 'https://www.betashares.com.au/fund/australia-200-etf/', date: READ }, { note: 'Tracks the index.' }),
]
const INDEX_SOURCE = {
  'idx:asx200': { label: 'S&P/ASX 200 — membership inferred from ASX market-cap rank', url: 'https://www.spglobal.com/spdji/en/indices/equity/sp-asx-200/', date: READ },
  'idx:asx300': { label: 'S&P/ASX 300 — membership inferred from ASX market-cap rank', url: 'https://www.spglobal.com/spdji/en/indices/equity/sp-asx-300/', date: READ },
  'idx:solactive200': { label: 'Solactive Australia 200 — membership inferred from ASX market-cap rank (A200 page)', url: 'https://www.betashares.com.au/fund/australia-200-etf/', date: READ },
}
const MEMBERSHIP = TOP20.flatMap((t) => Object.entries(INDEX_SOURCE).map(([idx, src]) => edge(t, 'member_of', idx, 'INFERRED', src)))

// ── Peers — INFERRED from the GICS industry group on each ASX profile ─────
const PEER_GROUPS = [
  ['Banks', ['CBA', 'NAB', 'WBC', 'ANZ']],
  ['Iron ore producers (Materials)', ['BHP', 'RIO', 'FMG']],
  ['Gold producers (Materials)', ['NST', 'EVN']],
  ['Oil and gas (Energy)', ['WDS', 'STO']],
]
const PEERS = PEER_GROUPS.flatMap(([group, members]) => members.flatMap((a, i) => members.slice(i + 1).map((b) =>
  edge(a, 'competes_with', b, 'INFERRED',
    { ...asxProfile(a), label: `ASX company profiles — GICS classification (${a}, ${b})` }, { note: `Peer group: ${group}.` }))))

// ── Directors — DISCLOSED, ASX company directory ──────────────────────────
const DIRECTORS = PEOPLE.flatMap(([name, roles]) => roles.map(([co, role]) =>
  edge(personId(name), 'director_of', co, 'DISCLOSED', asxProfile(co), { note: role })))

export const EDGES = [...OWNERSHIP, ...CUSTOMERS, ...COMMODITY, ...RATES, ...ETFS, ...MEMBERSHIP, ...PEERS, ...DIRECTORS]
