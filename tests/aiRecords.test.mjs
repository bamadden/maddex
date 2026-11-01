// AI records (legal-risk item 8): every reply recorded server-side with the
// model, template version, input data date and output check result — and no
// prompt text.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildRecord, saveRecord, textHash, RECORD_RETENTION_DAYS } from '../api/_aiRecords.js'
import { GUARD_VERSION } from '../src/services/adviceGuard.js'

const read = (f) => fs.readFileSync(f, 'utf8')
const BASE = {
  userId: 'u1', model: 'claude-sonnet-4-6', purpose: 'chat', template: 'maddex-system', dataDate: '2026-10-29',
  system: 'You are MaddenAI…', messages: [{ role: 'user', content: 'I hold CBA and WBC. Should I sell CBA?' }],
  now: new Date('2026-11-01T03:00:00Z'),
}

test('a record carries model, template version, data date and the check result', () => {
  const r = buildRecord({ ...BASE, outputText: 'Maddex does not tell anyone whether to buy, sell or hold. CBA reports in February.' })
  assert.equal(r.model, 'claude-sonnet-4-6')
  assert.equal(r.template_version, `maddex-system@${textHash('You are MaddenAI…')}`)
  assert.equal(r.input_data_date, '2026-10-29')
  assert.equal(r.guard_version, GUARD_VERSION)
  assert.deepEqual(r.guard_flags, [])
  assert.equal(r.guard_blocked, false)
  assert.equal(r.created_at, '2026-11-01T03:00:00.000Z')
})

test('a reply that crossed the line is recorded as such', () => {
  const r = buildRecord({ ...BASE, outputText: 'You should sell CBA before Tuesday. I recommend WBC.' })
  assert.ok(r.guard_flags.includes('you-should'))
  assert.equal(r.guard_blocked, true)
})

test('the prompt is not stored — only a hash of the user turn', () => {
  const r = buildRecord({ ...BASE, outputText: 'x' })
  const json = JSON.stringify(r)
  assert.doesNotMatch(json, /I hold CBA/)
  assert.doesNotMatch(json, /You are MaddenAI/)
  assert.equal(r.request_hash, textHash('I hold CBA and WBC. Should I sell CBA?'))
  assert.equal(buildRecord({ ...BASE, dataDate: 'not a date', outputText: 'x' }).input_data_date, null)
})

test('saving never breaks the reply, and the table is retained two years', async () => {
  assert.equal(await saveRecord(async () => ({ ok: true }), { a: 1 }), true)
  assert.equal(await saveRecord(async () => ({ ok: false, status: 404 }), { a: 1 }), false)
  assert.equal(await saveRecord(async () => { throw new Error('down') }, { a: 1 }), false)
  assert.equal(RECORD_RETENTION_DAYS, 730)
  const sql = read('supabase/migrations/011_ai_records.sql')
  assert.match(sql, /INTERVAL '730 days'/)
  assert.doesNotMatch(sql, /prompt_text|input_text/)
  assert.match(sql, /FOR SELECT USING \(auth\.uid\(\) = user_id\)/)
  assert.doesNotMatch(sql, /FOR (INSERT|UPDATE|DELETE)/)
})

test('every AI path records: the proxy (streamed and not) and the shared daily content', () => {
  const proxy = read('api/claude.js')
  assert.match(proxy, /await saveRecord\(g\.db, recordOf\(replyText\)\)/)
  assert.match(proxy, /await saveRecord\(g\.db, recordOf\(\(data\.content/)
  assert.match(proxy, /x-maddex-template/)
  assert.match(read('api/ai-daily.js'), /saveRecord\(serviceDb\(\), buildRecord\(/)
  const api = read('src/services/api.js')
  assert.match(api, /'x-maddex-template'/)
  assert.match(api, /'x-maddex-data-date'/)
  assert.match(read('vite.config.js'), /removeHeader\('x-maddex-template'\)/) // never forwarded to Anthropic in dev
})
