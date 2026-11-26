// Post-deploy smoke test (26 Nov 2026), run after every Production deploy and
// nightly by .github/workflows/smoke.yml, and by hand:
//
//   node scripts/smoke/sweep.mjs production [https://maddex.vercel.app]
//   node scripts/smoke/sweep.mjs modules    [http://localhost:5174]
//   node scripts/smoke/sweep.mjs signed-in  [https://maddex.vercel.app]
//
// production — the live site, signed out. Production shows only the sign-in
//   screen to a signed-out visitor (App.jsx), so this checks that screen
//   (renders, no console error, no AI request), the security headers, and
//   that each API endpoint answers as designed. It cannot open modules.
// modules — every module, on the REAL current date (no faked clock: on 26 Nov
//   a data update crashed Macro in production, and the module sweep in the
//   browser suite fakes 7 and 9 Nov, so it passed). Run against a dev server
//   of the deployed commit (the dev build skips sign-in). Fails on an error
//   boundary, a console error or uncaught exception, raw error text on the
//   page, any AI request on load, or a module with no data badge.
// signed-in — the same module sweep on the live site, signed in as the test
//   account in MADDEX_TEST_EMAIL / MADDEX_TEST_PASSWORD (repo secrets in CI;
//   docs/SMOKE_TEST.md). The credentials are typed into the sign-in form and
//   never printed: every line this script writes has them scrubbed.
//
// In every module sweep, each expand toggle and clickable card on the page is
// opened (not ones labelled AI, not destructive ones): opening a card must
// send no AI request (Ben's rule, 26 Nov 2026: AI runs only from a labelled
// AI control).
//
// Every /api/claude and anthropic.com request is refused and counted (a
// failure), and /api/ai-daily is answered with an empty mock: nothing here
// can make a billed AI call. Network failures of third-party feeds (a 429
// from CoinGecko, a feed that is down) are reported as warnings, not
// failures: the app shows them as STALE or unavailable by design, and an
// outage elsewhere must not read as a broken deploy.
import puppeteer from 'puppeteer-core'

const MODE = process.argv[2]
const BASE = (process.argv[3] ?? (MODE === 'modules' ? 'http://localhost:5174' : 'https://maddex.vercel.app')).replace(/\/$/, '')
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const MODULES = ['DASHBOARD', 'MARKETS', 'CRYPTO', 'RATES', 'MACRO', 'GLOBAL', 'WATCHLIST', 'PORTFOLIO', 'NEWS', 'BRIEF', 'CALENDAR', 'SCANNER', 'SCREENER', 'REPLAY', 'RELATIONSHIPS', 'BONDS', 'ETFS', 'FUTURES', 'CALC']

// Text that means an error reached the reader instead of a message.
// A module may show no data badge only when it shows no data: these screens,
// recognised by their own words, hold nothing sourced (26 Nov 2026).
export const NO_DATA_SCREENS = {
  PORTFOLIO: /Start tracking your portfolio/,  // no holdings yet
  BRIEF: /isn't ready yet/,                     // no brief generated yet
  CALC: /Calculated from your inputs/,          // results from the reader's own inputs
}

export const RAW_ERROR = /\b(TypeError|ReferenceError|SyntaxError|RangeError|Cannot read propert(y|ies) of|is not a function|is not defined|undefined is not|Unexpected token|Uncaught)\b|\[object Object\]|\bNaN(%|\b)|\bInfinity%/

// The test account's credentials, scrubbed from everything this prints.
const SECRETS = [process.env.MADDEX_TEST_EMAIL, process.env.MADDEX_TEST_EMAIL?.split('@')[0], process.env.MADDEX_TEST_PASSWORD]
  .filter((v) => typeof v === 'string' && v.length >= 3)
export const scrub = (text, secrets = SECRETS) => secrets.reduce((t, v) => t.split(v).join('[test account]'), String(text))
const say = (line) => console.log(scrub(line))

const failures = []
const warnings = []
const fail = (m) => { failures.push(m); say(`  ✖ ${m}`) }
const pass = (m) => say(`  ✔ ${m}`)
const warn = (m) => { warnings.push(m); say(`  ⚠ ${m}`) }

// Controls the card-opening pass never presses: AI controls (they are meant
// to send) and anything that changes or removes data, or leaves the page.
export const DO_NOT_PRESS = /\b(AI|MADDENAI|ASK|GENERATE|REGENERATE|DELETE|REMOVE|CLEAR|RESET|SIGN OUT|LOG OUT|EXPORT|IMPORT|SAVE|SEND|SUBMIT|BUY|SELL|UPGRADE|JOIN|SUBSCRIBE|CONFIRM)\b/i

