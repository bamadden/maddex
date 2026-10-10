// ─── Plans, prices, limits, gates ───────────────────────────────────────────
//
// THE one definition of what each plan costs and unlocks. The pricing modal,
// upgrade prompts, Settings → Plan & Billing, the sidebar CTA and every gate
// read from here — the pricing page must never promise what a gate denies,
// and a gate must never deny what the pricing page promised.
//
// Payments are not live (no Stripe yet). Upgrade buttons route through
// startUpgrade(), which shows the waitlist modal until checkout exists.

import { useAuthStore } from '../store/useAuthStore'

export const TIERS = ['core', 'prime', 'apex']
export const TIER_LABEL = { trial: 'Trial', core: 'Core', prime: 'Prime', apex: 'Apex' }

// Prices in AUD per month. Annual is the per-month equivalent billed yearly.
export const PRICES = {
  core:  { monthly: 0,  annual: 0 },
  prime: { monthly: 29, annual: 24 },
  apex:  { monthly: 79, annual: 65 },
}
export const annualSaving = (tier) => {
  const p = PRICES[tier]
  return p.monthly ? Math.round((1 - p.annual / p.monthly) * 100) : 0
}

// TODO(stripe): fill with Stripe price ids when checkout is built.
export const PRICE_IDS = {
  prime: { monthly: null, annual: null },
  apex:  { monthly: null, annual: null },
}

// Infinity = unlimited. 0 = not included.
export const LIMITS = {
  core:  { watchlist: 5,        aiPerDay: 10,       alerts: 0,        researchNotesPerMonth: 0,        briefsPerWeek: 3 },
  prime: { watchlist: Infinity, aiPerDay: 50,       alerts: 10,       researchNotesPerMonth: 5,        briefsPerWeek: Infinity },
  apex:  { watchlist: Infinity, aiPerDay: Infinity, alerts: Infinity, researchNotesPerMonth: Infinity, briefsPerWeek: Infinity },
}

// Feature → plans that include it. A feature not listed is open to all.
export const GATES = {
  portfolio:         ['prime', 'apex'],
  alerts:            ['prime', 'apex'],
  scanner:           ['prime', 'apex'],
  screener:          ['prime', 'apex'],
  global:            ['prime', 'apex'],
  bonds:             ['prime', 'apex'],
  etfs:              ['prime', 'apex'],
  futures:           ['prime', 'apex'],
  researchNotes:     ['prime', 'apex'],
  unlimitedMaddenAI: ['apex'],
  apiAccess:         ['apex'],
}

export const canAccess = (feature, tier) => GATES[feature]?.includes(tier) ?? true

// Module id → feature, for gating whole modules.
export const MODULE_FEATURE = {
  portfolio: 'portfolio', alerts: 'alerts', scanner: 'scanner', screener: 'screener',
  global: 'global', bonds: 'bonds', etf: 'etfs', futures: 'futures',
}

// What the upgrade prompt says about each gated feature: a name, and one
// sentence on why it is worth having. Kept to things the feature really does.
export const FEATURE_COPY = {
  portfolio:         { name: 'Portfolio tracking', why: 'See live P&L, sector exposure and dividend income across every holding — and ask MaddenAI about your actual book.' },
  alerts:            { name: 'Price alerts', why: 'Maddex watches the price for you and alerts you on screen, by desktop notification or by email when it crosses.' },
  scanner:           { name: 'The market scanner', why: 'Breakouts, RSI extremes, unusual volume and gaps, swept across the ASX and US universe automatically.' },
  screener:          { name: 'The stock screener', why: 'Filter the market on valuation, yield and momentum, and rank what passes by how strongly it matches.' },
  global:            { name: 'The global intelligence map', why: 'Shipping chokepoints, trade flows, seismic activity and country risk on one live map.' },
  bonds:             { name: 'The bonds module', why: 'Australian and US yield curves, spreads and duration in one place.' },
  etfs:              { name: 'The ETF explorer', why: 'Compare ASX ETFs on fees, holdings and returns side by side.' },
  futures:           { name: 'Futures & derivatives', why: 'Index futures, rate futures and options context for the Australian market.' },
  researchNotes:     { name: 'Research notes', why: 'MaddenAI writes a structured research note on any stock, and you keep your own notes alongside.' },
  unlimitedMaddenAI: { name: 'Unlimited MaddenAI', why: 'Ask as many questions as you like, every day — no daily cap on your analyst.' },
  moreMaddenAI:      { name: 'More MaddenAI', why: 'Prime gives you 50 MaddenAI questions a day, plus portfolio tracking, alerts and the scanner.' },
  apiAccess:         { name: 'API access', why: 'Pull Maddex data into your own spreadsheets and tools.' },
  watchlist:         { name: 'A bigger watchlist', why: 'Track as many stocks as you like, with prices, alerts and news highlights on each.' },
  briefs:            { name: 'The daily morning brief', why: 'A fresh brief every weekday morning, written for your watchlist and your profile.' },
}

