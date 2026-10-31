# Relationships graph — what still needs real sourcing

Phase 1 seed, read 31 Oct 2026. Every edge in `edges.js` has a source; this
list is what is **missing** or **weaker than it should be**. Nothing here may
be filled in from memory or by MaddenAI — each item needs the document.

## Ownership (asked for 10; 9 shipped)

- [ ] **Substantial holders of the top-20 companies themselves.** None are in
  yet. ASX's announcements API lists recent notices for these companies, but
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
- [ ] The top 20 is ranked by ASX-reported market cap, not the official
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

- [ ] "Michael Alfred Chaney" (WES chair) and "Michael Chaney" (NST chair)
  are listed differently in the ASX directory. They are almost certainly the
  same person, but the graph only merges exact name matches. Confirm from
  each company's board page, then merge.
- [ ] MQG's ASX profile lists two managing director/CEOs (Greg Ward and
  Shemara Wikramanayake), so neither is in yet. Confirm the current CEO from
  macquarie.com.
- [ ] Only chair and CEO so far; full boards would surface interlocks.

## Macro

- [ ] RBA cash rate → banks only. Mortgage-heavy REITs, Transurban
  (refinancing) and insurers' investment income need a source each before
  they get an edge.
- [ ] AUD/USD, China steel output and US Fed rate are obvious next macro
  nodes.
