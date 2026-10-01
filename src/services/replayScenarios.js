// ─── Replay scenario library ────────────────────────────────────────────────
//
// WHAT IS SOURCED AND WHAT IS NOT.
//
// Every figure in `facts`, every `anchors` level and every timeline entry is a
// published number or event, with its source listed on the scenario. Nothing
// here is a recollection dressed as data.
//
// The line the player draws BETWEEN anchors is not. A real intraday or daily
// series is not held for these windows, so the path is reconstructed: it
// passes exactly through every sourced anchor and wanders, deterministically,
// in between. The player labels it RECONSTRUCTED for that reason. The shape
// between two anchors is illustration; the anchors are the record.
//
// TIMES on intraday scenarios are Sydney local. An event appears only where
// its time is known — the brief that asked for "10:00am — ASX opens lower on
// RBA concerns" got neither the direction nor the cause right, so the
// opening is described by what was priced, not by a move nobody recorded.

export const CATEGORY_STYLE = {
  'CRISIS':       { colour: '#A83232', bg: 'rgba(168,50,50,0.14)' },
  'CENTRAL BANK': { colour: '#C9A84C', bg: 'rgba(201,168,76,0.14)' },
  'MACRO':        { colour: '#4A7FB5', bg: 'rgba(74,127,181,0.14)' },
  'COMMODITY':    { colour: '#2D8A50', bg: 'rgba(45,138,80,0.14)' },
}

