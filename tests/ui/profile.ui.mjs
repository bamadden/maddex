// UI test: company profile and the command bar, in a real browser.
//   npm run dev            (in another terminal)
//   npm run test:ui
//
// MaddenAI is MOCKED. Every request to /api/claude is answered here with a
// canned stream, and any request to anthropic.com fails the run — a UI test
// must never spend money or depend on the live model. Uses the system Chrome
// (override with CHROME_PATH) and the dev server at UI_BASE (default
// http://localhost:5173).
//
// Pressure switches, for chasing intermittent failures:
//   UI_CPU_THROTTLE=4        slow every page's CPU 4x (CDP)
//   UI_MOCK_DELAY=200-500    answer every mocked request after 200–500 ms
// Every failed check leaves evidence in UI_ARTIFACTS (default
// tests/ui/artifacts/<run>/): the message, a screenshot, the page text and an
// event trace (console, page errors, failed and 4xx/5xx requests, navigations).

import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.UI_BASE ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const CPU_THROTTLE = Number(process.env.UI_CPU_THROTTLE ?? 1)
const [DELAY_MIN = 0, DELAY_MAX = DELAY_MIN] = (process.env.UI_MOCK_DELAY ?? '0').split('-').map(Number)
const mockDelay = () => wait(DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN))
const RUN_DIR = path.join(process.env.UI_ARTIFACTS ?? 'tests/ui/artifacts', new Date().toISOString().replace(/[:.]/g, '-'))

