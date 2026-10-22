// ─── Geopolitical risk index ────────────────────────────────────────────────
//
// WHAT THIS IS, AND WHAT IT IS NOT
//
// This is Maddex's own editorial index, scored by the documented rubric below
// and dated. It is NOT a third-party measure and there is no vendor behind it;
// anywhere it renders it should be labelled as an internal assessment, the
// same way verifiedConstants figures are labelled as manually maintained.
// The rubric is here so the number is auditable rather than asserted — each
// score is the SUM of its listed factors, computed at the bottom of this file,
// so a score and its reasoning cannot drift apart the way a hardcoded total
// and a comment would.
//
// WHAT IT REPLACED, AND WHY
//
// Scores previously came from regionRiskScore(), which counted matching news
// headlines and weighted them by detectSeverity. Volume is not risk. Any
// region named in a lot of severe-sounding coverage saturated the 100 cap, so
// the panel read China 100, Middle East 100, Russia 100, United States 88 —
// China, Australia's largest trading partner and not at war, scored level with
// Ukraine, and the United States scored 88. The gauge was measuring how much
// the news mentioned a place, which is a real signal about newsrooms and not
// about geopolitical risk.
//
// THE RUBRIC — factor weights, applied per region, capped at 100
//
//   Active armed conflict            +40
//   Nuclear / WMD threat             +20
//   Sanctions / trade war            +15
//   Domestic political instability   +10
//   Territorial disputes             +8
//   Economic crisis                  +7
//   Cyber threats                    +5
//   Human rights / social unrest     +5
//
// A factor is included at its full weight or not at all, except where a
// partial value is noted with its reason. Scores are deliberately coarse —
// this is a band indicator, not a measurement, and false precision would
// invite the reader to compare a 52 against a 54 as though that gap meant
// something.
//
// Where a factor carries an explicit { weight, note }, the weight departs
// from the rubric's base value and the note says why. Russia scores a
// straight sum of full weights (40+20+15+5 = 80).
//
// LAST REVIEWED: 2026-10-22 (Middle East and Iran rescored for the Iran war
// and Hormuz closure; other regions last reviewed 2026-09-06)

export const RISK_RUBRIC = {
  armedConflict:        40,
  nuclearThreat:        20,
  sanctions:            15,
  politicalInstability: 10,
  territorialDispute:    8,
  economicCrisis:        7,
  cyberThreat:           5,
  socialUnrest:          5,
}

export const RISK_LAST_REVIEWED = '2026-10-22'

