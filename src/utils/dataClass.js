// The one data-class vocabulary. Every figure on screen is one of these four,
// shown with its source and the time it was fetched or published.
//
// Priority when more than one applies: DEMO (not market data at all), then
// STALE (the feed failed and this is the last good copy), then DELAYED, then
// LIVE.

import { sydneyClock, formatDate } from './dateUtils'
import { PAL } from '../styles/palette.js'

export const DATA_CLASSES = {
  LIVE: {
    meaning: 'Fetched from the source this session and refreshing on its normal schedule.',
    colour: PAL.up,
  },
  DELAYED: {
    meaning: 'From the source, but behind real time: the provider delays it, or it is a figure published on a schedule (end of day, monthly, quarterly).',
    colour: PAL.dim,
  },
  DEMO: {
    meaning: 'Simulated for demonstration. Not market data. Equity prices are demo until a market-data provider is connected.',
    colour: PAL.gold,
  },
  STALE: {
    meaning: 'The feed failed just now, so this is the last copy that arrived. The time shown is when that copy was fetched.',
    colour: '#D9773B',
  },
}

export const CLASS_ORDER = ['LIVE', 'DELAYED', 'DEMO', 'STALE']

// demo: simulated data · stale: served from the cached-data fallback
// delayed: provider-delayed or scheduled publication
export function classifyData({ demo = false, stale = false, delayed = false } = {}) {
  if (demo) return 'DEMO'
  if (stale) return 'STALE'
  if (delayed) return 'DELAYED'
  return 'LIVE'
}

// From a dataService envelope ({ data, stale, source, cachedAt }).
export function classOfResult(result, { demo = false, delayed = false } = {}) {
  return classifyData({ demo, stale: result?.stale === true, delayed })
}

// Today: "13:52 AEDT"; another day: "31 Oct 13:52 AEDT" (the one clock).
const sydney = (ms) => {
  const d = new Date(ms)
  const sameDay = d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const { text } = sydneyClock(d)
  return sameDay ? text : `${formatDate(d, { year: false })} ${text}`
}

// liveDataService's `source`: 'live' (just fetched) and 'cache' (fetched
// within its refresh window) are LIVE; 'stale' (the fetch failed, last copy
// served) is STALE.
export const classOfLiveSource = (source) => (source === 'stale' || source === 'fallback' ? 'STALE' : 'LIVE')

// "STALE · CoinGecko · 13:52 AEDT". `at` is ms since epoch, or an ISO date
// for scheduled figures (shown as the date).
export function badgeText({ cls, source, at }) {
  const when = at == null ? null : typeof at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(at)
    ? formatDate(at)
    : sydney(typeof at === 'string' ? Date.parse(at) : at)
  return [cls, source, when].filter(Boolean).join(' · ')
}

// Opens the data key (components/ui/DataLegend, mounted once in the shell).
export const openDataLegend = () => window.dispatchEvent(new CustomEvent('maddex:data-legend'))
