// One badge vocabulary (15 Nov 2026): every data-status mark is DataBadge
// (LIVE · DELAYED · DEMO · STALE, with source and time). Per-module phrases
// such as "● DEMO · SIMULATED TICKS" and "INDICATIVE DATA" are gone; the
// older VerifiedBadge style survives only in the RBA files held untouched.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (f) => fs.readFileSync(f, 'utf8')
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => { const p = path.join(d, e.name); return e.isDirectory() ? walk(p) : /\.jsx$/.test(e.name) ? [p] : [] })
const HELD = ['src/modules/fx/RbaHeroCard.jsx', 'src/modules/fx/RbaDecisionCard.jsx', 'src/modules/fx/RbaDecisionPreview.jsx', 'src/modules/fx/RbaHikeImpact.jsx']

test('no per-module data-status phrases outside the held RBA files', () => {
  const bad = /SIMULATED TICKS|INDICATIVE DATA|● DEMO DATA|>● (LIVE|DEMO)<|>DEMO<\/span>|>INDICATIVE<\/span>/
  const hits = walk('src').map((f) => f.split(path.sep).join('/')).filter((f) => !HELD.includes(f) && !f.endsWith('DataBadge.jsx') && bad.test(read(f)))
  assert.deepEqual(hits, [])
})

test('VerifiedBadge renders only in the held RBA files; everywhere else HandEnteredBadge (a DataBadge)', () => {
  const users = walk('src').map((f) => f.split(path.sep).join('/')).filter((f) => /<VerifiedBadge\b/.test(read(f)))
  assert.ok(users.every((f) => HELD.includes(f)), users.join(', '))
  assert.match(read('src/components/ui/VerifiedBadge.jsx'), /export function HandEnteredBadge[\s\S]*<DataBadge cls="DELAYED"/)
})

test('Global, Calendar, Brief and Relationships badge their opening views', () => {
  const g = read('src/modules/global/GlobalModule.jsx')
  assert.match(g, /<DataBadge cls="LIVE" source="USGS · M4\.5\+ · 7 days" at=\{quakesAt \|\| null\} compact \/>/)
  assert.match(g, /<DataBadge cls="DELAYED" source="Maddex editorial, reviewed" at=\{RISK_LAST_REVIEWED\} compact \/>/)
  assert.match(g, /<HandEnteredBadge dataKey="commodities" \/>/)
  const c = read('src/modules/calendar/CalendarModule.jsx')
  assert.match(c, /<DataBadge cls="DELAYED" source="Maddex schedule, checked" at=\{ECON_SCHEDULE_CHECKED\} \/>/)
  assert.match(c, /lastUpdated=\{calResult\?\.source === 'fallback' \? null : dataUpdatedAt\}/)
  const b = read('src/modules/brief/MorningBriefModule.jsx')
  for (const k of ['rba', 'fed', 'au']) assert.match(b, new RegExp(`<HandEnteredBadge dataKey="${k}" />`))
  assert.match(b, /source="Maddex schedule, checked" at=\{ECON_SCHEDULE_CHECKED\}/)
  const r = read('src/modules/relationships/RelationshipsModule.jsx')
  assert.match(r, /<DataBadge cls="DELAYED" source="sourced edges, graph as at" at=\{GRAPH_AS_OF\} \/>/)
  assert.doesNotMatch(r, /PHASE 1\.5/)
})

test('a relationship edge over a year old is described, not given a data class', () => {
  const rel = read('src/modules/relationships/RelPanels.jsx')
  assert.match(rel, />SOURCE OVER A YEAR OLD</)
  assert.doesNotMatch(rel, />STALE</)
})