export const SCENARIOS = [
  {
    id: 'rba-hike-sep-2026',
    title: 'RBA Sep 2026 Rate Hike',
    dateLabel: '29 Sep 2026',
    category: 'CENTRAL BANK',
    difficulty: 'INTERMEDIATE',
    duration: '1 day',
    description: 'The RBA lifted the cash rate 25bp to 4.60% — its fourth hike of 2026 and the highest since 2011. A hike was almost fully priced. How did markets take it?',
    window: { kind: 'intraday', date: '2026-09-29', from: '10:00', to: '16:00' },
    series: {
      label: 'ASX 200',
      unit: 'pts',
      dp: 0,
      // The prior close is derived from the sourced close and day change
      // (8,709 / 1.003); the open and intraday path are not recorded here.
      anchors: [
        { at: '10:00', value: 8683, note: 'Previous close (derived from close and day change)' },
        { at: '16:00', value: 8709, note: 'Close, +0.3%' },
      ],
    },
    facts: [
      { label: 'ASX 200', value: '+0.3%', tone: 'up', note: 'Closed at 8,709' },
      { label: 'AUD/USD', value: '−0.3%', tone: 'down', note: '70.18 → 69.93 US cents after the decision' },
      { label: 'Info Tech', value: '+4.6%', tone: 'up', note: 'Best sector' },
      { label: 'Materials', value: '+1.0%', tone: 'up' },
      { label: 'Energy', value: '−0.7%', tone: 'down' },
      { label: 'Utilities', value: '−0.8%', tone: 'down', note: 'Worst sector' },
    ],
    timeline: [
      { at: '10:00', text: 'ASX opens. Going into the meeting, markets priced a hike at roughly 92–94%.' },
      { at: '14:30', text: 'RBA lifts the cash rate 25bp to 4.60% — unanimous, the fourth hike of 2026.', key: true },
      { at: '14:30', text: 'AUD trading at 70.18 US cents as the decision lands.' },
      { at: '15:30', text: 'Governor Michele Bullock\'s press conference. The Board says further increases remain possible.' },
      { at: '15:30', text: 'AUD has slipped to 69.93 US cents — down 0.3% since the decision.' },
      { at: '16:00', text: 'ASX 200 closes +0.3% at 8,709. Info Tech +4.6% leads; utilities −0.8% and energy −0.7% lag.', key: true },
    ],
    lessons: [
      'Markets move on surprise, not on the decision itself. With a hike ~93% priced, the ASX finished higher and the AUD lower — the opposite of a textbook "hike" reaction.',
      'Sector leadership on the day came from Info Tech, not the rate-sensitive sectors the decision was about.',
    ],
    quiz: [
      { q: 'Which ASX sector led on decision day?', options: ['Financials', 'Info Tech', 'Real Estate', 'Utilities'], answer: 1, why: 'Info Tech rose 4.6%; utilities were the worst sector at −0.8%.' },
      { q: 'What did the AUD do in the hour after the hike?', options: ['Rose about 1%', 'Rose about 0.4%', 'Fell about 0.3%', 'Unchanged'], answer: 2, why: 'It went from 70.18 to 69.93 US cents — a 0.3% fall.' },
      { q: 'Why was the market reaction so muted?', options: ['The hike was a surprise', 'The hike was almost fully priced', 'The RBA cut instead', 'Markets were closed'], answer: 1, why: 'Pricing put a hike at roughly 92–94% beforehand, so there was little new information.' },
    ],
    sources: ['abc.net.au — markets live blog, 29 Sep 2026', 'rba.gov.au — media release mr-26-27'],
  },
  {
    id: 'covid-crash-2020',
    title: 'COVID-19 Market Crash',
    dateLabel: 'Feb – Mar 2020',
    category: 'CRISIS',
    difficulty: 'ADVANCED',
    duration: '22 trading days',
    description: 'From a record close on 20 Feb to the low on 23 Mar, the ASX 200 lost more than a third of its value as the pandemic shut economies down.',
    window: { kind: 'days', from: '2020-02-20', to: '2020-03-23' },
    series: {
      label: 'ASX 200',
      unit: 'pts',
      dp: 0,
      anchors: [
        { at: '2020-02-20', value: 7162, note: 'Record close' },
        { at: '2020-03-23', value: 4546, note: 'Close at the low, −5.6% on the day' },
      ],
    },
    facts: [
      { label: 'ASX 200', value: '−36.5%', tone: 'down', note: '7,162 → 4,546 close to close' },
      { label: 'AUD/USD low', value: '0.5510', tone: 'down', note: '19 Mar — lowest since 2003' },
      { label: 'RBA cash rate', value: '0.75 → 0.25%', tone: 'down', note: 'Cuts on 3 and 19 Mar' },
    ],
    timeline: [
      { at: '2020-02-20', text: 'ASX 200 sets a record close as COVID-19 is still seen as a China story.', key: true },
      { at: '2020-03-03', text: 'RBA cuts the cash rate 25bp to 0.50%.' },
      { at: '2020-03-09', text: 'An oil price war between Saudi Arabia and Russia compounds the selloff.' },
      { at: '2020-03-16', text: 'ASX 200 falls more than 9% in a single session — one of its worst days on record.', key: true },
      { at: '2020-03-19', text: 'RBA cuts to 0.25%, targets a 0.25% three-year bond yield and begins buying bonds. AUD touches 0.5510.' },
      { at: '2020-03-23', text: 'The low: ASX 200 closes at 4,546, down 5.6% on the day.', key: true },
    ],
    lessons: [
      'Crashes compress time: the index gave up years of gains in 22 sessions.',
      'The AUD fell with risk assets — a commodity currency is not a safe haven.',
    ],
    quiz: [
      { q: 'Roughly how far did the ASX 200 fall from 20 Feb to 23 Mar 2020?', options: ['About 12%', 'About 20%', 'About 37%', 'About 55%'], answer: 2, why: 'From 7,162 to 4,546 — about 36.5% close to close.' },
      { q: 'What did the AUD do during the crash?', options: ['Rallied as a safe haven', 'Fell to its lowest since 2003', 'Was pegged by the RBA', 'Barely moved'], answer: 1, why: 'It hit 0.5510 US on 19 March.' },
      { q: 'Where did the RBA take the cash rate in March 2020?', options: ['1.00%', '0.75%', '0.25%', '0.00%'], answer: 2, why: 'Two cuts — to 0.50% on 3 March and 0.25% on 19 March.' },
    ],
    sources: ['ABC News / AAP market reports, Mar 2020', 'NAB — "The AUD in March 2020"', 'rba.gov.au cash rate history'],
  },
  {
    id: 'gfc-2008',
    title: 'Global Financial Crisis',
    dateLabel: 'Late 2007 – Mar 2009',
    category: 'CRISIS',
    difficulty: 'ADVANCED',
    duration: '16 months',
    description: 'The US housing bust became a global credit crisis. Lehman Brothers collapsed in September 2008 and the ASX 200 more than halved from its peak.',
    window: { kind: 'days', from: '2007-11-01', to: '2009-03-06' },
    series: {
      label: 'ASX 200',
      unit: 'pts',
      dp: 0,
      anchors: [
        { at: '2007-11-01', value: 6829, note: 'Pre-crisis peak' },
        { at: '2009-03-06', value: 3145, note: 'Crisis low' },
      ],
    },
    facts: [
      { label: 'ASX 200', value: '−54%', tone: 'down', note: '6,829 → 3,145 peak to trough' },
      { label: 'After Lehman', value: '−37.4%', tone: 'down', note: 'ASX in the following six months' },
      { label: 'RBA cash rate', value: '7.25 → 3.00%', tone: 'down', note: 'Sep 2008 to Apr 2009' },
    ],
    timeline: [
      { at: '2007-11-01', text: 'ASX 200 near its pre-crisis peak of about 6,829.', key: true },
      { at: '2008-09-02', text: 'RBA begins cutting from 7.25%.' },
      { at: '2008-09-15', text: 'Lehman Brothers files for bankruptcy. Credit markets seize.', key: true },
      { at: '2008-10-07', text: 'RBA cuts 100bp in a single move to 6.00%.' },
      { at: '2009-03-06', text: 'ASX 200 bottoms near 3,145 — about 54% below its peak.', key: true },
    ],
    lessons: [
      'Leverage turns a sector problem (US housing) into a system problem (global credit).',
      'Australia\'s central bank had room to cut hard — 425bp in seven months — which few others did.',
    ],
    quiz: [
      { q: 'How far did the ASX 200 fall peak to trough?', options: ['About 25%', 'About 40%', 'About 54%', 'About 78%'], answer: 2, why: 'From about 6,829 to 3,145.' },
      { q: 'Which event marked the acute phase in September 2008?', options: ['Bear Stearns rescue', 'Lehman Brothers bankruptcy', 'Greek default', 'Dot-com bust'], answer: 1, why: 'Lehman filed for bankruptcy on 15 September 2008.' },
      { q: 'How did the RBA respond?', options: ['Held rates', 'Raised rates', 'Cut from 7.25% to 3.00%', 'Cut to zero'], answer: 2, why: 'Cuts from September 2008 took the cash rate to 3.00% by April 2009.' },
    ],
    sources: ['Motley Fool AU — "How did the ASX 200 perform in the GFC?"', 'rba.gov.au cash rate history'],
  },
  {
    id: 'china-stimulus-2024',
    title: 'China Stimulus Package',
    dateLabel: 'Sep 2024',
    category: 'MACRO',
    difficulty: 'BEGINNER',
    duration: '1 week',
    description: 'Beijing unveiled its broadest stimulus in years — rate cuts, mortgage relief and equity support. Australian miners had one of their best weeks on record.',
    window: { kind: 'days', from: '2024-09-23', to: '2024-09-27' },
    series: {
      label: 'ASX 200 Materials',
      unit: 'rebased',
      dp: 1,
      anchors: [
        { at: '2024-09-23', value: 100, note: 'Rebased to 100 at the start of the week' },
        { at: '2024-09-27', value: 109.28, note: '+9.28% for the week' },
      ],
    },
    facts: [
      { label: 'Materials', value: '+9.3%', tone: 'up', note: 'For the week' },
      { label: 'BHP', value: '+13.3%', tone: 'up', note: 'To A$44.70' },
      { label: 'RIO', value: '+13.6%', tone: 'up', note: 'To A$126.80' },
    ],
    timeline: [
      { at: '2024-09-24', text: 'PBOC announces rate cuts, a reserve-ratio cut, lower mortgage rates and support for the share market.', key: true },
      { at: '2024-09-24', text: 'Iron ore, copper and lithium names surge on the ASX.' },
      { at: '2024-09-27', text: 'Week ends with BHP up 13.3% and RIO up 13.6%; the materials index up 9.28%.', key: true },
    ],
    lessons: [
      'Chinese policy is a direct input to ASX earnings — the miners are, in effect, a China growth trade.',
      'Stimulus headlines move prices before any extra steel is made; the follow-through depends on delivery.',
    ],
    quiz: [
      { q: 'Which part of the ASX benefited most?', options: ['Banks', 'Materials', 'Healthcare', 'Utilities'], answer: 1, why: 'The materials index rose 9.28% for the week.' },
      { q: 'Roughly how much did BHP gain that week?', options: ['About 3%', 'About 7%', 'About 13%', 'About 30%'], answer: 2, why: 'BHP rose 13.28% to A$44.70.' },
      { q: 'Why do Chinese stimulus announcements move ASX miners?', options: ['China owns the miners', 'China is the main buyer of Australian iron ore and metals', 'The ASX is listed in Shanghai', 'They don\'t'], answer: 1, why: 'China\'s steel and construction demand drives the price of what BHP, RIO and FMG sell.' },
    ],
    sources: ['Market Index — China stimulus coverage, Sep 2024', 'iTiger / Motley Fool AU weekly wrap, 27 Sep 2024'],
  },
  {
    id: 'iron-ore-2021',
    title: 'Iron Ore Supercycle',
    dateLabel: 'May – Jul 2021',
    category: 'COMMODITY',
    difficulty: 'INTERMEDIATE',
    duration: '3 months',
    description: 'Post-COVID steel demand and Brazilian supply problems drove iron ore to a record near US$230/t. Fortescue printed record profits.',
    window: { kind: 'days', from: '2021-05-12', to: '2021-07-30' },
    series: {
      label: 'Iron ore 62% Fe',
      unit: 'US$/t',
      dp: 0,
      anchors: [
        { at: '2021-05-12', value: 230, note: 'Record, about US$230/t' },
        { at: '2021-07-30', value: 199, note: 'Back below US$200/t' },
      ],
    },
    facts: [
      { label: 'Iron ore peak', value: '~US$230/t', tone: 'up', note: '12 May 2021' },
      { label: 'FMG record close', value: 'A$26.50', tone: 'up', note: 'Late July 2021' },
      { label: 'FMG FY21 profit', value: 'US$10.3B', tone: 'up', note: 'Revenue +74% to US$22.3B' },
    ],
    timeline: [
      { at: '2021-05-12', text: 'Iron ore peaks near US$230/t on Chinese steel demand.', key: true },
      { at: '2021-07-29', text: 'Fortescue posts a record close of A$26.50 even as the ore price eases.' },
      { at: '2021-07-30', text: 'Iron ore drops back below US$200/t as China signals steel output curbs.', key: true },
    ],
    lessons: [
      'Miners\' share prices lag and lead the commodity — FMG made its record after ore had already peaked, on record cash flow.',
      'Commodity peaks are set by supply and policy as much as demand.',
    ],
    quiz: [
      { q: 'Where did iron ore peak in May 2021?', options: ['About US$90/t', 'About US$150/t', 'About US$230/t', 'About US$400/t'], answer: 2, why: 'It reached about US$230/t on 12 May 2021.' },
      { q: 'What did Fortescue report for FY21?', options: ['A loss', 'Flat profit', 'Record profit of US$10.3B', 'A takeover'], answer: 2, why: 'Net profit after tax was US$10.3B on revenue up 74%.' },
      { q: 'What helped push iron ore back below US$200?', options: ['RBA hikes', 'China signalling steel output curbs', 'A US recession', 'An Australian export ban'], answer: 1, why: 'Beijing moved to cap steel production, cutting expected ore demand.' },
    ],
    sources: ['Motley Fool AU, Jul 2021', 'Small Caps — Fortescue FY21 results'],
  },
  {
    id: 'dot-com-crash',
    title: 'Dot-Com Crash',
    dateLabel: '2000 – 2002',
    category: 'CRISIS',
    difficulty: 'ADVANCED',
    duration: '2.5 years',
    description: 'Internet-era valuations collapsed. The NASDAQ lost almost four-fifths of its value from its March 2000 peak.',
    window: { kind: 'days', from: '2000-03-10', to: '2002-10-09' },
    series: {
      label: 'NASDAQ Composite',
      unit: 'pts',
      dp: 0,
      anchors: [
        { at: '2000-03-10', value: 5048.62, note: 'Peak close' },
        { at: '2002-10-09', value: 1114.11, note: 'Trough close' },
      ],
    },
    facts: [
      { label: 'NASDAQ', value: '−77.9%', tone: 'down', note: '5,048.62 → 1,114.11' },
      { label: 'Duration', value: '31 months', tone: 'down', note: 'Peak to trough' },
    ],
    timeline: [
      { at: '2000-03-10', text: 'NASDAQ Composite closes at a record 5,048.62.', key: true },
      { at: '2001-09-11', text: 'The September 11 attacks close US markets for four sessions.' },
      { at: '2002-10-09', text: 'NASDAQ bottoms at 1,114.11 — down 77.9% from the peak.', key: true },
    ],
    lessons: [
      'Valuation is not timing: the bubble was visible for years before it burst, and the bust took years too.',
      'Index concentration matters — a tech-heavy index fell far further than a resources-and-banks-heavy one like the ASX.',
    ],
    quiz: [
      { q: 'How far did the NASDAQ fall from peak to trough?', options: ['About 30%', 'About 50%', 'About 78%', 'About 95%'], answer: 2, why: 'From 5,048.62 to 1,114.11 — 77.9%.' },
      { q: 'How long did the decline take?', options: ['3 months', '1 year', 'About 2.5 years', '10 years'], answer: 2, why: 'March 2000 to October 2002.' },
      { q: 'Why was the ASX less affected than the NASDAQ?', options: ['It was closed', 'Its index had far less tech weight', 'The RBA bought shares', 'It wasn\'t affected at all'], answer: 1, why: 'The ASX is dominated by banks and miners, not technology.' },
    ],
    sources: ['NASDAQ historical closes'],
  },
  {
    id: 'rba-cycle-2022',
    title: 'RBA Hiking Cycle',
    dateLabel: 'May 2022 – Nov 2023',
    category: 'CENTRAL BANK',
    difficulty: 'INTERMEDIATE',
    duration: '18 months',
    description: 'From a record-low 0.10%, the RBA hiked thirteen times to 4.35% to fight the highest inflation in three decades.',
    window: { kind: 'days', from: '2022-05-03', to: '2023-11-07' },
    series: {
      label: 'RBA cash rate',
      unit: '%',
      dp: 2,
      step: true,
      anchors: [
        { at: '2022-05-03', value: 0.35 }, { at: '2022-06-07', value: 0.85 }, { at: '2022-07-05', value: 1.35 },
        { at: '2022-08-02', value: 1.85 }, { at: '2022-09-06', value: 2.35 }, { at: '2022-10-04', value: 2.60 },
        { at: '2022-11-01', value: 2.85 }, { at: '2022-12-06', value: 3.10 }, { at: '2023-02-07', value: 3.35 },
        { at: '2023-03-07', value: 3.60 }, { at: '2023-05-02', value: 3.85 }, { at: '2023-06-06', value: 4.10 },
        { at: '2023-11-07', value: 4.35 },
      ],
    },
    facts: [
      { label: 'Cash rate', value: '0.10 → 4.35%', tone: 'up' },
      { label: 'Hikes', value: '13', tone: 'up', note: 'Four of them 50bp' },
      { label: 'Total', value: '+425bp', tone: 'up' },
    ],
    timeline: [
      { at: '2022-05-03', text: 'First RBA hike since 2010: 0.10% → 0.35%.', key: true },
      { at: '2022-06-07', text: 'A 50bp hike — the first of four in a row.' },
      { at: '2022-10-04', text: 'The pace slows to 25bp moves.' },
      { at: '2023-04-04', text: 'The Board pauses for the first time in the cycle.' },
      { at: '2023-11-07', text: 'The thirteenth hike takes the cash rate to 4.35% — the peak of that cycle.', key: true },
    ],
    lessons: [
      'Rate cycles are fast on the way up: 425bp in 18 months.',
      'Variable-rate borrowers feel each hike within weeks; the economy takes longer.',
    ],
    quiz: [
      { q: 'How many times did the RBA hike in this cycle?', options: ['5', '9', '13', '20'], answer: 2, why: 'Thirteen hikes from May 2022 to November 2023.' },
      { q: 'Where did the cycle start?', options: ['0.10%', '1.50%', '2.00%', '4.35%'], answer: 0, why: 'A record low of 0.10%.' },
      { q: 'What was the largest single move?', options: ['25bp', '50bp', '75bp', '100bp'], answer: 1, why: 'Four consecutive 50bp hikes, June to September 2022.' },
    ],
    sources: ['rba.gov.au cash rate history'],
  },
]

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) ?? null

