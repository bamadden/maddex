// Data health per module (WS1 step 4): each module header shows how many of
// its registered datasets are within their maximum age, computed on the
// reader's Sydney date, with a panel listing each dataset's source and date.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { datasetState, moduleHealth, ageDays } from '../src/utils/dataHealth.js'
import { HEALTH } from '../src/data/registryHealth.js'
import { DATASETS } from '../src/data/registry.js'

test('a dataset past its maximum age between deploys shows as past it', () => {
  const h = { id: 'x', modules: ['fx'], asOf: '2026-10-01', maxAgeDays: 45, cls: 'official' }
  assert.equal(ageDays('2026-10-01', '2026-11-15'), 45)
  assert.equal(datasetState(h, '2026-11-15').state, 'current')
  assert.equal(datasetState(h, '2026-11-16').state, 'past')
  assert.equal(datasetState({ ...h, asOf: null }, '2026-11-16').state, 'undated')
  assert.equal(datasetState({ ...h, cls: 'demo', asOf: null }, '2026-11-16').state, 'demo')
})

test('every module with datasets gets a health summary; today nothing is past its maximum age', () => {
  const modules = [...new Set(DATASETS.flatMap((d) => d.modules))]
  for (const m of modules) {
    const { rows, total } = moduleHealth(m)
    assert.ok(total > 0, m)
    assert.ok(!rows.some((r) => r.state === 'past'), `${m}: ${rows.filter((r) => r.state === 'past').map((r) => r.id)}`)
  }
  // The one undated dataset is the flagged Global map content.
  assert.deepEqual(HEALTH.filter((h) => h.cls !== 'demo' && !h.asOf).map((h) => h.id), ['intel-map'])
  assert.equal(moduleHealth('global').attention, 1)
})

test('every module header shows data health, and the panel loads only when opened', () => {
  const header = fs.readFileSync('src/components/ui/ModuleHeader.jsx', 'utf8')
  assert.match(header, /<DataHealth moduleId=\{healthId \?\? moduleId\} \/>/)
  for (const f of ['src/modules/calendar/CalendarModule.jsx', 'src/modules/dashboard/DashboardModule.jsx']) assert.match(fs.readFileSync(f, 'utf8'), /healthId="\w+"/, f)
  const btn = fs.readFileSync('src/components/ui/DataHealth.jsx', 'utf8')
  assert.match(btn, /lazy\(\(\) => import\('\.\/DataHealthPanel'\)\)/)
  assert.doesNotMatch(btn, /from '\.\.\/\.\.\/data\/registry'/, 'the registry itself stays out of the header chunk')
  assert.match(btn, /aria-expanded/)
})

test("the header's ASK AI prompt describes; it asks for no outlook or what to watch", () => {
  const header = fs.readFileSync('src/components/ui/ModuleHeader.jsx', 'utf8')
  assert.doesNotMatch(header, /watch next|most important thing to know/)
  assert.match(header, /Describe only/)
})