// Which plan to pitch for a feature: the cheapest that includes it.
export const planFor = (feature) => (GATES[feature] ?? ['prime'])[0]

// Pricing-page feature lists. `soon` marks things not yet available on ANY
// plan, so the card never implies a paid tier already has them.
export const PLAN_CARDS = {
  core: {
    tagline: 'For curious investors getting started',
    features: [
      ['Live crypto prices (CoinGecko)', true], ['Live FX rates', true], ['Basic watchlist (5 stocks)', true],
      ['Morning brief (3/week)', true], ['MaddenAI (10 queries/day)', true], ['Public news feed', true],
      ['Financial calculators', true], ['Live ASX prices', 'soon'], ['Portfolio tracking', false],
      ['Price alerts', false], ['Scanner / Screener', false], ['Global intel map', false], ['Bonds, ETFs, Futures modules', false],
    ],
  },
  prime: {
    tagline: 'For active investors',
    lead: 'Everything in Core, plus:',
    features: [
      ['Full watchlist (unlimited)', true], ['Portfolio tracking', true], ['Price alerts (10 active)', true],
      ['Scanner + Screener', true], ['Global intel map', true], ['Bonds, ETFs, Futures modules', true],
      ['MaddenAI (50 queries/day)', true], ['Morning brief (daily)', true], ['Email alerts', true],
      ['Research notes (5/month)', true], ['API access', false], ['Priority support', false],
    ],
  },
  apex: {
    tagline: 'For serious investors',
    lead: 'Everything in Prime, plus:',
    features: [
      ['Unlimited price alerts', true], ['MaddenAI (unlimited)', true], ['Research notes (unlimited)', true],
      ['API access', true], ['Priority support', true], ['Early access to new features', true], ['Export all data', true],
    ],
  },
}

// ── Current tier ─────────────────────────────────────────────────────────────
//
// A live trial behaves as Apex. An expired trial falls to Core (free) — Core
// is a real plan now, not a lockout. Anything unrecognised is Core.
// DEV ONLY: preview the app on another plan —
//   localStorage.setItem('maddex_dev_plan', 'core'), then reload.
// import.meta.env.DEV is false in production builds, so this cannot be used
// to grant a plan on the live site.
export function devPlanOverride() {
  if (!import.meta.env.DEV) return null
  try {
    const forced = localStorage.getItem('maddex_dev_plan')
    return TIERS.includes(forced) ? forced : null
  } catch { return null }
}

export function effectiveTier(profile, now = Date.now()) {
  const forced = devPlanOverride()
  if (forced) return forced
  const raw = profile?.subscription_tier || 'trial'
  if (raw === 'trial') {
    const ends = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null
    return ends != null && ends < now ? 'core' : 'apex'
  }
  return TIERS.includes(raw) ? raw : 'core'
}

// For non-React callers (store actions, services).
export const getCurrentTier = () => effectiveTier(useAuthStore.getState().profile)

export const limitFor = (key, tier = getCurrentTier()) => LIMITS[tier]?.[key] ?? LIMITS.core[key]

// The trial-ended screen is shown once per account; after that the user is
// on Core until they upgrade.
const trialSeenKey = (userId) => `maddex_trial_ended_seen_${userId ?? 'anon'}`
export const trialEndedSeen = (userId) => { try { return localStorage.getItem(trialSeenKey(userId)) === '1' } catch { return false } }
export const markTrialEndedSeen = (userId) => { try { localStorage.setItem(trialSeenKey(userId), '1') } catch { /* private mode */ } }

// ── Gate and upgrade events (handled by PlanOverlays in App) ────────────────

// Returns true if the current plan includes `feature`; otherwise opens the
// upgrade prompt for it and returns false. For actions, not render paths.
export function requireFeature(feature, tier = getCurrentTier()) {
  if (canAccess(feature, tier)) return true
  window.dispatchEvent(new CustomEvent('maddex:gate', { detail: { feature } }))
  return false
}

// A plan limit was reached (e.g. the 11th AI query of the day on Core).
// `tier` is the plan to pitch — the next one up, which lifts the limit.
export const showLimitPrompt = (feature, message, tier) =>
  window.dispatchEvent(new CustomEvent('maddex:gate', { detail: { feature, message, tier } }))

export const nextTier = (tier = getCurrentTier()) => (tier === 'core' ? 'prime' : 'apex')

export const openPricing = () => window.dispatchEvent(new CustomEvent('maddex:open-pricing'))

export function startUpgrade(tier, billing = 'monthly') {
  // TODO(stripe): replace with Stripe Checkout —
  //   stripe.redirectToCheckout({
  //     lineItems: [{ price: PRICE_IDS[tier][billing], quantity: 1 }],
  //     mode: 'subscription',
  //     successUrl: 'https://maddex.com.au/welcome',
  //     cancelUrl: 'https://maddex.com.au/pricing',
  //   })
  // Until then: the "payments coming soon" waitlist modal.
  window.dispatchEvent(new CustomEvent('maddex:upgrade', { detail: { tier, billing } }))
}
