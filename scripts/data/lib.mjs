// Shared by the source fetchers (scripts/data/sources/*.mjs).
import fs from 'node:fs'
import path from 'node:path'

const UA = 'Maddex data check (maddex.vercel.app)'
export const sydneyDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

// A fetch that records the shape of every response it returns: for CSV the
// header row (and any 'Title' / 'Series ID' rows the RBA puts above its
// data), for JSON the top-level keys. The format check (format-check.mjs)
// compares these with the last accepted shapes.
export function recordingFetch(shapes, { timeoutMs = 25_000 } = {}) {
  return async (url, init = {}) => {
    let res
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) })
        if (res.ok || res.status < 500) break
      } catch (e) { if (attempt) throw e }
    }
    const text = await res.text()
    shapes[shapeKey(url)] = { status: res.status, ...shapeOf(text) }
    return new Response(text, { status: res.status, headers: res.headers })
  }
}

const shapeKey = (url) => String(url).replace(/([?&](startPeriod|lastNObservations|recent|startyear|endyear)=)[^&]*/g, '$1*')
export function shapeOf(text) {
  const t = text.replace(/^﻿/, '').trim()
  if (/^[[{]/.test(t)) {
    try { const j = JSON.parse(t); return { kind: 'json', keys: Object.keys(Array.isArray(j) ? j[0] ?? {} : j).sort() } } catch { return { kind: 'invalid-json' } }
  }
  // HTML (the EIA history tables): the title, the table's column headings and
  // whether the cells the parser reads are there. Never the page itself: it
  // carries each day's prices, so it differs every night (26 Nov 2026).
  if (/^<(!doctype|html)/i.test(t)) {
    const clean = (s) => s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    return {
      kind: 'html',
      title: clean(t.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
      columns: [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => clean(m[1])).slice(0, 12),
      cells: ['B6', 'B3'].filter((c) => t.includes(`<td class='${c}'>`)),
    }
  }
  const lines = t.split(/\r?\n/)
  const pick = (label) => lines.find((l) => l.startsWith(`${label},`)) ?? null
  return { kind: 'csv', header: pick('Title') ?? lines[0], seriesIds: pick('Series ID') }
}

// Simple CSV row split that respects quoted commas.
export const cells = (line) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => m[2] ?? m[1]).slice(0, -1)

export const RECORDS = path.resolve(new URL('../../data/records', import.meta.url).pathname)
export function writeRecord(record) {
  const dir = path.join(RECORDS, record.source)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${sydneyDate(new Date(record.fetchedAt))}.json`)
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
  return file
}
export function latestRecord(source) {
  const dir = path.join(RECORDS, source)
  if (!fs.existsSync(dir)) return null
  const last = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().at(-1)
  return last ? JSON.parse(fs.readFileSync(path.join(dir, last), 'utf8')) : null
}

// One verification row. `ours` and `official` are numbers or null.
export function row(label, constant, ours, official, period, { tolerance = 0.005, note = null } = {}) {
  const status = official == null ? 'unavailable' : ours == null ? 'missing' : Math.abs(ours - official) <= tolerance ? 'match' : 'drift'
  return { label, constant, ours, official, period, status, note }
}
