// Visual regression (WS3, 19 Nov 2026): screenshots every design-system part
// on /?components and compares each with its baseline in docs/components/.
//   npm run test:visual                 compare
//   UPDATE_BASELINES=1 npm run test:visual   record new baselines
// The page holds fixed data and no live feeds, and animation is off, so a
// difference means the design changed. The pixel comparison runs in Chrome
// (canvas), so no image library is needed. MaddenAI is never called: any
// /api/claude or anthropic.com request fails the run.
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.UI_BASE ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIR = 'docs/components'
const UPDATE = process.env.UPDATE_BASELINES === '1'
// A pixel differs when any channel moves by more than 16; a part fails when
// more than 0.5% of its pixels differ (anti-aliasing noise sits well below).
const CHANNEL = 16, SHARE = 0.005

const failures = []
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--font-render-hinting=none', '--force-color-profile=srgb'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 800, height: 900, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (/(^|\.)anthropic\.com$/.test(u.hostname) || u.pathname.startsWith('/api/claude')) { failures.push(`AI request: ${u.pathname}`); return req.abort() }
    return req.continue()
  })
  await page.goto(`${BASE}/?components`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForSelector('[data-components-page] [data-component="chart"] svg', { timeout: 30_000 })
  // Web fonts load late and per weight: wait for each one the page uses, or a
  // screenshot taken while a fallback font shows fails (it did, 19 Nov 2026).
  await page.evaluate(async () => {
    const faces = ['300 11px "IBM Plex Mono"', '400 11px "IBM Plex Mono"', '500 11px "IBM Plex Mono"', '600 11px "IBM Plex Mono"', '700 11px "IBM Plex Mono"', '400 12px Inter', '600 12px Inter']
    for (let i = 0; i < 100 && !faces.every((f) => document.fonts.check(f)); i++) {
      await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null)))
      await new Promise((r) => setTimeout(r, 100))
    }
    await document.fonts.ready
  })
  await new Promise((r) => setTimeout(r, 500))
  fs.mkdirSync(DIR, { recursive: true })
  const parts = await page.$$eval('[data-component]', (els) => els.map((e) => e.dataset.component))
  for (const id of parts) {
    const el = await page.$(`[data-component="${id}"]`)
    const shot = await el.screenshot({ type: 'png' })
    const file = path.join(DIR, `${id}.png`)
    if (UPDATE || !fs.existsSync(file)) { fs.writeFileSync(file, shot); console.log(`  ● ${id}: baseline ${UPDATE ? 'updated' : 'recorded'}`); continue }
    const base = fs.readFileSync(file)
    const diff = await page.evaluate(async (a, b, channel) => {
      const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${b64}` })
      const [x, y] = await Promise.all([load(a), load(b)])
      if (x.width !== y.width || x.height !== y.height) return { size: `${y.width}x${y.height} → ${x.width}x${x.height}` }
      const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data }
      const p = px(x), q = px(y)
      let n = 0
      for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) > channel || Math.abs(p[i + 1] - q[i + 1]) > channel || Math.abs(p[i + 2] - q[i + 2]) > channel) n++
      return { share: n / (p.length / 4) }
    }, Buffer.from(shot).toString('base64'), base.toString('base64'), CHANNEL)
    if (diff.size) { failures.push(`${id}: size changed ${diff.size}`); fs.writeFileSync(path.join(DIR, `${id}.actual.png`), shot) }
    else if (diff.share > SHARE) { failures.push(`${id}: ${(diff.share * 100).toFixed(2)}% of pixels differ`); fs.writeFileSync(path.join(DIR, `${id}.actual.png`), shot) }
    else console.log(`  ✓ ${id} (${(diff.share * 100).toFixed(3)}% differ)`)
  }
  if (parts.length < 7) failures.push(`only ${parts.length} components found`)
} finally { await browser.close() }
for (const f of failures) console.log(`  ✖ ${f}`)
console.log(failures.length ? `${failures.length} visual check(s) failed. New screenshots are saved beside the baselines as *.actual.png.` : 'All visual checks passed.')
process.exit(failures.length ? 1 : 0)