// Evidence on failure. `active` is the page the current check is looking at.
const traces = new Map()
let active = null
let section = ''
const captures = []
async function capture(page, n, msg) {
  const dir = path.join(RUN_DIR, `fail-${n}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'failure.txt'), `section: ${section}\ncheck: ${msg}\nat: ${new Date().toISOString()}\nurl: ${page?.url?.() ?? '?'}\ncpu throttle: ${CPU_THROTTLE}x · mock delay: ${DELAY_MIN}-${DELAY_MAX} ms\n`)
  fs.writeFileSync(path.join(dir, 'trace.log'), (traces.get(page) ?? ['(no page)']).join('\n'))
  if (!page || page.isClosed()) return
  await page.screenshot({ path: path.join(dir, 'screenshot.png'), fullPage: false }).catch((e) => fs.writeFileSync(path.join(dir, 'screenshot-error.txt'), String(e)))
  await page.evaluate(() => document.body.innerText).then((t) => fs.writeFileSync(path.join(dir, 'page.txt'), t)).catch(() => {})
}
const failures = []
const fail = (msg) => {
  failures.push(msg); console.log(`  ✖ ${msg}`)
  captures.push(capture(active, failures.length, msg).catch((e) => console.log(`    (evidence capture failed: ${e.message})`)))
}
const sectionLog = (title) => { section = title; console.log(title) }
// Evidence first: a capture still running when its page closes loses the
// screenshot and page text (it did, in the 2 Nov pressure runs).
const closePage = async (p) => { await Promise.allSettled(captures); await p.close() }

// Every page: an event trace for the evidence, and the CPU throttle.
async function instrument(page) {
  const log = []
  traces.set(page, log)
  const push = (line) => { log.push(`${new Date().toISOString()} ${line}`); if (log.length > 500) log.shift() }
  page.on('console', (m) => push(`console.${m.type()}: ${m.text().slice(0, 300)}`))
  page.on('pageerror', (e) => push(`pageerror: ${e.message.slice(0, 300)}`))
  page.on('requestfailed', (r) => push(`requestfailed: ${r.method()} ${r.url().slice(0, 200)} ${r.failure()?.errorText ?? ''}`))
  page.on('response', (r) => { if (r.status() >= 400) push(`http ${r.status()}: ${r.url().slice(0, 200)}`) })
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) push(`navigated: ${f.url()}`) })
  if (CPU_THROTTLE > 1) await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE })
  active = page
  return page
}
const pass = (msg) => console.log(`  ✔ ${msg}`)

try { await fetch(BASE, { signal: AbortSignal.timeout(5000) }) } catch {
  console.error(`test:ui needs the dev server at ${BASE} (npm run dev).`); process.exit(2)
}

// The proxy's streaming shape (see askClaude in src/services/api.js).
const MOCK_STREAM = [
  { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } },
  { type: 'content_block_delta', delta: { type: 'text_delta', text: '[MOCK MaddenAI reply — UI test]' } },
  { type: 'message_delta', usage: { output_tokens: 6 } },
  { type: 'message_stop' },
].map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')

const counts = { mocked: 0, shared: 0, anthropic: 0 }
async function newPage(browser, { width, mobile = false }) {
  const page = await instrument(await browser.newPage())
  await page.setViewport({ width, height: mobile ? 844 : 900, isMobile: mobile, hasTouch: mobile })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (/(^|\.)anthropic\.com$/.test(u.hostname)) { counts.anthropic++; fail(`request to ${u.href}`); return req.abort() }
    if (u.pathname.startsWith('/api/claude')) { counts.mocked++; return mockDelay().then(() => req.respond({ status: 200, contentType: 'text/event-stream', body: MOCK_STREAM })) }
    // The shared daily content (api/ai-daily.js) would generate for real on
    // the dev server: mocked too, with an empty payload the panels tolerate.
    if (u.pathname.startsWith('/api/ai-daily')) {
      counts.shared++
      return mockDelay().then(() => req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ kind: u.searchParams.get('kind'), day: u.searchParams.get('day'), generatedAt: new Date().toISOString(), data: null }) }))
    }
    return req.continue()
  })
  page.on('pageerror', (e) => { active = page; fail(`page error: ${e.message.slice(0, 160)}`) })
  // A shiftable clock, so "One clock" can put the page just before a minute
  // boundary. Unshifted (the default) it is the real time.
  await page.evaluateOnNewDocument(() => {
    const Real = Date
    let shift = 0
    window.__setClockShift = (ms) => { shift = ms }
    window.Date = class extends Real {
      constructor(...a) { if (a.length) super(...a); else super(Real.now() + shift) }
      static now() { return Real.now() + shift }
    }
  })
  await page.evaluateOnNewDocument(() => {
    for (const [k, v] of Object.entries({
      maddex_welcomed: '2026-01-01', maddex_onboarding_complete: 'true', maddex_dashboard_setup_done: 'true',
      maddex_notif_prompt_dismissed: 'true', maddex_whats_new_version: 'v0.2.0-beta', maddex_dev_plan: 'apex',
      maddex_disclaimer_ack: JSON.stringify({ version: 'disclaimer-2026-11-01', at: '2026-11-01T00:00:00Z' }), 
    })) localStorage.setItem(k, v)
  })
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForSelector('[data-command-bar]', { timeout: 60_000 })
  await wait(2500)
  return page
}

async function runCommand(page, text) {
  await page.focus('[data-command-bar]')
  await page.evaluate(() => { const i = document.querySelector('[data-command-bar]'); i.select?.() })
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text)
  await wait(700)
  await page.keyboard.press('Enter')
}

const shownTicker = (page) => page.waitForFunction(() => /ASX:([A-Z]+)/.exec(document.body.innerText)?.[1], { timeout: 30_000 })
  .then((h) => h.jsonValue()).catch(() => null)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
try {
  sectionLog('Mobile (390px): typed DES/PROFILE commands open that company')
  const mob = await newPage(browser, { width: 390, mobile: true })
  for (const [cmd, want] of [['des CBA', 'CBA'], ['profile WES', 'WES'], ['des TLS', 'TLS'], ['DES nab', 'NAB'], ['profile csl', 'CSL']]) {
    await runCommand(mob, cmd)
    await mob.waitForFunction((w) => document.body.innerText.includes(`ASX:${w}`), { timeout: 30_000 }, want).catch(() => {})
    const got = await shownTicker(mob)
    got === want ? pass(`${cmd} → ${got}`) : fail(`${cmd} → ${got ?? 'nothing'} (want ${want})`)
  }
  await closePage(mob)

  sectionLog('Desktop: lands on the Overview')
  const page = await newPage(browser, { width: 1440 })
  await page.waitForFunction(() => document.querySelectorAll('#ov-market, #ov-rba, #ov-holdings, #ov-watch, #ov-since').length === 5, { timeout: 30_000 }).catch(() => {})
  const ov = await page.evaluate(() => ({ panels: [...document.querySelectorAll('section[aria-labelledby^="ov-"] h2')].map((h) => h.textContent), countdown: document.querySelector('#ov-rba')?.closest('section')?.innerText.match(/TIME TO DECISION[^\n]*/)?.[0] }))
  if (['MARKET STATE', 'RBA & MACRO', 'HOLDINGS', 'WATCHLIST', 'SINCE YOUR LAST VISIT'].every((t) => ov.panels.includes(t))) pass(`Overview panels: ${ov.panels.join(', ')}`)
  else fail(`Overview panels missing: ${JSON.stringify(ov.panels)}`)
  if (/TIME TO DECISION (\d+ days? )?\d+ hr \d+ min|Decision due/.test(ov.countdown ?? '')) pass(`labelled countdown: ${ov.countdown}`)
  else fail(`no labelled decision countdown (${ov.countdown})`)

  sectionLog('Keyboard: skip link and reachable stock rows')
  active = page
  await page.evaluate(() => document.activeElement?.blur())
  await page.evaluate(() => document.body.focus())
  const skip = await page.evaluate(() => { const a = document.querySelector('.skip-link'); a?.focus(); return a ? getComputedStyle(a).top : null })
  if (skip && parseInt(skip, 10) >= 0) pass('skip link appears on focus')
  else fail(`skip link not visible on focus (top ${skip})`)
  await page.keyboard.press('Enter')
  const mainFocused = await page.evaluate(() => document.activeElement?.id)
  mainFocused === 'main-content' ? pass('Enter on the skip link moves focus to the module area') : fail(`focus went to ${mainFocused}`)
  await runCommand(page, 'markets')
  await page.waitForFunction(() => document.querySelectorAll('[data-kb-click]').length > 5, { timeout: 30_000 }).catch(() => {})
  const rows = await page.evaluate(() => document.querySelectorAll('[data-kb-click][tabindex="0"]').length)
  rows > 5 ? pass(`${rows} clickable rows on Markets are keyboard-reachable`) : fail(`only ${rows} keyboard-reachable rows on Markets`)
  const opened = await page.evaluate(async () => {
    const row = [...document.querySelectorAll('tr[data-kb-click]')].find((r) => /(BHP|CBA|RIO|NEM|CSL)/.test(r.textContent))
    if (!row) return 'no stock row'
    row.focus()
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    // The modal is lazy-loaded: poll rather than wait a fixed time.
    for (let i = 0; i < 40 && !document.querySelector('[data-detail-modal]'); i++) await new Promise((r) => setTimeout(r, 200))
    const m = document.querySelector('[data-detail-modal]')
    return m ? `detail for ${m.dataset.detailModal}` : 'no detail modal'
  })
  if (!/^no /.test(opened)) pass(`Enter on a stock row opens its detail (${opened.replace(/\s+/g, ' ').slice(0, 30)}…)`)
  else fail(`Enter on a stock row: ${opened}`)
  await page.keyboard.press('Escape')
  await wait(300)
  const stolen = await page.evaluate(() => document.activeElement?.matches?.('[data-command-bar]') ?? false)
  stolen ? fail('Escape closing the detail moved focus into the command bar') : pass('Escape closes the detail without pulling focus into the command bar')

  sectionLog('Keyboard: F5 switches to Macro without reloading the page')
  await page.evaluate(() => { document.activeElement?.blur(); window.__noReload = 1 })
  await page.keyboard.press('F5')
  await page.waitForFunction(() => document.querySelector('button[aria-current="page"][title]')?.title?.startsWith('MACRO'), { timeout: 10_000 }).catch(() => {})
  const f5 = await page.evaluate(() => ({ kept: window.__noReload === 1, at: document.querySelector('button[aria-current="page"][title]')?.title ?? '' }))
  if (f5.kept && f5.at.startsWith('MACRO')) pass('F5 → Macro, page not reloaded')
  else fail(`F5: reloaded=${!f5.kept}, active "${f5.at}"`)
  await page.focus('[data-command-bar]')
  await page.keyboard.press('F1')
  await page.waitForFunction(() => document.querySelector('button[aria-current="page"][title]')?.title?.startsWith('MARKETS'), { timeout: 10_000 }).catch(() => {})
  const f1 = await page.evaluate(() => document.querySelector('button[aria-current="page"][title]')?.title ?? '')
  f1.startsWith('MARKETS') ? pass('F1 from the command bar → Markets') : fail(`F1 from the command bar: active "${f1}"`)

  sectionLog('Command bar: typos, settings and the export item')
  const activeTitle = () => page.evaluate(() => document.querySelector('button[aria-current="page"][title]')?.title ?? '')
  await runCommand(page, 'portfolo')
  await page.waitForFunction(() => document.querySelector('button[aria-current="page"][title]')?.title?.startsWith('PORTFOLIO'), { timeout: 10_000 }).catch(() => {})
  ;(await activeTitle()).startsWith('PORTFOLIO') ? pass('"portfolo" + Enter → Portfolio') : fail(`"portfolo" → ${await activeTitle()}`)
  await runCommand(page, 'settings')
  const settingsOpen = await page.waitForFunction(() => /⚙ SETTINGS/.test(document.body.innerText), { timeout: 10_000 }).then(() => true).catch(() => false)
  const stillPortfolio = (await activeTitle()).startsWith('PORTFOLIO')
  settingsOpen && stillPortfolio ? pass('"settings" + Enter opens the Settings panel (not Markets)') : fail(`"settings": panel ${settingsOpen}, module "${await activeTitle()}"`)
  await page.keyboard.press('Escape'); await wait(400)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^(✕|×|CLOSE)$/i.test(b.textContent.trim()) && b.closest('[role=dialog]'))?.click())
  await page.focus('[data-command-bar]'); await page.evaluate(() => { const i = document.querySelector('[data-command-bar]'); i.select?.() }); await page.keyboard.press('Backspace')
  await page.keyboard.type('export my data'); await wait(700)
  const offered = await page.evaluate(() => [...document.querySelectorAll('[role=option]')].some((o) => /EXPORT MY DATA/.test(o.textContent) && /Settings → DATA/.test(o.textContent)))
  offered ? pass('"export my data" offers Settings → DATA') : fail('"export my data": no Settings → DATA row')
  await page.keyboard.press('ArrowDown'); await wait(200)
  const aria = await page.evaluate(() => {
    const i = document.querySelector('[data-command-bar]')
    const id = i.getAttribute('aria-activedescendant')
    const opt = id && document.getElementById(id)
    return { role: i.getAttribute('role'), expanded: i.getAttribute('aria-expanded'), list: document.getElementById(i.getAttribute('aria-controls'))?.getAttribute('role'), selected: opt?.getAttribute('aria-selected'), text: opt?.textContent?.trim().slice(0, 30) }
  })
  if (aria.role === 'combobox' && aria.expanded === 'true' && aria.list === 'listbox' && aria.selected === 'true') pass(`screen readers: combobox → listbox, active option "${aria.text}"`)
  else fail(`command bar ARIA: ${JSON.stringify(aria)}`)
  await page.keyboard.press('Escape')

  sectionLog('Desktop: profile content')
  await runCommand(page, 'des CBA')
  await page.waitForFunction(() => document.body.innerText.includes('FINANCIAL YEAR END'), { timeout: 30_000 }).catch(() => {})
  const text = await page.evaluate(() => document.body.innerText)
  text.includes('Absence of an edge is not evidence of no relationship') ? pass('absence line shown') : fail('absence line missing')
  if (/OPERATING INCOME \(LATEST FY\) — BANK MEASURE/.test(text)) pass('bank operating income labelled')
  else fail('bank label missing')
  if (/\bnone\b/i.test(text.slice(text.indexOf('DATA COMPLETENESS')))) fail('the word "none" appears in the profile')
  else pass('no "none" wording')
  await runCommand(page, 'des BHP')
  await page.waitForFunction(() => document.body.innerText.includes('ASX:BHP'), { timeout: 30_000 }).catch(() => {})
  const bhp = await page.evaluate(() => document.body.innerText)
  if (/REVENUE \(LATEST FY\)/.test(bhp) && !/BANK MEASURE/.test(bhp)) pass('BHP shows plain revenue')
  else fail('BHP revenue label wrong')

  sectionLog('RBA card → decisions table and event ripple (throwaway local profile)')
  // The holdings below live only in this headless browser's own profile on
  // the local dev server: no account is signed in, nothing reaches Supabase,
  // and a real user's holdings are never read.
  const signedIn = await page.evaluate(() => Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)))
  if (signedIn) fail('the holdings check must run signed out, in a throwaway local profile')
  await page.evaluate(() => localStorage.setItem('madden_portfolio_v2', JSON.stringify([
    { id: 'u1', symbol: 'CBA', yfSym: 'CBA.AX', shares: 10, avgCost: 120, costCurrency: 'AUD', type: 'asx' },
    { id: 'u2', symbol: 'BHP', yfSym: 'BHP.AX', shares: 10, avgCost: 40, costCurrency: 'AUD', type: 'asx' },
  ])))
  await runCommand(page, 'rates')
  // The decisions table's newest row is the decision the RBA card shows:
  // same rate, same announcement date.
  await page.waitForSelector('[data-rba-decisions] tbody tr', { timeout: 30_000 }).catch(() => {})
  const agree = await page.evaluate(() => {
    const row = document.querySelector('[data-rba-decisions] tbody tr')
    const cells = row ? [...row.querySelectorAll('td')].map((td) => td.innerText.trim()) : []
    const hero = [...document.querySelectorAll('main div, main section')].find((e) => e.children.length > 2 && /^RBA CASH RATE/.test((e.innerText ?? '').trim()) && e.innerText.length < 600)?.innerText ?? ''
    const rate = hero.match(/(\d\.\d\d)%/)?.[1]
    const date = hero.match(/(\d{1,2}) ([A-Z]{3})[A-Z]* (\d{4})/)
    return { cells, rate, date: date ? `${date[1]} ${date[2]} ${date[3]}` : null }
  })
  const [announced, , rateCell] = agree.cells
  if (agree.rate && rateCell === `${agree.rate}%` && agree.date && announced?.toUpperCase() === agree.date) pass(`decisions table's newest row matches the RBA card: ${announced}, ${rateCell}`)
  else fail(`decisions table vs RBA card: table ${JSON.stringify(agree.cells)}, card ${agree.rate}% on ${agree.date}`)
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('WHICH HOLDINGS CONNECT')), { timeout: 30_000 }).catch(() => {})
  const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('WHICH HOLDINGS CONNECT')); b?.click(); return !!b })
  if (!clicked) fail('no WHICH HOLDINGS CONNECT link on Rates')
  await page.waitForFunction(() => document.body.innerText.includes('EVENT RIPPLE'), { timeout: 30_000 }).catch(() => {})
  const ripple = await page.evaluate(() => document.querySelector('aside')?.innerText ?? '')
  if (/rate decision at RBA cash rate/i.test(ripple) && /CONNECTED EXPOSURE, NOT FORECAST/.test(ripple)) pass('Rates → rate-decision ripple from the RBA cash rate')
  else fail('ripple did not open on the RBA cash rate')
  if (/YOUR HOLDINGS · 1 of 2 connected/.test(ripple)) pass('holdings (throwaway local profile): CBA connects, BHP does not')
  else fail(`holdings line wrong: ${(ripple.match(/YOUR HOLDINGS[^\n]*/) ?? ['none'])[0]}`)

  sectionLog('Review queue (read only — nothing is approved)')
  const triage = JSON.parse(fs.readFileSync(new URL('../../src/data/graph/proposals/triage.json', import.meta.url), 'utf8'))
  await page.evaluate(() => [...document.querySelectorAll('button.nav-row')].find((b) => /^REVIEW/.test((b.title || b.textContent).trim()))?.click())
  await page.waitForSelector('[role=tablist][aria-label="Review buckets"]', { timeout: 30_000 }).catch(() => {})
  const review = await page.evaluate(() => ({
    selected: document.querySelector('[role=tab][aria-selected=true]')?.textContent ?? '',
    cards: document.querySelectorAll('[role=tabpanel] article').length,
  }))
  if (/^NEEDS HUMAN/.test(review.selected)) pass('opens on NEEDS HUMAN')
  else fail(`default tab is ${review.selected || 'missing'}`)
  review.cards === triage.counts.NEEDS_HUMAN ? pass(`${review.cards} NEEDS HUMAN card(s), as triaged`) : fail(`${review.cards} cards, triage says ${triage.counts.NEEDS_HUMAN}`)
  const firstCard = await page.evaluate(() => document.querySelector('[role=tabpanel] article')?.innerText ?? '')
  if (!triage.counts.NEEDS_HUMAN || (/FIRST PASS/.test(firstCard) && /SECOND PASS/.test(firstCard))) pass('cards show both passes side by side')
  else fail('a card is missing a pass')
  await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.startsWith('AUTO-REJECTED'))?.click())
  await wait(300)
  const log = await page.evaluate(() => ({ cards: document.querySelectorAll('[role=tabpanel] article').length, approve: [...document.querySelectorAll('[role=tabpanel] button')].filter((b) => /APPROVE/.test(b.textContent)).length }))
  log.cards === triage.counts.AUTO_REJECTED && log.approve === 0 ? pass(`AUTO-REJECTED is a read-only log of ${log.cards}`) : fail(`AUTO-REJECTED: ${log.cards} cards, ${log.approve} approve buttons`)

  sectionLog('One market sentiment score on every screen')
  const seen = {}
  const collect = async (where, n) => {
    await page.waitForFunction((k) => document.querySelectorAll('[data-sentiment-score]').length >= k, { timeout: 30_000 }, n).catch(() => {})
    seen[where] = await page.evaluate(() => [...document.querySelectorAll('[data-sentiment-score]')].map((e) => e.dataset.sentimentScore))
    if (seen[where].length < n) {
      console.log(`    (${where}: ${seen[where].length} of ${n}; on screen: ${await page.evaluate(() => document.querySelector('[aria-live="polite"]')?.innerText ?? '?')} · ${await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\s+/g, ' '))})`)
      await page.screenshot({ path: '/tmp/maddex-ui-sentiment.png' })
    }
  }
  const nav = (label) => page.evaluate((l) => [...document.querySelectorAll('button.nav-row')].find((b) => (b.title || b.textContent).trim().startsWith(l))?.click(), label)
  await nav('DASHBOARD'); await collect('dashboard (top bar, header, gauge)', 3)
  await nav('MARKETS'); await collect('markets', 2)
  await nav('NEWS'); await collect('news', 2)
  const all = Object.values(seen).flat()
  const dash = seen['dashboard (top bar, header, gauge)'] ?? []
  if (all.length >= 7 && dash.length >= 3 && new Set(all).size === 1) pass(`same score in ${all.length} places (${all[0]}): ${Object.entries(seen).map(([k, v]) => `${k} ×${v.length}`).join(', ')}`)
  else fail(`sentiment differs or is missing: ${JSON.stringify(seen)}`)
  // On News: the score card says what it is, and its method opens in one click.
  const method = await page.evaluate(async () => {
    const note = document.querySelector('[data-score-note="sentiment"]')
    if (!note) return null
    if (!/Not a recommendation/.test(note.innerText)) return 'no label'
    note.querySelector('button')?.click()
    await new Promise((r) => setTimeout(r, 300))
    return /Market sentiment score/.test(note.innerText) && /INPUTS THIS TIME/.test(note.innerText) ? 'ok' : 'method did not open'
  })
  method === 'ok' ? pass('score card: "Not a recommendation", method and inputs one click away') : fail(`score note: ${method ?? 'missing'}`)

  sectionLog('One clock')
  await nav('DASHBOARD')
  await page.waitForFunction(() => document.querySelectorAll('[data-clock]').length >= 2, { timeout: 30_000 }).catch(() => {})
  // Every run crosses a minute boundary: the page's clock is moved to 1.5 s
  // before the next minute and both clocks are read every 50 ms for 3.5 s.
  // Two clocks on separate timers disagreed here for up to a second
  // ("00:37 AEDT" beside "00:38 AEDT", 2 Nov pressure runs).
  const boundary = await page.evaluate(async () => {
    const read = () => [...document.querySelectorAll('[data-clock]')].map((e) => (e.parentElement.innerText.match(/\d{1,2}:\d{2}(\s*[ap]m)?\s*AE[DS]T/i)?.[0] ?? e.innerText).replace(/\s+/g, ' ').trim())
    window.__setClockShift(0)
    const t = Date.now()
    window.__setClockShift(60_000 - (t % 60_000) - 1500)
    const samples = []
    for (let i = 0; i < 70; i++) { samples.push(read()); await new Promise((r) => setTimeout(r, 50)) }
    window.__setClockShift(0)
    return samples
  })
  const shown = new Set(boundary.flat())
  const split = boundary.find((c) => c.length < 2 || !c.every((x) => /AE[DS]T/.test(x)) || new Set(c).size !== 1)
  if (!split && shown.size >= 2) pass(`top bar and dashboard agree through a minute change (${[...shown].join(' → ')}, ${boundary.length} reads)`)
  else if (!split) fail(`the clock check never saw the minute change (${[...shown].join(', ')})`)
  else fail(`clocks differ or lack a zone: ${JSON.stringify(split)}`)

  sectionLog('Data classes: STALE appears when a feed fails; the key opens')
  const heldLegend = []
  let legendReleased = false
  const off = await instrument(await browser.newPage())
  await off.setViewport({ width: 1440, height: 900 })
  await off.setRequestInterception(true)
  off.on('request', (req) => {
    const u = new URL(req.url())
    if (/(^|\.)anthropic\.com$/.test(u.hostname)) { counts.anthropic++; return req.abort() }
    if (u.pathname.startsWith('/api/claude') || u.pathname.startsWith('/api/ai-daily')) return mockDelay().then(() => req.respond({ status: 200, contentType: 'application/json', body: '{"data":null}' }))
    if (u.hostname === 'api.coingecko.com' || u.hostname === 'api.binance.com') return mockDelay().then(() => req.abort()) // both crypto feeds down
    // Hold the lazy data key until the badge has been clicked: an early click
    // used to be lost and the key never opened (seen under load, 2 Nov).
    if (u.pathname.endsWith('/components/ui/DataLegend.jsx') && !legendReleased) return heldLegend.push(() => req.continue())
    // The 30-day FX history is down too (latest rates still answer), for the
    // AUD strength check below.
    if (/frankfurter/.test(u.href) && /\d{4}-\d{2}-\d{2}\.\./.test(u.pathname)) return mockDelay().then(() => req.abort())
    return req.continue()
  })
  const cachedAt = Date.now() - 42 * 60_000
  await off.evaluateOnNewDocument((ts) => {
    for (const [k, v] of Object.entries({ maddex_welcomed: '2026-01-01', maddex_onboarding_complete: 'true', maddex_dashboard_setup_done: 'true', maddex_notif_prompt_dismissed: 'true', maddex_whats_new_version: 'v0.2.0-beta', maddex_dev_plan: 'apex', maddex_disclaimer_ack: JSON.stringify({ version: 'disclaimer-2026-11-01', at: '2026-11-01T00:00:00Z' }), })) localStorage.setItem(k, v)
    localStorage.setItem('maddex_ds_crypto2:aud', JSON.stringify({ ts, data: { rows: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', currency: 'AUD', current_price: 110000, price_change_percentage_24h: 0.5 }], currency: 'AUD', provider: 'CoinGecko', fx: null, at: ts } }))
  }, cachedAt)
  await off.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await off.waitForSelector('[data-command-bar]', { timeout: 60_000 })
  await off.evaluate(() => [...document.querySelectorAll('button.nav-row')].find((b) => /^CRYPTO/.test((b.title || b.textContent).trim()))?.click())
  const staleBadge = await off.waitForFunction(() => document.querySelector('[data-class="STALE"]')?.innerText, { timeout: 45_000 }).then((h) => h.jsonValue()).catch(() => null)
  // The badge adds the date when the cache is from an earlier Sydney day
  // ("STALE · CoinGecko · 2 Nov 23:23 AEDT"): the cache below is 42 minutes
  // old, so every run between 00:00 and 00:42 used to fail here.
  if (staleBadge && /STALE · CoinGecko · (\d{1,2} [A-Z][a-z]{2} )?\d\d:\d\d AE[DS]T/.test(staleBadge)) pass(`crypto feeds down → ${staleBadge.replace(/[●\s]+/g, ' ').trim()}`)
  else fail(`no STALE badge with source and time when the crypto feeds failed (${staleBadge})`)
  const heldBeforeClick = heldLegend.length
  await off.click('[data-class="STALE"]').catch((e) => fail(`could not click the STALE badge: ${e.message}`))
  legendReleased = true
  heldLegend.splice(0).forEach((go) => go())
  if (!heldBeforeClick) console.log('    (the data key chunk was not requested before the click; early-click case not exercised)')
  const legend = await off.waitForFunction(() => document.querySelector('[aria-labelledby="data-key-title"]')?.innerText, { timeout: 10_000 }).then((h) => h.jsonValue()).catch(() => '')
  if (['LIVE', 'DELAYED', 'DEMO', 'STALE'].every((c) => legend.includes(c))) pass(`the badge opens the data key with all four classes${heldBeforeClick ? ', even when clicked before the key had loaded' : ''}`)
  else fail('data key did not open from the badge')
  // A failed feed is not an empty one: the strength bars must show the shared
  // failure state, never "No rates" (before 3 Nov they showed six dashes).
  await off.keyboard.press('Escape') // close the data key opened above
  // By the nav, not the command bar: here a typed "rates" + Enter was
  // intermittently left unexecuted (open, docs/QUALITY_REPORT.md, 3 Nov).
  await off.evaluate(() => [...document.querySelectorAll('button.nav-row')].find((b) => /^RATES/.test((b.title || b.textContent).trim()))?.click())
  const strength = await off.waitForFunction(() => {
    const el = document.querySelector('[data-strength-state]')
    return el && !['loading', 'ok'].includes(el.dataset.strengthState) && el.dataset.strengthState
  }, { timeout: 60_000 }).then((h) => h.jsonValue()).catch(() => null)
  const strengthText = await off.evaluate(() => document.querySelector('[data-strength-state]')?.innerText ?? '')
  if (strength === 'failed' && /RATES UNAVAILABLE/.test(strengthText) && !/No rates/.test(strengthText)) pass('FX history down → AUD strength shows ⚠ RATES UNAVAILABLE, not "No rates"')
  else fail(`AUD strength with FX history down: state ${strength}, text "${strengthText.replace(/\s+/g, ' ').slice(0, 80)}"`)
  await closePage(off)

  sectionLog('Onboarding: once, resumable, replayable')
  const ob = await instrument(await browser.newPage())
  await ob.setViewport({ width: 1440, height: 900 })
  await ob.setRequestInterception(true)
  ob.on('request', (req) => {
    const u = new URL(req.url())
    if (/(^|\.)anthropic\.com$/.test(u.hostname)) { counts.anthropic++; return req.abort() }
    if (u.pathname.startsWith('/api/claude')) { counts.mocked++; return mockDelay().then(() => req.respond({ status: 200, contentType: 'text/event-stream', body: MOCK_STREAM })) }
    if (u.pathname.startsWith('/api/ai-daily')) return mockDelay().then(() => req.respond({ status: 200, contentType: 'application/json', body: '{"data":null}' }))
    return req.continue()
  })
  // A brand-new browser: only the plan is set.
  await ob.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await ob.evaluate(() => { localStorage.clear(); localStorage.setItem('maddex_dev_plan', 'apex') })
  await ob.reload({ waitUntil: 'domcontentloaded' })
  const dialogText = () => ob.evaluate(() => [...document.querySelectorAll('[role=dialog]')].map((d) => d.innerText).join(' | '))
  const clickText = (re) => ob.evaluate((src) => { const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => new RegExp(src).test(x.textContent.trim())); b?.click(); return !!b }, re)
  // First: the disclaimer acknowledgement, before anything else.
  await ob.waitForSelector('[data-legal-ack]', { timeout: 60_000 }).catch(() => {})
  const ackText = await ob.evaluate(() => document.querySelector('[data-legal-ack]')?.innerText ?? '')
  if (/not financial advice/i.test(ackText) && /objectives, financial situation or needs/i.test(ackText) && /AI can make mistakes/i.test(ackText) && !/WELCOME TO MADDEX/.test(await dialogText().catch(() => ''))) pass('first visit: the disclaimer acknowledgement comes first')
  else fail('first visit: no disclaimer acknowledgement before the welcome')
  await ob.evaluate(() => [...document.querySelectorAll('[data-legal-ack] button')].find((b) => /I UNDERSTAND/.test(b.textContent))?.click())
  // All four points visible, none cut off, at this width and at phone width.
  const footerShows = () => ob.evaluate(() => {
    const t = document.querySelector('[data-legal-footer-text]')
    if (!t) return ''
    return t.scrollWidth <= t.clientWidth + 1 && t.getBoundingClientRect().height > 0 ? t.innerText : 'CUT OFF'
  })
  const allFour = (s) => /General information only/.test(s) && /Not personal advice/.test(s) && /Past performance is not a reliable indicator/.test(s) && /AI can make mistakes/.test(s)
  const vp = ob.viewport()
  const wide = await footerShows()
  await ob.setViewport({ ...vp, width: 390 }); await wait(300)
  const phone = await footerShows()
  await ob.setViewport(vp); await wait(300)
  if (allFour(wide) && allFour(phone)) pass('the disclaimer footer shows all four points, uncut, on desktop and phone')
  else fail(`disclaimer footer incomplete: desktop "${wide}" · phone "${phone}"`)
  await ob.waitForFunction(() => /WELCOME TO MADDEX/.test(document.body.innerText), { timeout: 60_000 }).catch(() => {})
  if (/WELCOME TO MADDEX/.test(await dialogText())) pass('first visit: welcome shows')
  else fail('first visit: no welcome')
  await clickText('^GET STARTED')
  await ob.waitForFunction(() => /SETUP · STEP 1 OF 5/.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})
  if (/SETUP · STEP 1 OF 5/.test(await dialogText())) pass('then the setup tour, step 1')
  else fail('tour did not start at step 1')
  await clickText('^SKIP$'); await wait(400)
  await clickText('^NOT YET'); await wait(600)
  await ob.waitForFunction(() => /STEP 3 OF 5/.test(document.body.innerText), { timeout: 10_000 }).catch(() => {})
  await ob.reload({ waitUntil: 'domcontentloaded' })
  await ob.waitForFunction(() => /SETUP · STEP \d OF 5/.test(document.body.innerText), { timeout: 60_000 }).catch(() => {})
  const resumed = (await dialogText()).match(/STEP (\d) OF 5/)?.[1]
  if (resumed === '3') pass('reload mid-setup resumes at step 3')
  else fail(`after reload the tour is at step ${resumed ?? 'none'}`)
  if (!(await ob.$('[data-legal-ack]'))) pass('the acknowledgement is not shown again')
  else fail('acknowledgement repeated')
  if (!/WELCOME TO MADDEX/.test(await dialogText())) pass('welcome is not shown again')
  else fail('welcome repeated')
  await clickText('^EXIT SETUP$'); await wait(600)
  await ob.reload({ waitUntil: 'domcontentloaded' })
  await ob.waitForSelector('[data-command-bar]', { timeout: 60_000 }); await wait(2500)
  if (!/SETUP · STEP/.test(await dialogText())) pass('after exiting, the next visit shows no tour')
  else fail('tour came back after exit')
  await ob.focus('[data-command-bar]'); await ob.keyboard.type('help'); await ob.keyboard.press('Enter')
  await ob.waitForSelector('[data-help-action="replay-tour"]', { timeout: 10_000 }).catch(() => {})
  await ob.click('[data-help-action="replay-tour"]').catch(() => {})
  await ob.waitForFunction(() => /SETUP · STEP 1 OF 5/.test(document.body.innerText), { timeout: 10_000 }).catch(() => {})
  if (/SETUP · STEP 1 OF 5/.test(await dialogText())) pass('Help → REPLAY TOUR starts it at step 1')
  else fail('replay did not start the tour')
  await clickText('^EXIT SETUP$'); await wait(400)
  await ob.reload({ waitUntil: 'domcontentloaded' })
  await ob.waitForSelector('[data-command-bar]', { timeout: 60_000 }); await wait(2500)
  if (!/SETUP · STEP/.test(await dialogText())) pass('replaying does not reset completion')
  else fail('tour returned after a replay')
  for (const slug of ['terms', 'privacy']) {
    await ob.goto(`${BASE}/${slug}`, { waitUntil: 'domcontentloaded' })
    const banner = await ob.waitForSelector('[data-legal-draft]', { timeout: 30_000 }).then((h) => h.evaluate((e) => e.textContent)).catch(() => '')
    if (/DRAFT, PENDING LEGAL REVIEW/.test(banner)) pass(`/${slug} is marked DRAFT, pending legal review`)
    else fail(`/${slug} has no draft banner`)
  }
  await closePage(ob)

  sectionLog('Phone (390px): Markets fits, ALL lists every module')
  const ph = await newPage(browser, { width: 390, mobile: true })
  await runCommand(ph, 'markets')
  await ph.waitForFunction(() => !document.body.innerText.includes('LOADING MODULE') && /COMPARE INDICES/.test(document.body.innerText), { timeout: 60_000 }).catch(() => {})
  await wait(2500)
  const spill = await ph.evaluate(() => [...document.querySelectorAll('main *, header *')].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width && r.right > innerWidth + 1 && r.left < innerWidth && !el.closest('[class*=overflow-x-auto],[class*=overflow-x-scroll]')
  }).map((el) => el.textContent.trim().slice(0, 30)).slice(0, 5))
  spill.length ? fail(`Markets spills past the screen edge: ${spill.join(' / ')}`) : pass('nothing on Markets runs past the screen edge')
  const cards = await ph.evaluate(() => {
    const strip = [...document.querySelectorAll('main .snap-x')][0]
    if (!strip) return null
    const box = strip.getBoundingClientRect()
    return [...strip.children].filter((c) => { const r = c.getBoundingClientRect(); return r.left < box.right - 1 && r.right > box.right + 1 }).length
  })
  cards === 0 ? pass('the index strip shows whole cards') : fail(`index strip cuts a card (${cards})`)
  await ph.click('button[aria-label="All modules"]')
  const listed = await ph.waitForSelector('[data-all-modules]', { timeout: 5000 }).then(() => ph.evaluate(() => document.querySelectorAll('[data-all-modules] .grid button').length)).catch(() => 0)
  listed >= 19 ? pass(`ALL lists ${listed} modules`) : fail(`ALL lists ${listed} modules`)
  await ph.evaluate(() => [...document.querySelectorAll('[data-all-modules] .grid button')].find((b) => b.textContent.includes('CALC'))?.click())
  await ph.waitForFunction(() => /CALCULATORS|CALC/.test(document.querySelector('main')?.innerText ?? ''), { timeout: 30_000 }).then(() => pass('picking a module there opens it')).catch(() => fail('ALL did not open the module'))
  await closePage(ph)

  sectionLog('Core plan: a locked module has a way back')
  const core = await newPage(browser, { width: 1440 })
  await core.evaluateOnNewDocument(() => localStorage.setItem('maddex_dev_plan', 'core')) // runs after newPage's apex seed
  await core.reload({ waitUntil: 'domcontentloaded' }); await core.waitForSelector('[data-command-bar]', { timeout: 60_000 }); await wait(2000)
  await runCommand(core, 'portfolio')
  const back = await core.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => /BACK TO OVERVIEW/.test(b.textContent)), { timeout: 30_000 }).catch(() => null)
  if (!back) fail('locked Portfolio shows no way back')
  else {
    await core.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => /BACK TO OVERVIEW/.test(b.textContent)).click())
    await core.waitForFunction(() => !/BACK TO OVERVIEW/.test(document.body.innerText), { timeout: 10_000 })
      .then(() => pass('BACK TO OVERVIEW leaves the locked module')).catch(() => fail('BACK TO OVERVIEW did nothing'))
  }
  // Export and delete are rights, on every plan: on Core both are there and
  // usable (read only — nothing is exported or deleted here).
  await core.evaluate(() => [...document.querySelectorAll('button.nav-row')].find((b) => /^settings/i.test((b.title || b.textContent).trim()))?.click())
  const openSection = (name) => core.evaluate((n) => [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === n)?.click(), name)
  await core.waitForFunction(() => /⚙ SETTINGS/.test(document.body.innerText), { timeout: 15_000 }).catch(() => {})
  await openSection('DATA')
  const exportBtn = await core.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'EXPORT MY DATA' && !b.disabled), { timeout: 10_000 }).then(() => true).catch(() => false)
  await openSection('SECURITY')
  const deleteBtn = await core.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'DELETE ACCOUNT' && !b.disabled), { timeout: 10_000 }).then(() => true).catch(() => false)
  exportBtn && deleteBtn ? pass('Core plan: EXPORT MY DATA and DELETE ACCOUNT are there and usable') : fail(`Core plan: export ${exportBtn}, delete ${deleteBtn}`)
  await closePage(core)

  sectionLog('MaddenAI is mocked')
  active = page
  await runCommand(page, 'ai what does the profile show')
  await wait(3000)
  counts.mocked > 0 ? pass(`${counts.mocked} /api/claude request(s) answered by the mock; ${counts.shared} shared-content read(s) mocked`) : fail('the AI request never reached the mock')
  await closePage(page)
} finally {
  await Promise.allSettled(captures)
  await browser.close()
}

counts.anthropic === 0 ? pass('no request reached anthropic.com') : fail(`${counts.anthropic} request(s) reached anthropic.com`)
await Promise.allSettled(captures)
if (failures.length) console.log(`\nEvidence: ${RUN_DIR}`)
console.log(failures.length ? `\n${failures.length} UI check(s) failed.` : '\nAll UI checks passed.')
process.exit(failures.length ? 1 : 0)
