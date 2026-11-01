// Fails if a secret reaches the browser bundle.
//
// Run after `npm run build`. Scans dist/ for:
//   1. the VALUE of every variable in .env* files whose name looks secret
//      (KEY, SECRET, TOKEN, PASSWORD) — except the Supabase URL and anon key,
//      which are public by design (row-level security protects the data);
//   2. well-known secret shapes: Anthropic keys, Supabase service-role JWTs,
//      Resend keys, private keys.
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
if (found.length) { console.error(`✖ secrets in the client bundle:\n  ${found.join('\n  ')}`); process.exit(1) }
console.log(`✓ no secrets in dist/ (${files.length} files; ${values.length} secret values from .env checked)`)
