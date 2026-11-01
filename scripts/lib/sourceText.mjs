// Source documents for the Relationships pipeline: text page by page.
//
// readPages(file) extracts a local PDF or .txt. sourcePages(url) downloads a
// cited document once into .cache/graph-sources/ (git-ignored), records its
// SHA-256, and caches the extracted pages beside it — so a verification
// record names the exact bytes it was checked against.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
export const CACHE_DIR = path.join(ROOT, '.cache/graph-sources')

export async function readPages(file) {
  if (/\.txt$/i.test(file)) {
    // Form feeds mark pages when the text was exported with them; otherwise
    // the file is one page.
    return fs.readFileSync(file, 'utf8').split('\f')
  }
  if (!/\.pdf$/i.test(file)) throw new Error('source must be .pdf or .txt')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false, verbosity: 0 }).promise
  // Text runs are joined by where they sit on the page, not with a blanket
  // space: PDFs often split a word across runs ("compris" + "e"), and a space
  // there would make an honest quote fail the verbatim check. A space goes in
  // only where there is a visible gap, or a run ends a line.
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent()
    let out = '', prev = null
    for (const it of c.items) {
      if (!('str' in it)) continue
      if (prev) {
        const [x, y] = [it.transform[4], it.transform[5]]
        const prevEnd = prev.transform[4] + prev.width
        const size = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10
        const sameLine = Math.abs(y - prev.transform[5]) < size * 0.5
        if (prev.hasEOL || !sameLine) out += '\n'
        else if (x - prevEnd > size * 0.15 && !/\s$/.test(out) && !/^\s/.test(it.str)) out += ' '
      }
      out += it.str
      prev = it
    }
    pages.push(out)
  }
  return pages
}

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

// → { url, file, sha256, pages }
export async function sourcePages(url, { fetchImpl = fetch } = {}) {
  const clean = String(url).split('#')[0]
  if (!/^https:\/\//.test(clean)) throw new Error(`source url must be https: ${url}`)
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  let name = clean.replace(/^https:\/\//, '').replace(/[^a-z0-9.]+/gi, '_')
  if (!/\.(pdf|txt)$/i.test(name)) name += '.pdf'
  const file = path.join(CACHE_DIR, name)
  if (!fs.existsSync(file)) {
    const r = await fetchImpl(clean, { headers: { 'user-agent': 'Mozilla/5.0 (Maddex graph verification)' } })
    if (!r.ok) throw new Error(`download failed (HTTP ${r.status}): ${clean}`)
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  }
  const hash = sha256(fs.readFileSync(file))
  const textCache = `${file}.pages.json`
  try {
    const cached = JSON.parse(fs.readFileSync(textCache, 'utf8'))
    if (cached.sha256 === hash) return { url: clean, file, sha256: hash, pages: cached.pages }
  } catch { /* not extracted yet */ }
  const pages = await readPages(file)
  fs.writeFileSync(textCache, JSON.stringify({ sha256: hash, pages }))
  return { url: clean, file, sha256: hash, pages }
}
