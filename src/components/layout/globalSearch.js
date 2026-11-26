// Unified search (WS2): the command bar's second index, beyond tickers,
// modules, settings and calculators — glossary terms, saved views, scheduled
// events and the Relationships graph. Loaded on the bar's first focus, so none
// of it is in first paint. Every row carries a `preview` the bar shows under
// the list for the highlighted row, so a reader sees what Enter will open.
import { GLOSSARY, searchGlossary } from '../../data/glossary'
import { ECON_SCHEDULE } from '../../services/calendarService'
import { CORPORATE_ACTIONS, CORPORATE_ACTIONS_AS_OF, ACTION_TYPES } from '../../data/corporateActions'
import { ALL_NODES } from '../../data/graph/nodes'
import { viewStateService } from '../../services/viewStateService'
import { formatDate, sydneyISO } from '../../utils/dateUtils'
import { MODULES } from './commandSearch'

const PER = 4
const norm = (s) => String(s ?? '').toLowerCase()
const moduleLabel = (key) => MODULES.find((m) => m.key === key)?.label ?? key?.toUpperCase()

export function glossaryRows(raw) {
  return searchGlossary(raw, PER).map((g) => ({
    sym: `glossary:${g.term}`, label: g.term, desc: g.def, type: 'glossary', category: 'GLOSSARY', module: g.module,
    preview: { title: g.term, lines: [g.def, `Shown in ${moduleLabel(g.module)}. Enter keeps the definition on screen; it does not leave this page.`] },
  }))
}

export function viewRows(raw, views = viewStateService.getSavedViews()) {
  const q = norm(raw).replace(/^(open |load )?view /, '')
  if (q.length < 2 && !/^views?$/.test(norm(raw))) return []
  return views.filter((v) => /^views?$/.test(norm(raw)) || norm(v.name).includes(q)).slice(0, PER).map((v) => ({
    sym: `view:${v.id}`, label: v.name, desc: `Saved view · ${moduleLabel(v.state?.activeModule)} · ${formatDate(sydneyISO(new Date(v.timestamp)))}`,
    type: 'view', category: 'SAVED VIEWS', id: v.id,
    preview: { title: v.name, lines: [`Opens ${moduleLabel(v.state?.activeModule)}${v.state?.intent ? ' with the settings it had' : ''}.`, `Saved ${formatDate(sydneyISO(new Date(v.timestamp)))}, on this device.`] },
  }))
}

export function eventRows(raw, events = ECON_SCHEDULE, today = sydneyISO()) {
  const q = norm(raw)
  if (q.length < 3) return []
  return events.filter((e) => e.date >= today && norm(e.event).includes(q)).slice(0, PER).map((e) => ({
    sym: `event:${e.date}:${e.event}`, label: formatDate(e.date, { year: false }), desc: `${e.event}${e.time ? ` · ${e.time} Sydney` : ''}`,
    type: 'event', category: 'CALENDAR',
    preview: { title: e.event, lines: [`${formatDate(e.date)}${e.time ? `, ${e.time} Sydney time` : ''} · ${e.region}`, 'From the economic calendar (agency release calendars, manually checked). Enter opens Calendar.'] },
  }))
}

const NODE_TYPE = { company: 'Company', fund: 'Fund', commodity: 'Commodity', macro: 'Macro', index: 'Index', etf: 'ETF', person: 'Person' }
export function nodeRows(raw, nodes = ALL_NODES) {
  const q = norm(raw)
  if (q.length < 3) return []
  return nodes.filter((n) => norm(n.name).includes(q) && !(n.type === 'company' && norm(n.ticker) === q)).slice(0, PER).map((n) => ({
    sym: `node:${n.id}`, label: n.name, desc: `${NODE_TYPE[n.type] ?? n.type} in Relationships`, type: 'node', category: 'RELATIONSHIPS', id: n.id,
    preview: { title: n.name, lines: [`${NODE_TYPE[n.type] ?? n.type}${n.sector ? ` · ${n.sector}` : ''}${n.country ? ` · ${n.country}` : ''}`, 'Enter opens it in Relationships, where every link has its source.'] },
  }))
}

// All four, in the order they are shown.
// Company dates (results, AGMs, ex-dividend, raisings) from the sourced,
// dated corporate-actions table: by company, ticker, or the kind of date
// ("dividend", "results", "agm"), upcoming only (WS2 audit, 26 Nov 2026).
const KIND_WORDS = { dividend: /dividend|ex-div/, results: /results?|earnings|reporting/, agm: /\bagm|annual general/, raising: /raising|spp|placement/, split: /split/ }
export function companyDateRows(raw, actions = CORPORATE_ACTIONS, today = sydneyISO()) {
  const q = norm(raw).trim()
  if (q.length < 3) return []
  return actions.filter((a) => a.date >= today && a.type !== 'listing' && (
    norm(a.company).includes(q) || norm(a.ticker).replace(/\.ax$/, '') === q.replace(/\.ax$/, '') || KIND_WORDS[a.type]?.test(q)
  )).slice(0, PER).map((a) => {
    const kind = ACTION_TYPES.find((t) => t.key === a.type)?.short ?? a.type.toUpperCase()
    return {
      sym: `cdate:${a.date}:${a.ticker}:${a.type}`, label: formatDate(a.date, { year: false }), desc: `${a.company} (${a.ticker.replace(/\.AX$/, '')}) · ${kind}`,
      type: 'event', category: 'COMPANY DATES',
      preview: { title: `${a.company} · ${kind}`, lines: [`${formatDate(a.date)} · ${a.detail}`, `From ${a.source} (checked ${formatDate(CORPORATE_ACTIONS_AS_OF)}). Enter opens Calendar.`] },
    }
  })
}

export function globalSearch(raw) {
  return [...glossaryRows(raw), ...viewRows(raw), ...eventRows(raw), ...companyDateRows(raw), ...nodeRows(raw)]
}

export const GLOSSARY_SIZE = GLOSSARY.length
