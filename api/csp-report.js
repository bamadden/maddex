// Where browsers send Content-Security-Policy violation reports (WS6, 26 Nov
// 2026). The policy is REPORT-ONLY (vercel.json): it blocks nothing, and each
// violation it would have blocked arrives here. Each report becomes one line
// in the Vercel function log, prefixed "[csp]":
//
//   [csp] connect-src blocked https://api.example.com on /  (source: https://maddex.vercel.app/assets/x.js)
//
// See them in the Vercel dashboard → the project → Logs, filtered on "[csp]"
// (docs/SECURITY.md). Only the directive, the blocked origin, the page's path
// and the script's origin and path are logged: never a query string (it can
// hold a token), a user agent, an IP or anything about the visitor.
//
// Accepts both formats: `report-uri` (application/csp-report, one report) and
// `report-to` (application/reports+json, a list). Always answers 204, so a
// browser has nothing to retry; a cap per instance stops a flood filling the log.

const CAP_PER_MINUTE = 120
let minute = null
let count = 0

// An origin plus path, never a query or fragment; keywords pass through.
export function cleanUrl(v) {
  if (typeof v !== 'string' || !v) return null
  if (/^(inline|eval|wasm-eval|trusted-types-sink|data|blob|self)$/.test(v)) return v
  try {
    const u = new URL(v)
    if (u.protocol === 'data:' || u.protocol === 'blob:') return u.protocol.slice(0, -1)
    return `${u.origin}${u.pathname}`.slice(0, 200)
  } catch { return String(v).replace(/[?#].*$/, '').slice(0, 80) }
}

const originOf = (v) => { const c = cleanUrl(v); try { return c && /^https?:/.test(c) ? new URL(c).origin : c } catch { return c } }

// The reports in a body, normalised to { directive, blocked, page, source }.
export function readReports(body) {
  let b = body
  // Vercel parses only JSON, form and text bodies; csp-report and
  // reports+json arrive as a Buffer.
  if (b && typeof b === 'object' && typeof b.byteLength === 'number' && typeof b.toString === 'function' && !Array.isArray(b)) b = b.toString('utf8')
  if (typeof b === 'string') { try { b = JSON.parse(b) } catch { return [] } }
  const list = Array.isArray(b) ? b.filter((r) => r?.type === 'csp-violation').map((r) => r.body ?? {}) : b?.['csp-report'] ? [b['csp-report']] : []
  return list.slice(0, 20).map((r) => ({
    directive: String(r.effectiveDirective ?? r['effective-directive'] ?? r['violated-directive'] ?? '?').split(' ')[0].slice(0, 40),
    blocked: originOf(r.blockedURL ?? r['blocked-uri']),
    page: (() => { try { return new URL(r.documentURL ?? r['document-uri']).pathname.slice(0, 80) } catch { return '?' } })(),
    source: cleanUrl(r.sourceFile ?? r['source-file']),
  }))
}

export default async function handler(req, res, now = Date.now()) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end() }
  let body
  try { body = req.body } catch { return res.status(204).end() } // malformed JSON: nothing to log
  if (body != null && (body.byteLength ?? JSON.stringify(body).length) > 64_000) return res.status(204).end()
  const m = Math.floor(now / 60_000)
  if (m !== minute) { minute = m; count = 0 }
  for (const r of readReports(body)) {
    if (++count > CAP_PER_MINUTE) break
    console.warn(`[csp] ${r.directive} blocked ${r.blocked ?? '?'} on ${r.page}${r.source ? `  (source: ${r.source})` : ''}`)
  }
  return res.status(204).end()
}
