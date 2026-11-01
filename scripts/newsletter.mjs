// The newsletter's human approval step (services/newsletterEdition.js).
//
//   node --import ./tests/setup/resolve.mjs scripts/newsletter.mjs draft <review.json> <weekKey> <friday YYYY-MM-DD>
//       Builds a draft from a weekly review exported as JSON, runs the content
//       check, writes data/newsletter/drafts/<weekKey>.json and prints it.
//   node --import ./tests/setup/resolve.mjs scripts/newsletter.mjs approve <weekKey>
//       Records approval of that draft by NEWSLETTER_APPROVER (or git
//       user.name): the approved copy, the approver, the time and a hash go to
//       data/newsletter/approved/<weekKey>.json. Refuses a draft that fails the
//       content rules. Run it only after reading the draft yourself.
//   node --import ./tests/setup/resolve.mjs scripts/newsletter.mjs status
//
// Sending is not built. Whatever sends must call assertSendable() on the
// approved file and send exactly its body.

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { draftEdition, approveEdition, assertSendable } from '../src/services/newsletterEdition.js'

const DIR = 'data/newsletter'
// Approved copies live in data/newsletter/approved (named apart from the
// graph's approved.json, whose only writer is scripts/graphReview.js).
const drafts = path.join(DIR, 'drafts'), signedDir = path.join(DIR, 'approved')
const [cmd, ...args] = process.argv.slice(2)

const approver = () => {
  if (process.env.NEWSLETTER_APPROVER) return process.env.NEWSLETTER_APPROVER
  try { return execSync('git config user.name', { encoding: 'utf8' }).trim() } catch { return '' }
}

if (cmd === 'draft') {
  const [file, key, friday] = args
  if (!file || !key || !friday) { console.error('usage: draft <review.json> <weekKey> <friday>'); process.exit(2) }
  const d = draftEdition(JSON.parse(fs.readFileSync(file, 'utf8')), { key, friday })
  fs.mkdirSync(drafts, { recursive: true })
  fs.writeFileSync(path.join(drafts, `${key}.json`), `${JSON.stringify(d, null, 2)}\n`)
  console.log(d.body)
  console.log(d.flags.length ? `\n✖ ${d.flags.length} content problem(s):\n${d.flags.map((f) => `  ${f.rule}: ${f.sentence}`).join('\n')}` : '\n✓ passes the content rules — read it, then approve')
} else if (cmd === 'approve') {
  const [key] = args
  const d = JSON.parse(fs.readFileSync(path.join(drafts, `${key}.json`), 'utf8'))
  const a = approveEdition(d, approver())
  assertSendable(a)
  fs.mkdirSync(signedDir, { recursive: true })
  fs.writeFileSync(path.join(signedDir, `${key}.json`), `${JSON.stringify(a, null, 2)}\n`)
  console.log(`✓ ${key} approved by ${a.approvedBy} at ${a.approvedAt} (hash ${a.approvedHash})`)
} else if (cmd === 'status') {
  for (const [label, dir] of [['drafts', drafts], ['approved', signedDir]]) {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
    console.log(`${label}: ${files.length ? files.join(', ') : 'none'}`)
  }
} else {
  console.error('usage: newsletter.mjs draft|approve|status'); process.exit(2)
}
