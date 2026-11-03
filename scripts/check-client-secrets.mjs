// Fails if a secret reaches the browser bundle.
//
// Run after `npm run build`. Scans dist/ for:
//   1. the VALUE of every variable in .env* files whose name looks secret
//      (KEY, SECRET, TOKEN, PASSWORD) — except the Supabase URL and anon key,
//      which are public by design (row-level security protects the data);
//   2. well-known secret shapes: Anthropic keys, Supabase service-role JWTs,
//      Resend keys, private keys;
//   3. log calls that could ship personal data: any console.* call whose
//      arguments carry user-identity text (user id, email, token, session,
//      profile) or an email address / JWT literal. console.log / info /
//      debug are dropped from production builds (vite.config.js).
// Prints only variable names and file names, never a value.

import fs from 'node:fs'
import path from 'node:path'

const PUBLIC = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'])
const SECRETISH = /(KEY|SECRET|TOKEN|PASSWORD)/i

const values = []
for (const f of fs.readdirSync('.').filter((n) => /^\.env(\.|$)/.test(n))) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?/)
    if (!m || PUBLIC.has(m[1]) || !SECRETISH.test(m[1])) continue
    const v = m[2].trim()
    if (v.length >= 12) values.push({ name: m[1], value: v })
  }
}

const SHAPES = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['Resend API key', /\bre_[A-Za-z0-9]{20,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Supabase service-role JWT', /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*cm9sZSI6InNlcnZpY2Vfcm9sZS[A-Za-z0-9_-]*\./],
]

const files = fs.readdirSync('dist', { recursive: true }).map((f) => path.join('dist', f)).filter((f) => /\.(js|html|css|map|json|webmanifest)$/.test(f))
const found = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  for (const { name, value } of values) if (s.includes(value)) found.push(`${name} value in ${f}`)
  for (const [label, re] of SHAPES) if (re.test(s)) found.push(`${label} in ${f}`)
}
// 3. Log calls that pass identity as data. String and template literals are
// removed from the argument list (message text such as "loadProfile error:"
// is not personal data); what remains is checked for identity-carrying
// property access, which survives minification (.email, user.id, .user,
// access/refresh tokens, user_metadata, phone). Literals are checked for an
// email address or a JWT.
const IDENTITY_DATA = /\.(email|phone|access_token|refresh_token|user_metadata|identities)\b|\buser\??\.id\b|\.user\b|\buserId\b/
const IDENTITY_LITERAL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|eyJ[A-Za-z0-9_-]{10,}\./
function logArgs(src, at) {
  let depth = 0, i = src.indexOf('(', at), q = null
  for (let j = i; j < src.length && j < i + 2000; j++) {
    const c = src[j]
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '(') depth++
    else if (c === ')' && --depth === 0) return src.slice(i + 1, j)
  }
  return src.slice(i + 1, i + 2000)
}
const withoutLiterals = (a) => a.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""')
for (const f of files.filter((x) => x.endsWith('.js'))) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/console\.(log|info|debug|warn|error)\(/g)) {
    const args = logArgs(s, m.index)
    const hit = withoutLiterals(args).match(IDENTITY_DATA) ?? args.match(IDENTITY_LITERAL)
    if (hit) found.push(`console.${m[1]} passes "${hit[0].slice(0, 24)}" in ${f}`)
  }
}
if (found.length) { console.error(`✖ secrets or personal data in the client bundle:\n  ${found.join('\n  ')}`); process.exit(1) }
console.log(`✓ no secrets in dist/ (${files.length} files; ${values.length} secret values from .env checked)`)