// AU IMPACT is a separate axis and the more useful of the two here.
//
// Global severity and Australian consequence are not the same question, and
// for this audience the second one matters more. Russia's war is among the
// most severe events in the world and reaches Australia mostly through energy
// and wheat prices. China is not at war and is the destination of roughly a
// third of Australian exports. A single blended number would hide exactly the
// distinction an Australian investor is trying to make, so they stay apart.
const REGIONS = [
  {
    id: 'russia',
    centre: [37.6, 55.8],  // map focus, [lon, lat]
    affects: ['Energy', 'Wheat', 'Fertiliser'],
    label: 'Russia',
    factors: {
      armedConflict: 'Full-scale war in Ukraine, ongoing',
      nuclearThreat: 'Repeated explicit nuclear signalling',
      sanctions: 'Broadest sanctions regime imposed on a major economy',
      socialUnrest: 'Political repression, suppressed opposition',
    },
    auImpact: 35,
    auImpactNote: 'Indirect. Reaches Australia through energy, wheat and fertiliser prices rather than direct trade — Russia is a negligible share of Australian exports.',
    summary: 'Active war, nuclear rhetoric and comprehensive sanctions. Severity is near the top of the scale; the transmission to Australian markets is via commodity prices, not bilateral exposure.',
  },
  {
    id: 'middle-east',
    centre: [56.3, 26.6],  // map focus, [lon, lat] — the Strait of Hormuz
    affects: ['Fuel & CPI', 'Oil & LNG prices', 'Freight', 'Energy stocks', 'RBA path'],
    label: 'Middle East',
    // Rescored 2026-10-22, was 70 (35 + 15 + 12 + 8). Now 40 + 15 + 15 + 10 = 80.
    factors: {
      armedConflict: 'A multi-state war since 28 Feb: the US and Israel against Iran, Gulf states striking Iran, Israel in southern Lebanon, and the Houthis reopening the Red Sea front in September',
      nuclearThreat: { weight: 15, note: 'Iran’s programme, now under wartime conditions with IAEA access curtailed — scored in full on the Iran entry; regional here' },
      territorialDispute: { weight: 15, note: 'Both energy chokepoints contested at once: Iran claims sovereignty over Hormuz and has mined it, and the Houthis are attacking shipping at Bab al-Mandab. Above the base weight because these are trade lanes, not borders' },
      economicCrisis: { weight: 10, note: 'The largest oil supply disruption on record — Hormuz carried about a quarter of seaborne oil and a fifth of LNG before the war. Above the base weight because the crisis is under way, not a risk of one' },
    },
    auImpact: 85,
    auImpactNote: 'The largest external shock to Australia this year after China. Australia imports most of its liquid fuel, so the oil price lands directly in petrol, freight and CPI — the RBA cited Middle East energy prices in its 2026 hikes. It cuts both ways: with Qatari LNG trapped behind Hormuz, Asian LNG and Newcastle coal prices have surged, lifting Woodside, Santos, Whitehaven and New Hope. Australian LNG ships to North Asia and does not transit the Red Sea; the Bab al-Mandab attacks reach Australia through Europe-bound freight costs.',
    summary: 'Eight months into the Iran war, Hormuz is still largely closed: October has seen near-daily strikes on tankers, and the Houthis have reopened the Red Sea front. For Australia this is an inflation shock and an energy-exporter windfall at the same time.',
  },
  {
    id: 'china',
    centre: [116.4, 39.9],  // map focus, [lon, lat]
    affects: ['Iron ore', 'LNG', 'Coal', 'Materials', 'Education'],
    label: 'China',
    factors: {
      territorialDispute: { weight: 28, note: 'Taiwan Strait and South China Sea claims combined — well above the base weight, as the Strait is the single largest tail risk in the region' },
      sanctions: { weight: 12, note: 'Trade and export-control disputes with partners including Australia — active, but far short of a sanctions regime' },
      economicCrisis: 'Property-sector stress and slowing growth',
      cyberThreat: 'Persistent state-linked activity against partner infrastructure',
    },
    auImpact: 95,
    auImpactNote: 'The highest AU impact of any entry, and not because of conflict. China takes roughly a third of Australian exports; iron ore, LNG and coal demand set the terms of trade. Chinese growth is a bigger input to Australian earnings than any other single external variable.',
    summary: 'Not at war, and Australia’s largest trading partner. The risk here is economic and structural rather than military — which is precisely why a headline-counting gauge scoring it 100 was so misleading.',
  },
  {
    id: 'taiwan',
    centre: [121.5, 25.0],  // map focus, [lon, lat]
    affects: ['Semiconductors', 'Shipping lanes', 'Tech supply chain'],
    label: 'Taiwan',
    factors: {
      armedConflict: { weight: 35, note: 'No active conflict; sustained military pressure and blockade rehearsal short of it' },
      territorialDispute: { weight: 10, note: 'Contested sovereignty compounded by semiconductor concentration' },
    },
    auImpact: 65,
    auImpactNote: 'Semiconductor supply chain. A disruption in the Strait reaches Australian technology, automotive and industrial imports within weeks, and would take Chinese demand with it.',
    summary: 'Elevated by military pressure rather than fighting. The supply-chain consequence for Australia is larger than the direct trade relationship suggests.',
  },
  {
    id: 'iran',
    centre: [51.4, 35.7],  // map focus, [lon, lat]
    affects: ['Oil', 'Strait of Hormuz', 'LNG', 'Fertiliser'],
    label: 'Iran',
    // Rescored 2026-10-22, was 47 (20 + 12 + 15). Now 40 + 20 + 15 + 15 + 10 + 5
    // = 105, capped at 100: the one entry the cap binds on, and noted as such.
    factors: {
      armedConflict: 'At war with the US and Israel since 28 Feb, with its own territory under air strikes',
      nuclearThreat: 'Enrichment unresolved and central to the talks; IAEA verification curtailed since the war began',
      sanctions: 'Comprehensive sanctions, plus a US naval blockade of its ports from 13 April to 29 May',
      territorialDispute: { weight: 15, note: 'Claims sovereignty over the Strait of Hormuz, has mined it, and attacks ships on routes it calls unauthorised — above the territorial weight because it closes a global trade lane' },
      politicalInstability: 'Supreme Leader killed in the opening strikes; wartime succession',
      socialUnrest: 'Mass killing of anti-government protesters in early 2026',
    },
    auImpact: 75,
    auImpactNote: 'Tehran decides whether Hormuz reopens, and that decision moves the oil price Australians pay at the bowser. Little direct trade; the channel is energy prices, shipping insurance and fertiliser, with the LNG-exporter upside noted on the Middle East entry.',
    summary: 'A belligerent rather than a risk of one. Kpler counted 10 tankers struck between 28 Sep and 4 Oct alone. A nuclear settlement is the main path to reopening the strait, and the June memorandum to end the war has not held.',
  },
  {
    id: 'ukraine',
    centre: [30.5, 50.4],  // map focus, [lon, lat]
    affects: ['Wheat', 'Energy'],
    label: 'Ukraine',
    factors: {
      armedConflict: 'Active defensive war on its own territory',
      economicCrisis: 'Infrastructure destruction and fiscal dependence on external support',
    },
    auImpact: 30,
    auImpactNote: 'Grain and fertiliser markets. Minimal direct Australian exposure; Australian wheat competes with Ukrainian supply, so the effect is not uniformly negative.',
    summary: 'Severity driven by the conflict on its territory. Australian transmission is through soft commodities.',
  },
  {
    id: 'north-korea',
    centre: [125.8, 39.0],  // map focus, [lon, lat]
    affects: ['Regional security', 'Defence'],
    label: 'North Korea',
    factors: {
      nuclearThreat: 'Declared arsenal and continued testing',
      politicalInstability: 'Opaque succession and decision-making',
      cyberThreat: 'State-directed cyber-theft targeting financial institutions',
      sanctions: { weight: 5, note: 'Already comprehensively sanctioned — marginal additional risk, not marginal severity' },
    },
    auImpact: 30,
    auImpactNote: 'Regional security concern with almost no trade channel. Matters to Australian markets mainly through its effect on North Asian risk appetite.',
    summary: 'Nuclear and unpredictable, but economically isolated — high severity, thin transmission to Australian assets.',
  },
  {
    id: 'united-states',
    centre: [-77.0, 38.9],  // map focus, [lon, lat]
    affects: ['Rates', 'AUD', 'Tech', 'Tariffs'],
    label: 'United States',
    factors: {
      politicalInstability: { weight: 8, note: 'Deep polarisation within stable, functioning institutions' },
      sanctions: { weight: 8, note: 'Trade and tariff policy uncertainty rather than sanctions against it' },
      economicCrisis: { weight: 5, note: 'Periodic debt-ceiling brinkmanship' },
    },
    auImpact: 70,
    auImpactNote: 'Alliance, capital markets and the US dollar. Low risk, high consequence: Fed policy and US equity direction set the tone for Australian markets nightly.',
    summary: 'A stable democracy and treaty ally. Scoring it 88 on news volume put it near Russia, which was indefensible — the genuine risk is policy uncertainty, not instability.',
  },
]

