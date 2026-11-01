// UI test: company profile and the command bar, in a real browser.
//   npm run dev            (in another terminal)
//   npm run test:ui
//
// MaddenAI is MOCKED. Every request to /api/claude is answered here with a
// canned stream, and any request to anthropic.com fails the run — a UI test
// must never spend money or depend on the live model. Uses the system Chrome
// (override with CHROME_PATH) and the dev server at UI_BASE (default
// http://localhost:5173).

import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = process.env.UI_BASE ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const failures = []
const fail = (msg) => { failures.push(msg); console.log(`  ✖ ${msg}`) }
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
  const page = await browser.newPage()
  await page.setViewport({ width, height: mobile ? 844 : 900, isMobile: mobile, hasTouch: mobile })
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (/(^|\.)anthropic\.com$/.test(u.hostname)) { counts.anthropic++; fail(`request to ${u.href}`); return req.abort() }
    if (u.pathname.startsWith('/api/claude')) { counts.mocked++; return req.respond({ status: 200, contentType: 'text/event-stream', body: MOCK_STREAM }) }
    // The shared daily content (api/ai-daily.js) would generate for real on
    // the dev server: mocked too, with an empty payload the panels tolerate.
    if (u.pathname.startsWith('/api/ai-daily')) {
      counts.shared++
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ kind: u.searchParams.get('kind'), day: u.searchParams.get('day'), generatedAt: new Date().toISOString(), data: null }) })
    }
    return req.continue()
  })
  page.on('pageerror', (e) => fail(`page error: ${e.message.slice(0, 160)}`))
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
  console.log('Mobile (390px): typed DES/PROFILE commands open that company')
  const mob = await newPage(browser, { width: 390, mobile: true })
  for (const [cmd, want] of [['des CBA', 'CBA'], ['profile WES', 'WES'], ['des TLS', 'TLS'], ['DES nab', 'NAB'], ['profile csl', 'CSL']]) {
    await runCommand(mob, cmd)
    await mob.waitForFunction((w) => document.body.innerText.includes(`ASX:${w}`), { timeout: 30_000 }, want).catch(() => {})
    const got = await shownTicker(mob)
    got === want ? pass(`${cmd} → ${got}`) : fail(`${cmd} → ${got ?? 'nothing'} (want ${want})`)
  }
  await mob.close()

  console.log('Desktop: lands on the Overview')
  const page = await newPage(browser, { width: 1440 })
  await page.waitForFunction(() => document.querySelectorAll('#ov-market, #ov-rba, #ov-holdings, #ov-watch, #ov-since').length === 5, { timeout: 30_000 }).catch(() => {})
  const ov = await page.evaluate(() => ({ panels: [...document.querySelectorAll('section[aria-labelledby^="ov-"] h2')].map((h) => h.textContent), countdown: document.querySelector('#ov-rba')?.closest('section')?.innerText.match(/TIME TO DECISION[^\n]*/)?.[0] }))
  if (['MARKET STATE', 'RBA & MACRO', 'HOLDINGS', 'WATCHLIST', 'SINCE YOUR LAST VISIT'].every((t) => ov.panels.includes(t))) pass(`Overview panels: ${ov.panels.join(', ')}`)
  else fail(`Overview panels missing: ${JSON.stringify(ov.panels)}`)
  if (/TIME TO DECISION (\d+ days? )?\d+ hr \d+ min|Decision due/.test(ov.countdown ?? '')) pass(`labelled countdown: ${ov.countdown}`)
  else fail(`no labelled decision countdown (${ov.countdown})`)

  console.log('Keyboard: skip link and reachable stock rows')
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

  console.log('Desktop: profile content')
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

  console.log('RBA banner → event ripple')
  await page.evaluate(() => localStorage.setItem('madden_portfolio_v2', JSON.stringify([
    { id: 'u1', symbol: 'CBA', yfSym: 'CBA.AX', shares: 10, avgCost: 120, costCurrency: 'AUD', type: 'asx' },
    { id: 'u2', symbol: 'BHP', yfSym: 'BHP.AX', shares: 10, avgCost: 40, costCurrency: 'AUD', type: 'asx' },
  ])))
  await runCommand(page, 'rates')
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('WHICH HOLDINGS CONNECT')), { timeout: 30_000 }).catch(() => {})
  const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('WHICH HOLDINGS CONNECT')); b?.click(); return !!b })
  if (!clicked) fail('no WHICH HOLDINGS CONNECT link on Rates')
  await page.waitForFunction(() => document.body.innerText.includes('EVENT RIPPLE'), { timeout: 30_000 }).catch(() => {})
  const ripple = await page.evaluate(() => document.querySelector('aside')?.innerText ?? '')
  if (/rate decision at RBA cash rate/i.test(ripple) && /CONNECTED EXPOSURE, NOT FORECAST/.test(ripple)) pass('Rates → rate-decision ripple from the RBA cash rate')
  else fail('ripple did not open on the RBA cash rate')
  if (/YOUR HOLDINGS · 1 of 2 connected/.test(ripple)) pass('holdings: CBA connects, BHP does not')
  else fail(`holdings line wrong: ${(ripple.match(/YOUR HOLDINGS[^\n]*/) ?? ['none'])[0]}`)

  console.log('Review queue (read only — nothing is approved)')
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

  console.log('One market sentiment score on every screen')
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

  console.log('One clock')
  await nav('DASHBOARD')
  await page.waitForFunction(() => document.querySelectorAll('[data-clock]').length >= 2, { timeout: 30_000 }).catch(() => {})
  const clocks = await page.evaluate(() => [...document.querySelectorAll('[data-clock]')].map((e) => (e.parentElement.innerText.match(/\d{1,2}:\d{2}(\s*[ap]m)?\s*AE[DS]T/i)?.[0] ?? e.innerText).replace(/\s+/g, ' ').trim()))
  if (clocks.length >= 2 && clocks.every((c) => /AE[DS]T/.test(c)) && new Set(clocks).size === 1) pass(`top bar and dashboard show ${clocks[0]}`)
  else fail(`clocks differ or lack a zone: ${JSON.stringify(clocks)}`)

  console.log('Data classes: STALE appears when a feed fails; the key opens')
  const off = await browser.newPage()
  await off.setViewport({ width: 1440, height: 900 })
  await off.setRequestInterception(true)
  off.on('request', (req) => {
    const u = new URL(req.url())
    if (/(^|\.)anthropic\.com$/.test(u.hostname)) { counts.anthropic++; return req.abort() }
    if (u.pathname.startsWith('/api/claude') || u.pathname.startsWith('/api/ai-daily')) return req.respond({ status: 200, contentType: 'application/json', body: '{"data":null}' })
    if (u.hostname === 'api.coingecko.com' || u.hostname === 'api.binance.com') return req.abort() // both crypto feeds down
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
  if (staleBadge && /STALE · CoinGecko · \d\d:\d\d AE[DS]T/.test(staleBadge)) pass(`crypto feeds down → ${staleBadge.replace(/[●\s]+/g, ' ').trim()}`)
  else fail(`no STALE badge with source and time when the crypto feeds failed (${staleBadge})`)
  await off.click('[data-class="STALE"]').catch(() => {})
  const legend = await off.waitForFunction(() => document.querySelector('[aria-labelledby="data-key-title"]')?.innerText, { timeout: 10_000 }).then((h) => h.jsonValue()).catch(() => '')
  if (['LIVE', 'DELAYED', 'DEMO', 'STALE'].every((c) => legend.includes(c))) pass('the badge opens the data key with all four classes')
  else fail('data key did not open from the badge')
  await off.close()

  console.log('Onboarding: once, resumable, replayable')
  const ob = await browser.newPage()
  await ob.setViewport({ width: 1440, height: 900 })
  await ob.setRequestInterception(true)
  ob.on('request', (req) => {
    const u = new URL(req.url())
    if (/(^|\.)anthropic\.com$/.test(u.hostname)) { counts.anthropic++; return req.abort() }
    if (u.pathname.startsWith('/api/claude')) { counts.mocked++; return req.respond({ status: 200, contentType: 'text/event-stream', body: MOCK_STREAM }) }
    if (u.pathname.startsWith('/api/ai-daily')) return req.respond({ status: 200, contentType: 'application/json', body: '{"data":null}' })
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
  const footer = await ob.evaluate(() => document.querySelector('[data-legal-footer]')?.getAttribute('title') ?? '')
  if (/Past performance is not a reliable indicator/.test(footer)) pass('the disclaimer footer is on screen')
  else fail('no disclaimer footer')
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
  await ob.close()

  console.log('Phone (390px): Markets fits, ALL lists every module')
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
  await ph.close()

  console.log('Core plan: a locked module has a way back')
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
  await core.close()

  console.log('MaddenAI is mocked')
  await runCommand(page, 'ai what does the profile show')
  await wait(3000)
  counts.mocked > 0 ? pass(`${counts.mocked} /api/claude request(s) answered by the mock; ${counts.shared} shared-content read(s) mocked`) : fail('the AI request never reached the mock')
  await page.close()
} finally {
  await browser.close()
}

counts.anthropic === 0 ? pass('no request reached anthropic.com') : fail(`${counts.anthropic} request(s) reached anthropic.com`)
console.log(failures.length ? `\n${failures.length} UI check(s) failed.` : '\nAll UI checks passed.')
process.exit(failures.length ? 1 : 0)