async function openPage(browser, { seed = false } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const log = { ai: [], errors: [], network: [] }
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.pathname.startsWith('/api/claude') || /(^|\.)anthropic\.com$/.test(u.hostname)) { log.ai.push(u.pathname); return req.abort() }
    // Viewing must never trigger the daily generation (Ben's decision, 26 Nov
    // 2026): a page asking for it is a failure, counted with the AI requests.
    if (u.pathname.startsWith('/api/ai-daily') && u.searchParams.has('generate')) { log.ai.push('/api/ai-daily?generate (from a page)'); return req.abort() }
    if (u.pathname.startsWith('/api/ai-daily')) return req.respond({ status: 200, contentType: 'application/json', body: '{"data":null}' })
    return req.continue()
  })
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // A failed third-party request also logs "Failed to load resource": that
    // is a feed outage, reported separately below.
    // So does a third-party error response without CORS headers (CoinGecko's
    // 429s carry none, so Chrome reports them as a CORS block).
    if (/^Failed to load resource/.test(t) || /has been blocked by CORS policy/.test(t)) { log.network.push(`console: ${t.match(/https?:\/\/[^/'"]+/)?.[0] ?? 'resource'} unreachable`); return }
    log.errors.push(t.slice(0, 200))
  })
  page.on('pageerror', (e) => log.errors.push(`uncaught: ${String(e.message ?? e).slice(0, 200)}`))
  // A native dialog (alert/confirm) blocks the page; dismiss it (never
  // accept: it may confirm a deletion) and report it.
  log.dialogs = []
  page.on('dialog', (d) => { log.dialogs.push(`${d.type()}: ${d.message().slice(0, 80)}`); d.dismiss().catch(() => {}) })
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/claude|anthropic/.test(r.url())) log.network.push(`${r.status()} ${new URL(r.url()).host}${new URL(r.url()).pathname}`.slice(0, 120)) })
  page.on('requestfailed', (r) => { if (!/\/api\/claude|anthropic/.test(r.url())) log.network.push(`failed ${new URL(r.url()).host}`) })
  if (seed) {
    await page.evaluateOnNewDocument(() => {
      for (const [k, v] of Object.entries({
        maddex_welcomed: '2026-01-01', maddex_first_seen: String(Date.now() - 30 * 86_400_000), maddex_onboarding_complete: 'true',
        maddex_dashboard_setup_done: 'true', maddex_notif_prompt_dismissed: 'true', maddex_whats_new_version: 'v0.2.0-beta',
        maddex_disclaimer_ack: JSON.stringify({ version: 'disclaimer-2026-11-01', at: '2026-11-01T00:00:00Z' }),
      })) localStorage.setItem(k, v)
    })
  }
  return { page, log }
}

async function runCommand(page, text) {
  await page.focus('[data-command-bar]')
  await page.evaluate(() => document.querySelector('[data-command-bar]').select?.())
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text)
  await wait(500)
  await page.keyboard.press('Enter')
}

