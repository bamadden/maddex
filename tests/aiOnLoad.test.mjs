// No AI request on load (7 Nov 2026). On Sat 7 Nov the live site sent an
// /api/claude request as soon as it opened: App.jsx generated the weekly
// review in the background after the Friday close, and the morning brief
// (weekday 6–10am) and weekly research notes the same way, each a paid
// completion from the reader's own browser. The only AI content fetched
// without a click is the shared daily set (/api/ai-daily). The browser suite
// opens every module at the old trigger times and counts requests; these
// checks hold the code paths, the hidden-tab rule and the error wording.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const read = (f) => fs.readFileSync(f, 'utf8')
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name)
  return d.isDirectory() ? walk(p) : /\.(js|jsx)$/.test(d.name) ? [p] : []
})

test('App starts no AI generation: no brief, weekly review or weekly notes in the background', () => {
  const app = read('src/App.jsx')
  assert.doesNotMatch(app, /autoGenerateBrief|autoGenerateWeeklyReview|runWeeklyNotes/)
  assert.doesNotMatch(app, /services\/(morningBriefService|weeklyReviewService|noteScheduler)/)
})

// Functions that send an /api/claude request. An effect runs on mount, so an
// effect that calls one of these makes a request nobody asked for.
const AI_CALLS = /\b(askClaude|askClaudeJSON|generateMorningBrief|generateWeeklyReview|autoGenerate\w*|runWeeklyNotes|generateResearchNote|generateEarningsPreview|analyseImpact|detectPattern|generatePortfolio|checkCredits)\s*\(/

// Effects that may call the AI, each because a click opened the component
// whose only job is that AI answer. Every entry must still match, so the list
// cannot go stale.
const ALLOWED = {
  'src/modules/macro/MacroDeepDive.jsx': 'the indicator deep dive is opened by clicking an indicator; its read is that panel',
  'src/components/earningsPreview/EarningsPreviewPanel.jsx': 'the preview modal opens only from a PREVIEW click and holds nothing but the AI preview',
}

function effectBodies(src) {
  const out = []
  let i = 0
  while ((i = src.indexOf('useEffect(', i)) !== -1) {
    let depth = 0, j = i + 'useEffect'.length
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++
      else if (src[j] === ')' && --depth === 0) break
    }
    out.push(src.slice(i, j + 1))
    i = j
  }
  return out
}

test('no effect (code that runs on mount) calls the AI, outside the listed click-opened panels', () => {
  const hits = []
  for (const f of walk('src')) {
    const rel = f.split(path.sep).join('/')
    for (const body of effectBodies(read(f))) if (AI_CALLS.test(body)) hits.push(rel)
  }
  const unexpected = [...new Set(hits)].filter((f) => !ALLOWED[f])
  assert.deepEqual(unexpected, [], `effects that call the AI on mount: ${unexpected.join(', ')}`)
  for (const f of Object.keys(ALLOWED)) assert.ok(hits.includes(f), `${f} no longer calls the AI from an effect; drop it from the list`)
})

test('panels that used to write themselves on open now wait for a click', () => {
  assert.doesNotMatch(read('src/components/ui/DetailModal.jsx'), /triggeredRef/)
  assert.match(read('src/components/ui/DetailModal.jsx'), /ASK MADDENAI ABOUT/)
  assert.match(read('src/modules/news/NewsModule.jsx'), /openedHere\.current && expanded/)
  assert.match(read('src/components/settings/SettingsPanel.jsx'), /useState\('unchecked'\)/)
  assert.match(read('src/components/researchNote/SavedResearch.jsx'), /WRITE THIS WEEK'S NOTES/)
})

function fakeDocument(hidden) {
  const listeners = new Set()
  return {
    hidden,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    show() { this.hidden = false; for (const fn of [...listeners]) fn() },
  }
}

test('nothing is requested while the tab is hidden; an account error reads as a plain line, never the vendor text', async () => {
  const doc = fakeDocument(true)
  globalThis.document = doc
  const calls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return new Response(JSON.stringify({ error: { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } } }), { status: 400 })
  }
  const logged = []
  const { error: realError, warn: realWarn } = console
  console.error = (...a) => logged.push(['error', a.join(' ')])
  console.warn = (...a) => logged.push(['warn', a.join(' ')])
  try {
    const { askClaude, AI_UNAVAILABLE } = await import('../src/services/api.js')
    const p = askClaude([{ role: 'user', content: 'Describe the ASX.' }], null, { systemPrompt: 'test', dataDate: '2026-11-07', guard: false })
    await new Promise((r) => setTimeout(r, 50))
    assert.equal(calls.filter((u) => u.includes('/api/claude')).length, 0, 'no request while hidden')
    doc.show()
    await assert.rejects(p, (e) => e.message === AI_UNAVAILABLE)
    assert.equal(calls.filter((u) => u.includes('/api/claude')).length, 1, 'sent once the tab is visible')
    assert.ok(!logged.some(([lvl]) => lvl === 'error'), 'no console.error')
    assert.ok(!logged.some(([, m]) => /credit|billing|anthropic/i.test(m)), `no vendor text in the console: ${JSON.stringify(logged)}`)
  } finally {
    console.error = realError; console.warn = realWarn
    globalThis.fetch = realFetch
    delete globalThis.document
  }
})

test('every AI failure maps to a plain line; no vendor wording is passed through', async () => {
  const { userFacingAiError, AI_UNAVAILABLE } = await import('../src/services/api.js')
  for (const [status, msg] of [[400, 'Your credit balance is too low'], [401, 'invalid x-api-key'], [500, 'Internal server error'], [400, 'messages.0: unexpected field'], [undefined, undefined]]) {
    assert.equal(userFacingAiError(status, msg), AI_UNAVAILABLE)
  }
  assert.match(userFacingAiError(529, 'Overloaded'), /busy/)
  assert.match(userFacingAiError(400, 'prompt is too long: 250000 tokens'), /too long/)
})

test('reader screens never quote the vendor or send readers to the Anthropic console', () => {
  for (const f of ['src/modules/brief/MorningBriefModule.jsx', 'src/modules/brief/WeeklyReview.jsx', 'src/components/layout/AIPanel.jsx', 'src/modules/news/NewsModule.jsx']) {
    const src = read(f)
    assert.doesNotMatch(src, /credit balance|console\.anthropic\.com|Anthropic API credits/i, f)
  }
  assert.doesNotMatch(read('src/services/api.js'), /console\.error\('\[MADDEN API\] Claude API error/)
})
