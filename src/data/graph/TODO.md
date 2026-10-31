# Relationships graph — what still needs real sourcing

Phase 1 seed, read 31 Oct 2026. Every edge in `edges.js` has a source; this
list is what is **missing** or **weaker than it should be**. Nothing here may
be filled in from memory or by MaddenAI — each item needs the document.

## Ownership

Phase 1.5 (31 Oct 2026) added the substantial holders of the ten largest
companies from each latest annual report, marked DISCLOSED. Nine of ten done:

- [ ] **XYZ (Block)** is US-incorporated and publishes no Australian
  substantial-holder table. Use its SEC 13G/13D filings, or treat its ASX
  CDIs separately.
- [ ] **WBC, MQG and CSL** report share counts but no percentages, so those
  edges carry no weight. Read each holder's latest notice for the percentage
  (and then mark it VERIFIED).
- [ ] Macquarie's report also lists Macquarie Group Limited itself as a
  substantial holder of its own shares (27,719,351 — group funds and
  employee plans). Left out as a self-edge. Decide how to show it.
- [ ] Several report percentages rest on old notices (BlackRock: CBA 2020,
  NAB 2020, ANZ 2019, BHP 2022). Re-check against the holders' latest
  notices.
- [ ] Holders ranked 11–20 by market cap: same annual-report method.