async function production(browser) {
  say(`Production, signed out: ${BASE}`)
  const { page, log } = await openPage(browser)
  const res = await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await wait(3000)
  const text = await page.evaluate(() => document.body.innerText)
  const signIn = /SIGN IN/.test(text) && /general information only, not financial advice/i.test(text)
  if (signIn) pass('the sign-in screen renders, with the general-information line')
  else fail('the sign-in screen did not render')
  RAW_ERROR.test(text) ? fail(`raw error text: ${text.match(RAW_ERROR)[0]}`) : pass('no raw error text')
  log.errors.length ? fail(`console errors: ${log.errors.join(' | ')}`) : pass('no console errors')
  log.ai.length ? fail(`${log.ai.length} AI request(s) on load`) : pass('no AI request on load')
  const h = res.headers()
  for (const k of ['strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'content-security-policy-report-only']) (h[k] ? pass : fail)(`header ${k}${h[k] ? '' : ' missing'}`)
  // Each endpoint answers as designed (read-only requests; nothing is written or sent).
  const expect = [
    ['GET', '/api/waitlist', [405]],
    ['GET', '/api/waitlist?action=confirm&token=abc', [400, 503]],
    ['GET', '/api/csp-report', [405]],
    ['GET', '/api/terminal-api', [410]],
    ['GET', '/api/rss?url=https%3A%2F%2Fevil.example%2Ffeed', [403]],
    ['POST', '/api/account-export', [401]],
  ]
  for (const [method, path, ok] of expect) {
    const s = await fetch(`${BASE}${path}`, { method, headers: { accept: 'application/json' } }).then((r) => r.status).catch(() => 0)
    ok.includes(s) ? pass(`${method} ${path.split('?')[0]} → ${s}`) : fail(`${method} ${path} → ${s} (expected ${ok.join(' or ')})`)
  }
  // The shared daily AI content: generated only by the scheduled job. A
  // non-cron call to the job is refused, and a view reads (stored content, or
  // "not generated"), never an error and never a generation.
  const gen = await fetch(`${BASE}/api/ai-daily?generate=all`).then((r) => r.status).catch(() => 0)
  gen === 401 ? pass('the daily AI job refuses a non-cron caller (401)') : fail(`GET /api/ai-daily?generate=all → ${gen} (expected 401)`)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const view = await fetch(`${BASE}/api/ai-daily?kind=sentiment&day=${today}`).then(async (r) => ({ s: r.status, b: await r.json().catch(() => null) })).catch(() => ({ s: 0 }))
  view.s === 200 && (view.b?.status === 'not_generated' || view.b?.data != null)
    ? pass(`a view of the daily AI content reads only: ${view.b?.status === 'not_generated' ? 'not generated yet today' : `generated ${view.b?.generatedAt}`}`)
    : fail(`GET /api/ai-daily?kind=sentiment → ${view.s} ${JSON.stringify(view.b)?.slice(0, 80)}`)
  for (const n of new Set(log.network)) warn(`network: ${n}`)
}

// Opens every expand toggle and clickable card in <main> that is not an AI or
// destructive control, closing anything that opens over the page, and returns
// how many were opened.
async function openCards(page, log, culprits = [], deadline = Date.now() + 20_000) {
  const handles = await page.$$('main [aria-expanded="false"], main [data-kb-click]')
  let opened = 0
  for (const h of handles.slice(0, 40)) {
    // Stops itself at the deadline: a race would leave it clicking into the
    // next module.
    if (Date.now() > deadline) return { opened, timedOut: true }
    const ok = await h.evaluate((el, re) => {
      const label = `${el.innerText ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`
      const r = el.getBoundingClientRect()
      if (!(r.width > 0 && r.height > 0) || new RegExp(re, 'i').test(label) || el.closest('a[href]')) return false
      // A click lands on whatever is at the centre: if that is a control of
      // its own inside the card, judge that control's label instead.
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const inner = hit?.closest('button, a[href], [role="button"]')
      if (inner && inner !== el && el.contains(inner)) {
        const l = `${inner.innerText ?? ''} ${inner.getAttribute('aria-label') ?? ''}`
        return !new RegExp(re, 'i').test(l) && !inner.matches('a[href]')
      }
      return true
    }, DO_NOT_PRESS.source).catch(() => false)
    if (!ok) continue
    const before = log.ai.length
    await Promise.race([h.click(), wait(2000)]).then(() => { opened++ }).catch(() => {})
    await wait(150)
    if (log.ai.length > before) culprits.push(await h.evaluate((el) => (el.innerText || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40)).catch(() => '?'))
    await page.keyboard.press('Escape').catch(() => {})
  }
  return { opened, timedOut: false }
}

async function sweepModules(page, log) {
  await page.waitForSelector('[data-command-bar]', { timeout: 60_000 })
  await wait(3000)
  let cards = 0
  for (const name of MODULES) {
    const before = log.errors.length
    await runCommand(page, name)
    await wait(2500)
    // A module whose badges come with its data (News waits for its feeds) gets
    // up to 8 s more before "no data badge" is judged.
    await page.waitForFunction((n, empty) => (document.querySelector('main') ?? document.body).querySelector('[data-class]') || (empty && new RegExp(empty).test(document.body.innerText)), { timeout: 8000 }, name, NO_DATA_SCREENS[name]?.source ?? null).catch(() => {})
    const s = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      return {
        text: main.innerText,
        badges: main.querySelectorAll('[data-class]').length,
        crashed: /\bhit an error\b/i.test(document.body.innerText),
        nested: [...document.querySelectorAll(['button', 'a[href]', '[role="button"]'].flatMap((o) => ['button', 'a[href]', '[role="button"]'].map((i) => `${o} ${i}`)).join(', '))]
          .map((x) => `"${x.innerText.replace(/\s+/g, ' ').trim().slice(0, 30)}" inside "${x.parentElement.closest('button, a[href], [role="button"]').innerText.replace(/\s+/g, ' ').trim().slice(0, 40)}"`),
      }
    })
    const problems = []
    if (s.crashed) problems.push(`error boundary: ${s.text.match(/[^\n]*hit an error[^\n]*\n?[^\n]*/i)?.[0].replace(/\s+/g, ' ').slice(0, 120)}`)
    if (RAW_ERROR.test(s.text)) problems.push(`raw error text "${s.text.match(RAW_ERROR)[0]}"`)
    if (log.errors.length > before) problems.push(`console: ${log.errors.slice(before).join(' | ').slice(0, 300)}`)
    if (s.nested.length) problems.push(`${s.nested.length} interactive element(s) nested in another: ${[...new Set(s.nested)].slice(0, 3).join('; ')}`)
    if (!s.badges && !NO_DATA_SCREENS[name]?.test(s.text)) problems.push('no data badge')
    // Then open every card and toggle on the page: still no AI request.
    // Bounded: a card that opens something Escape does not close must not
    // stall the run.
    const aiBefore = log.ai.length
    const culprits = []
    const { opened, timedOut } = await openCards(page, log, culprits)
    if (timedOut) warn(`${name}: opened ${opened} card(s) in 20 s and stopped there`)
    cards += opened
    if (log.ai.length > aiBefore) problems.push(`opening its cards sent ${log.ai.length - aiBefore} AI request(s)${culprits.length ? `, from: ${[...new Set(culprits)].map((c) => `"${c}"`).join(', ')}` : ''}`)
    // A fresh load before the next module: whatever a card opened (a modal,
    // a drawer, another view) must not cover the next module's checks.
    if (opened !== 0) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
      await page.waitForSelector('[data-command-bar]', { timeout: 60_000 }).catch(() => {})
      await wait(1500)
    }
    if (problems.length) fail(`${name}: ${problems.join('; ')}`)
    else pass(`${name}: ${s.badges ? `${s.badges} data badge(s)` : 'no data shown (its own empty or calculated screen)'}; ${opened} card(s) opened, no AI request`)
  }
  log.ai.length ? fail(`${log.ai.length} AI request(s) (${[...new Set(log.ai)].join(', ')})`) : pass(`no AI request across every module and ${cards} opened card(s)`)
  for (const d of new Set(log.dialogs)) warn(`a native browser dialog opened (dismissed): ${d}`)
  for (const n of new Set(log.network)) warn(`network: ${n}`)
}

