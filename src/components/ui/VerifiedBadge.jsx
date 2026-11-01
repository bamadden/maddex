import DataBadge from './DataBadge'
import { classOfLiveSource } from '../../utils/dataClass'
import Tooltip from './Tooltip'
import { daysSinceVerified, isStale, provenance, VERIFY_WARN_DAYS } from '../../data/verifiedConstants'
import { PAL } from '../../styles/palette.js'

// Provenance marker for a manually-maintained figure.
//
// The point is asymmetry: fresh data stays quiet, stale data gets loud. A
// number that was checked today needs no chrome; one that has not been
// checked in three weeks should say so on the face of the UI rather than
// hiding the fact in a tooltip nobody opens.
//
// `alwaysShow` forces the quiet form to render for tables that want a
// consistent column.
export default function VerifiedBadge({ dataKey, alwaysShow = false, className = '' }) {
  const days = daysSinceVerified(dataKey)
  if (days == null) return null

  const stale = isStale(dataKey)
  if (!stale && !alwaysShow) return null

  const text = stale
    ? `⚠ ${days}D OLD`
    : days === 0 ? 'VERIFIED TODAY' : `VERIFIED ${days}D AGO`

  return (
    <Tooltip content={`${provenance(dataKey)}\n\nManually maintained — not a live feed.\nFlagged once older than ${VERIFY_WARN_DAYS} days.`}>
      <span
        className={className}
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          letterSpacing: '0.1em',
          padding: '1px 5px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
          background: stale ? 'rgba(201,168,76,0.15)' : 'rgba(99,120,153,0.12)',
          border: `1px solid ${stale ? 'rgba(201,168,76,0.45)' : 'rgba(99,120,153,0.25)'}`,
          color: stale ? PAL.gold : PAL.muted,
        }}
      >
        {text}
      </span>
    </Tooltip>
  )
}

// Inline source marker for a live feed, the counterpart to the above. Live
// data earns a green dot; the tooltip says which API and how old.
// A live feed in the one vocabulary: LIVE, or STALE when the last fetch
// failed and the cached copy is shown (it used to say "CACHED").
export function LiveBadge({ label, source = 'live', at = null, className = '' }) {
  return <DataBadge cls={classOfLiveSource(source)} source={label} at={at} className={className} />
}

// Provenance marker for AI-written prose, the third kind of content in the
// terminal after verified constants and live feeds.
//
// It exists because the three are not interchangeable and the reader should
// never have to guess which one they are looking at. A theme written by
// MaddenAI this morning and one recovered from yesterday's cache read
// identically on the page; only this says which.
//
// Deliberately quiet — AI prose is normal here, not an exception — but never
// silent, and it goes gold the moment the content stops being today's.
const AI_SOURCE_LABEL = {
  live:     { text: 'AI · TODAY',     dim: false },
  cache:    { text: 'AI · TODAY',     dim: false },
  stale:    { text: 'AI · YESTERDAY', dim: true  },
  fallback: { text: 'DEFAULT',        dim: true  },
  failed:   { text: 'DEFAULT',        dim: true  },
}

// `label` overrides the text for a caller that needs to name what grounds the
// prose as well as who wrote it — the news brief says "AI SUMMARY · LIVE DATA"
// because its figures come from live feeds while its sentences do not. The
// source still drives the colour, so an overridden badge goes gold when the
// content stops being today's exactly like every other one.
export function AIContentBadge({ source = 'fallback', label = null, className = '' }) {
  const meta = AI_SOURCE_LABEL[source] ?? AI_SOURCE_LABEL.fallback
  const detail = {
    live: 'Written by MaddenAI today from verified figures.',
    cache: 'Written by MaddenAI today from verified figures.',
    stale: "Yesterday's generation — today's request failed.\nStill broadly current, but a day behind.",
    fallback: 'Editorial default — the AI request was unavailable.',
    failed: 'Editorial default — the AI request was unavailable.',
  }[source] ?? 'Editorial default.'

  return (
    <Tooltip content={`${detail}\n\nAnalysis only. Every figure comes from verified constants or a live feed, never from the model.`}>
      <span
        className={className}
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          letterSpacing: '0.1em',
          padding: '1px 5px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
          background: meta.dim ? 'rgba(201,168,76,0.12)' : 'rgba(99,120,153,0.12)',
          border: `1px solid ${meta.dim ? 'rgba(201,168,76,0.4)' : 'rgba(99,120,153,0.25)'}`,
          color: meta.dim ? PAL.gold : PAL.muted,
        }}
      >
        {label ?? meta.text}
      </span>
    </Tooltip>
  )
}