- [ ] **The holder notices themselves, to make these edges VERIFIED.** ASX's announcements API lists recent notices for these companies, but
  its document keys do not map to the public `displayAnnouncement.do?idsId=`
  link (tested: every key resolved to a different company's document). Its
  file endpoint needs an access token, and using one was refused in this
  session. Options:
  - Ben approves using the ASX file endpoint;
  - read the PDFs by hand from asx.com.au → company → announcements;
  - take the substantial-holder table from each company's annual report
    "shareholder information" section (it was not in the CBA or Telstra FY26
    annual report PDFs; it may be a separate document).
- [ ] FMG → MAG 18.77% is from a notice dated 30 Jun 2025. Check for a later
  one.
- [ ] TCL → NWRG / STP: switch to 75.0% / 60.5% when the CPPIB acquisition
  completes (1 Oct 2026 release; conditional). Retire the CPPIB edges then.
- [ ] Macquarie's three 5% holdings (PPT, LIC, ACL, 2025) include stock
  lending. Check whether a 605 (ceasing) notice has since been lodged.
- [ ] Tattarang (Andrew Forrest's company) and Fortescue: the ~36% figure
  seen in press was undated. It needs Fortescue's latest substantial-holder
  notice or annual report before it can be an edge.

## Commodity exposure (all INFERRED, unweighted)

- [ ] Segment revenue splits from the latest annual reports would make these
  DISCLOSED with a weight: BHP (iron ore, copper), RIO (iron ore, copper),
  WDS (LNG, oil), STO, NST, EVN, PLS, FMG.
- [ ] Missing producers: MIN (lithium and iron ore — its ASX description says
  only "Mining services"), S32, Santos LNG (its ASX description says natural
  gas, not LNG), copper from EVN and Sandfire.
- [ ] Coal, alumina, nickel and uranium are not modelled yet.

## Indices and ETFs

- [ ] Index membership is INFERRED from market-cap rank. Check against the
  S&P/ASX 200 and 300 constituent files and Solactive's composition, then
  mark DISCLOSED. Weights should come from the ETF holdings files (IOZ, VAS,
  A200 publish them daily).
- [ ] The VAS → S&P/ASX 300 edge is confirmed through Morningstar and
  Stockspot. Vanguard's own page renders client-side and was not readable;
  re-check it in a browser.
- [ ] The UI labels the list "TOP 20 BY ASX MARKET CAP, 30 OCT 2026 — NOT THE
  OFFICIAL S&P/ASX 20" until this is done. The top 20 is ranked by ASX-reported market cap, not the official
  S&P/ASX 20 (which is float-adjusted). Swap in the official list at the
  next quarterly rebalance.

## Peers, customers, suppliers

- [ ] Peers are GICS groupings only. Real competitive overlap (e.g. WOW ↔ COL,
  TLS ↔ TPG) needs COL and TPG added as nodes, with a source naming them as
  competitors.
- [ ] Customer and supplier edges: only WES → BWP (Bunnings, 76.7% of BWP
  gross income). Candidates with disclosed concentration:
  - iron ore miners → China (country-level; needs a country node type);
  - Telstra ↔ NBN Co;
  - Woodside LNG offtake contracts.

## People

- [x] Chaney resolved (31 Oct 2026): one person. Wesfarmers' 2026 Annual
  Report lists "Chairman of Northern Star Resources Limited (since July
  2021)". He left the Wesfarmers board at the 29 Oct 2026 AGM (final
  director's interest notice, 30 Oct), so only his NST edge remains.
- [ ] **WES chair:** Ken MacKenzie succeeds from the end of the 29 Oct 2026
  AGM, subject to his election there (WES ASX release, 28 Aug 2025). Read the
  "Results of 2026 Annual General Meeting" release (29 Oct) and add the edge.
  The ASX directory still listed Chaney on 31 Oct.
- [x] Macquarie CEO resolved: Shemara Wikramanayake (Macquarie 2026 Annual
  Report). **On 7 Nov 2026** replace her with Greg Ward. She retires on
  6 Nov, and Ward takes over from 7 Nov subject to approvals (Macquarie
  release, 23 Jul 2026). Confirm the approvals were received.

- [ ] Only chair and CEO so far; full boards would surface interlocks.

## Macro

- [ ] RBA cash rate → banks only. Mortgage-heavy REITs, Transurban
  (refinancing) and insurers' investment income need a source each before
  they get an edge.
- [ ] AUD/USD, China steel output and US Fed rate are obvious next macro
  nodes.

## Phase 2 — proposals and review (31 Oct 2026)

- [ ] **Three BWP proposals are waiting in REVIEW** (from the 6 May 2026
  presentation). All three duplicate edges already in the graph, and two
  carry the wrong type: the model called Wesfarmers' 23.4% stake "customer"
  and Bunnings a "supplier". Reject them, or fix the type and approve. They
  are a working sample of the queue.
- [ ] Set `VITE_GRAPH_REVIEWERS` in Vercel to your Supabase user id (not
  your email) to see the queue read-only in production. Unset, nobody sees
  it there.
- [ ] Run `npm run propose-edges` on the top-10 annual reports, using
  `--pages` to send only the relevant sections (an annual report in full is
  roughly 250k tokens). Customer, supplier and JV disclosures are where the
  graph is thinnest.
- [ ] Stale edges: most annual-report holder percentages rest on notices
  more than 12 months old (STALE in the panel). The holders' latest notices
  would refresh them.

## Phase 2.5 (31 Oct 2026)

- [x] **Official S&P/ASX 20.** TOP20 now matches the companies ASX lists in
  index XTL on their profiles (exactly 20). Block (XYZ) and ResMed (RMD) left
  the list; Coles (COL) and Brambles (BXB) joined. S&P/ASX 20, 200 and 300
  membership edges are now DISCLOSED from the same profiles. Re-read the
  profiles after each quarterly rebalance.
- [ ] **Goodman (GMG) is now #10 of the S&P/ASX 20** (Block left), and its
  annual-report substantial holders are not in yet. COL and BXB need the
  same treatment.
- [ ] Citigroup Global Markets Australia → BHP (5.2988%) carries a note that
  it is likely stock lending or prime broking. Read Citi's own BHP notice to
  confirm, then keep the edge or drop it.
- [ ] Company profile key facts NOT YET SOURCED for every company: financial
  year end, revenue, net profit, employees, auditor. Each needs the latest
  annual report, read by a person.
- [ ] Two BWP proposals (re-run with the corrected prompt) are waiting in
  REVIEW: Wesfarmers owns 23.4% of BWP (already in the graph, VERIFIED), and
  Bunnings is a customer of BWP at 76.7%. Bunnings is not a node; map it to
  WES or create it.