async function modules(browser) {
  say(`Every module on today's date (${new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })}, Sydney; the real clock): ${BASE}`)
  const { page, log } = await openPage(browser, { seed: true })
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await sweepModules(page, log)
}

async function signedIn(browser) {
  const email = process.env.MADDEX_TEST_EMAIL
  const password = process.env.MADDEX_TEST_PASSWORD
  if (!email || !password) { warn('MADDEX_TEST_EMAIL / MADDEX_TEST_PASSWORD are not set: the signed-in sweep was skipped (docs/SMOKE_TEST.md)'); return }
  say(`Every module, signed in as the test account, on today's date: ${BASE}`)
  const { page, log } = await openPage(browser, { seed: true })
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const form = await page.waitForFunction(() => [...document.querySelectorAll('form')].find((f) => f.querySelector('input[type="password"]') && /SIGN IN/.test(f.innerText)), { timeout: 60_000 }).catch(() => null)
  if (!form) { fail('the sign-in form did not appear'); return }
  const f = form.asElement()
  await (await f.$('input[type="email"]')).type(email)
  await (await f.$('input[type="password"]')).type(password)
  const submit = await f.$('button[type="submit"]')
  if (submit) await submit.click()
  else await page.keyboard.press('Enter')
  const state = await page.waitForFunction(() => {
    const t = document.body.innerText
    if (document.querySelector('[data-command-bar]')) return 'in'
    if (/Invalid email or password|Invalid login|invalid credentials|Email not confirmed/i.test(t)) return 'refused' // AuthModal's friendlySignInError
    if (/Terms of Use/i.test(t) && /ACCEPT/i.test(t) && !document.querySelector('[data-command-bar]')) return 'terms'
    return null
  }, { timeout: 60_000 }).then((h) => h.jsonValue()).catch(() => 'timeout')
  if (state !== 'in') {
    fail({ refused: 'the test account was refused at sign-in (check the secrets)', terms: 'the test account has not accepted the Terms of Use: sign in once by hand (docs/SMOKE_TEST.md step 4)', timeout: 'signing in did not reach the terminal within 60 s' }[state])
    return
  }
  if (await page.$('[data-disclaimer-ack], [aria-label*="isclaimer"]')) warn('the disclaimer acknowledgement is showing: acknowledge it once by hand (docs/SMOKE_TEST.md step 4)')
  pass('signed in as the test account')
  await sweepModules(page, log)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const RUN = { production, modules, 'signed-in': signedIn }
  if (!RUN[MODE]) { console.error('usage: sweep.mjs production|modules|signed-in [base-url]'); process.exit(2) }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: process.env.CI ? ['--no-sandbox'] : [] })
  try { await RUN[MODE](browser) } finally { await browser.close() }
  say(failures.length ? `\n${failures.length} smoke check(s) failed.` : `\nAll smoke checks passed${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`)
  process.exit(failures.length ? 1 : 0)
}