// ── Time axis ───────────────────────────────────────────────────────────────

const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const dayNum = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000

// Position of a time or date within the scenario window, 0..1.
export function progressOf(window, at) {
  if (window.kind === 'intraday') {
    return (minutes(at) - minutes(window.from)) / (minutes(window.to) - minutes(window.from))
  }
  return (dayNum(at) - dayNum(window.from)) / (dayNum(window.to) - dayNum(window.from))
}

// Human label for a progress point: a clock time intraday, a date otherwise.
export function labelAt(window, p) {
  if (window.kind === 'intraday') {
    const m = Math.round(minutes(window.from) + p * (minutes(window.to) - minutes(window.from)))
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  const d = new Date((dayNum(window.from) + p * (dayNum(window.to) - dayNum(window.from))) * 86400000)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ── Reconstructed path ──────────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0 }

// `frames` points from 0 to 1 that pass EXACTLY through every anchor. Between
// anchors: a straight line plus a Brownian bridge — noise pinned to zero at
// both ends, so the wander can never move a sourced level. Step series (a
// policy rate) hold flat between anchors instead, because rates do not drift
// between meetings.
export function reconstructPath(scenario, frames = 120) {
  const { window, series } = scenario
  const pts = series.anchors.map((a) => ({ p: progressOf(window, a.at), v: a.value, note: a.note }))
    .sort((a, b) => a.p - b.p)
  const rng = mulberry32(hash(scenario.id))
  const out = []
  for (let i = 0; i <= frames; i++) {
    const p = i / frames
    let j = pts.findIndex((a) => a.p >= p)
    if (j === -1) j = pts.length - 1
    const right = pts[j]
    const left = pts[Math.max(0, j - 1)]
    let v
    if (series.step) {
      v = (p >= right.p ? right : left).v
      if (p < pts[0].p) v = pts[0].v
    } else if (right.p === left.p) {
      v = right.v
    } else {
      const t = (p - left.p) / (right.p - left.p)
      const span = Math.abs(right.v - left.v) || Math.abs(right.v) * 0.002
      const bridge = Math.sin(Math.PI * t) * (rng() - 0.5) * span * 0.35
      v = left.v + (right.v - left.v) * t + bridge
    }
    out.push({ p, label: labelAt(window, p), value: v })
  }
  // Second pass smooths the per-frame jitter into a line that reads like a
  // market rather than static, then re-pins every anchor exactly.
  const smooth = out.map((pt, i) => {
    if (series.step) return pt
    const a = out[Math.max(0, i - 1)].value, b = out[Math.min(out.length - 1, i + 1)].value
    return { ...pt, value: (a + pt.value * 2 + b) / 4 }
  })
  for (const a of pts) {
    const k = Math.round(a.p * frames)
    if (smooth[k]) smooth[k] = { ...smooth[k], value: a.v, anchor: true, note: a.note }
  }
  return smooth
}
