// Records the current prompt versions as accepted (tests/fixtures/promptVersions.json).
// Run only after updating the tests that pin a changed prompt's wording.
import fs from 'node:fs'
import { promptVersions } from '../src/services/promptRegistry.js'
const file = new URL('../tests/fixtures/promptVersions.json', import.meta.url)
const before = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
const now = promptVersions()
for (const [k, v] of Object.entries(now)) if (before[k] !== v) console.log(`${before[k] ? 'changed' : 'new'}: ${v}${before[k] ? ` (was ${before[k]})` : ''}`)
for (const k of Object.keys(before)) if (!(k in now)) console.log(`removed: ${k}`)
fs.writeFileSync(file, `${JSON.stringify(now, null, 2)}\n`)
console.log(`Accepted ${Object.keys(now).length} prompt versions.`)