// Resolves a factor entry to its weight. A string means "this factor applies at
// its full rubric weight, and here is why"; an object overrides the weight with
// a stated reason.
const factorWeight = (key, value) =>
  typeof value === 'object' && value !== null
    ? value.weight
    : (RISK_RUBRIC[key] ?? 0)

const factorNote = (key, value) =>
  typeof value === 'object' && value !== null ? value.note : value

// Score = sum of factors, capped. Computed rather than stored so the total can
// never disagree with the reasoning printed beside it.
export const GEO_RISK_INDEX = REGIONS.map((r) => ({
  id: r.id,
  label: r.label,
  score: Math.min(100, Object.entries(r.factors)
    .reduce((sum, [k, v]) => sum + factorWeight(k, v), 0)),
  factors: Object.entries(r.factors).map(([k, v]) => ({
    key: k,
    weight: factorWeight(k, v),
    note: factorNote(k, v),
  })).filter((f) => f.weight > 0).sort((a, b) => b.weight - a.weight),
  auImpact: r.auImpact,
  auImpactNote: r.auImpactNote,
  summary: r.summary,
  centre: r.centre,
  // What the AU exposure runs through — sectors and commodities named in the
  // AU-impact note, for the card's "Affects" line.
  affects: r.affects ?? [],
})).sort((a, b) => b.score - a.score)

export const GEO_RISK_BY_ID = Object.fromEntries(GEO_RISK_INDEX.map((r) => [r.id, r]))

// Bands. Four, because the useful question is which band a region is in, not
// whether it scores 52 or 54.
export const RISK_BANDS = [
  { max: 30,  label: 'LOW',       colour: '#2D8A50', tw: 'text-terminal-green', bar: 'bg-terminal-green' },
  { max: 55,  label: 'ELEVATED',  colour: '#C9A84C', tw: 'text-terminal-gold',  bar: 'bg-terminal-gold' },
  { max: 75,  label: 'HIGH',      colour: '#D9822B', tw: 'text-orange-400',     bar: 'bg-orange-500' },
  { max: 100, label: 'CRITICAL',  colour: '#C93E3E', tw: 'text-terminal-red',   bar: 'bg-terminal-red' },
]

export const riskBand = (score) =>
  RISK_BANDS.find((b) => score <= b.max) ?? RISK_BANDS[RISK_BANDS.length - 1]

// Mean severity across the tracked regions, for the summary tile.
export const avgGeoRisk = () =>
  Math.round(GEO_RISK_INDEX.reduce((s, r) => s + r.score, 0) / GEO_RISK_INDEX.length)
