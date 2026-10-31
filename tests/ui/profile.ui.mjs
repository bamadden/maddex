// UI test: company profile and the command bar, in a real browser.
//   npm run dev            (in another terminal)
//   npm run test:ui
//
// MaddenAI is MOCKED. Every request to /api/claude is answered here with a
// canned stream, and any request to anthropic.com fails the run — a UI test
// must never spend money or depend on the live model. Uses the system Chrome
// (override with CHROME_PATH) and the dev server at UI_BASE (default
// http://localhost:5173).

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

  console.log('Desktop: profile content')
  const page = await newPage(browser, { width: 1440 })
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
    { id: 'u1', symbol: 'CBA', shares: 10, avgCost: 120, costCurrency: 'AUD', type: 'asx' },
    { id: 'u2', symbol: 'BHP', shares: 10, avgCost: 40, costCurrency: 'AUD', type: 'asx' },
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
