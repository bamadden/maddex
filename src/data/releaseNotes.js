// Release notes — one list, read by the What's New modal (shown once per
// APP_VERSION) and by Settings → About. Bump package.json's version and add
// a release here together; every item must name something that shipped.
export const RELEASES = [
  {
    version: '0.2.0-beta',
    date: '2026-10-22',
    items: [
      { title: 'Weekly market review', desc: 'Written after the Friday close and kept up all weekend — the week in review, its themes, macro and the week ahead.' },
      { title: 'Portfolio CSV import & export', desc: 'Bring holdings in from a broker export with a row-by-row preview, keep separate purchase lots, and export with P&L.' },
      { title: 'Advanced price alerts', desc: 'Percentage moves, volume against the 20-day average, and 52-week highs and lows, alongside price levels.' },
      { title: 'Investor profile', desc: 'Your experience, focus and risk tolerance shape MaddenAI’s answers and the morning brief.' },
      { title: 'Browser notifications', desc: 'Alerts, high-impact events and brief-ready notices delivered by your operating system when Maddex is in the background.' },
      { title: 'Official data checks', desc: 'RBA, ABS and US figures checked against the agencies’ own data, with any drift flagged.' },
      { title: 'ETF Explorer', desc: '21 Australian ETFs with a fee-drag calculator and side-by-side comparison.' },
      { title: 'Bonds', desc: 'The full maturity spectrum, 1M to 50Y, across five sovereign markets.' },
      { title: 'Financial calculators', desc: 'Eleven tools across investment, super, property, tax and loans.' },
      { title: 'Futures & options', desc: 'Contract specifications, implied rates and a Black-Scholes options calculator with the greeks.' },
    ],
  },
]

export const LATEST_RELEASE = RELEASES[0]
