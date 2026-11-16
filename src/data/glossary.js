// The glossary (WS2, 16 Nov 2026): plain definitions of the terms Maddex
// shows, searchable from the command bar. Maddex's own wording (editorial,
// registered as `glossary`): each says what a term means, never what to do
// about it, and holds no figures that change. `module` is where the term
// shows up; `see` names related terms.

export const GLOSSARY_REVIEWED = '2026-11-16'

export const GLOSSARY = [
  // ── Rates and the RBA ──
  { term: 'Cash rate', aka: ['cash rate target', 'official cash rate', 'policy rate'], module: 'fx',
    def: 'The interest rate on overnight loans between banks. The RBA sets a target for it at its Monetary Policy Board meetings, and it anchors other interest rates in Australia.' },
  { term: 'Basis point', aka: ['bp', 'bps'], module: 'fx',
    def: 'One hundredth of a percentage point: 25 basis points is 0.25 percentage points.' },
  { term: 'Monetary Policy Board', aka: ['RBA board', 'MPB'], module: 'fx',
    def: 'The RBA body that sets the cash rate target. Its decisions are announced in a statement after each scheduled meeting.' },
  { term: 'Market pricing', aka: ['implied probability', 'rate futures', 'priced in'], module: 'fx',
    def: 'What prices in rate futures imply about a coming decision. It is a reading of market prices on a date, not a forecast; Maddex shows one only with its source and date.' },
  { term: 'Policy rate', aka: ['central bank rate'], module: 'global',
    def: 'The interest rate a central bank uses to set monetary policy, such as the RBA cash rate or the US federal funds target range.' },
  { term: 'Federal funds target range', aka: ['fed funds', 'FOMC rate'], module: 'fx',
    def: 'The range the US Federal Reserve sets for its policy rate, decided at Federal Open Market Committee meetings.' },
  { term: 'Trade-weighted index', aka: ['TWI', 'AUD TWI'], module: 'fx',
    def: "The Australian dollar measured against a basket of trading partners' currencies, weighted by trade. The RBA publishes it daily." },

  // ── Inflation, jobs and growth ──
  { term: 'CPI', aka: ['consumer price index', 'inflation', 'headline inflation'], module: 'macro',
    def: 'A measure of the change in prices households pay for a fixed basket of goods and services. The ABS publishes it monthly and quarterly; the annual change is the usual headline figure.' },
  { term: 'Trimmed mean', aka: ['underlying inflation', 'core inflation'], module: 'macro',
    def: "A measure of inflation that leaves out the items with the largest price rises and falls in a period, so one-off moves count for less. It is one of the ABS's underlying measures." },
  { term: 'Inflation target', aka: ['RBA target band', 'target band'], module: 'macro',
    def: "The RBA's goal of keeping consumer price inflation between 2 and 3 per cent." },
  { term: 'Unemployment rate', aka: ['jobless rate', 'labour force'], module: 'macro',
    def: 'The share of the labour force without a job and looking for one, from the ABS Labour Force survey.' },
  { term: 'GDP', aka: ['gross domestic product', 'economic growth'], module: 'macro',
    def: "The value of goods and services an economy produces. Growth is usually given as the change in real (chain volume) GDP on the previous quarter or the same quarter a year earlier." },
  { term: 'NAIRU', aka: ['non-accelerating inflation rate of unemployment'], module: 'macro',
    def: 'An estimate of the lowest unemployment rate consistent with stable inflation. It cannot be observed directly, and the RBA publishes no single figure for it.' },

  // ── Bonds and yields ──
  { term: 'Bond yield', aka: ['yield', 'government bond'], module: 'bonds',
    def: "The annual return on a bond implied by its price, if held to maturity. Yields rise when prices fall." },
  { term: 'Yield curve', aka: ['curve', 'term structure'], module: 'bonds',
    def: 'Government bond yields plotted against their maturities, from short to long.' },
  { term: '2s10s spread', aka: ['curve spread', '2s10s'], module: 'bonds',
    def: 'The 10-year yield less the 2-year yield. Negative means the curve is inverted.' },
  { term: 'Inverted curve', aka: ['inversion', 'inverted yield curve'], module: 'bonds',
    def: 'A yield curve where short-dated yields are above long-dated ones.' },
  { term: 'Real yield', aka: ['inflation-adjusted yield'], module: 'bonds',
    def: 'A yield less inflation. Maddex states which inflation measure it uses wherever one is shown.' },

  // ── Shares and dividends ──
  { term: 'Franking credit', aka: ['imputation credit', 'franked dividend', 'dividend imputation'], module: 'portfolio',
    def: 'A credit for company tax already paid on profits paid out as a dividend. Australian residents can use it against their own tax; the dividend statement says how much is franked.' },
  { term: 'Ex-dividend date', aka: ['ex-div', 'ex date'], module: 'calendar',
    def: 'The first day a share trades without the right to the next dividend. A buyer on or after this date does not receive it.' },
  { term: 'Record date', aka: ['books close'], module: 'calendar',
    def: 'The date a company checks its register to see who receives a dividend.' },
  { term: 'Dividend reinvestment plan', aka: ['DRP', 'DRIP'], module: 'calculators',
    def: 'A plan that pays a dividend as new shares instead of cash.' },
  { term: 'Dividend yield', aka: ['yield on shares'], module: 'portfolio',
    def: "A year's dividends as a percentage of the share price. Yield on cost uses the price paid instead." },
  { term: 'P/E ratio', aka: ['price to earnings', 'PE'], module: 'screener',
    def: "A share price divided by earnings per share: what the market pays for each dollar of a company's earnings." },
  { term: 'Market capitalisation', aka: ['market cap'], module: 'screener',
    def: "A company's share price multiplied by its number of shares on issue." },
  { term: 'S&P/ASX 200', aka: ['ASX 200', 'XJO', 'the index'], module: 'markets',
    def: 'A share market index of about 200 of the largest companies listed on the ASX, weighted by the value of shares available to trade.' },
  { term: 'All Ordinaries', aka: ['All Ords', 'XAO'], module: 'markets',
    def: 'A broader ASX index of about 500 of the largest listed companies.' },
  { term: 'ETF', aka: ['exchange-traded fund', 'index fund'], module: 'etf',
    def: 'A fund that trades on an exchange like a share, usually tracking an index.' },
  { term: 'Management fee', aka: ['MER', 'expense ratio', 'ongoing fee'], module: 'etf',
    def: "What a fund charges each year, as a percentage of the amount invested, as stated by the issuer." },

  // ── Tax and super ──
  { term: 'CGT discount', aka: ['capital gains tax discount', '50% discount', 'capital gains tax'], module: 'calculators',
    def: 'For Australian individuals, half of a capital gain is taxed when the asset was held at least 12 months, not counting the days it was bought and sold.' },
  { term: 'Concessional contribution', aka: ['before-tax super', 'salary sacrifice'], module: 'calculators',
    def: 'A contribution to super made from before-tax income, such as employer contributions and salary sacrifice, taxed in the fund.' },
  { term: 'Superannuation Guarantee', aka: ['SG', 'super guarantee'], module: 'calculators',
    def: "The minimum an employer must pay into an employee's super, as a percentage of their ordinary earnings." },

  // ── Futures and commodities ──
  { term: 'Futures contract', aka: ['futures'], module: 'futures',
    def: 'An agreement to buy or sell something at a set price on a set future date, traded on an exchange.' },
  { term: 'Tick size', aka: ['tick', 'tick value'], module: 'futures',
    def: "The smallest price move a contract can make, and what that move is worth, as the exchange specifies." },
  { term: 'Margin', aka: ['initial margin'], module: 'futures',
    def: "The deposit a clearing house requires to hold a futures position. Losses can exceed it." },
  { term: 'Spot price', aka: ['spot'], module: 'global',
    def: 'The price for delivery now, rather than at a future date.' },

  // ── How Maddex labels data ──
  { term: 'LIVE', aka: ['live data'], module: 'dashboard',
    def: 'Fetched from the source this session and refreshing on its normal schedule.' },
  { term: 'DELAYED', aka: ['delayed data', 'end of day'], module: 'dashboard',
    def: 'From the source, but behind real time: the provider delays it, or it is a figure published on a schedule.' },
  { term: 'DEMO', aka: ['demo data', 'simulated'], module: 'dashboard',
    def: 'Simulated for demonstration. Not market data.' },
  { term: 'STALE', aka: ['stale data'], module: 'dashboard',
    def: 'The feed failed, so this is the last copy that arrived, shown with the time it was fetched.' },
  { term: 'Manually checked', aka: ['hand-entered', 'checked'], module: 'dashboard',
    def: "A figure a person read from the issuer's own page, shown with the date it was checked. It must be re-checked within 30 days." },
  { term: 'Data health', aka: ['DATA button', 'freshness'], module: 'dashboard',
    def: "How many of a module's datasets are within their maximum age today. The DATA button in each module header lists them with their sources and dates." },
  { term: 'Connected exposure', aka: ['ripple', 'event ripple'], module: 'relationships',
    def: 'Which companies a node reaches along sourced links in the Relationships graph. It says nothing about the direction or size of any price move.' },
]

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9%&/ ]/g, ' ').replace(/\s+/g, ' ').trim()

// Terms matching a query: a term or alias that starts with it ranks first,
// then one that contains it.
export function searchGlossary(raw, limit = 4) {
  const q = norm(raw ?? '')
  if (q.length < 2) return []
  const scored = []
  for (const g of GLOSSARY) {
    const names = [g.term, ...(g.aka ?? [])].map(norm)
    const score = names.some((n) => n === q) ? 3 : names.some((n) => n.startsWith(q)) ? 2 : names.some((n) => n.includes(q)) ? 1 : 0
    if (score) scored.push([score, g])
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, g]) => g)
}
