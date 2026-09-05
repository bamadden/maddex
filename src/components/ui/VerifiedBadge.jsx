import Tooltip from './Tooltip'
import { daysSinceVerified, isStale, provenance, VERIFY_WARN_DAYS } from '../../data/verifiedConstants'

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
          fontSize: 8,
          letterSpacing: '0.1em',
          padding: '1px 5px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
          background: stale ? 'rgba(201,168,76,0.15)' : 'rgba(99,120,153,0.12)',
          border: `1px solid ${stale ? 'rgba(201,168,76,0.45)' : 'rgba(99,120,153,0.25)'}`,
          color: stale ? '#C9A84C' : '#637899',
        }}
      >
        {text}
      </span>
    </Tooltip>
  )
}

// Inline source marker for a live feed, the counterpart to the above. Live
// data earns a green dot; the tooltip says which API and how old.
export function LiveBadge({ label, ageMins, source = 'live', className = '' }) {
  const dim = source === 'stale' || source === 'fallback'
  const age = ageMins == null ? 'just now' : ageMins < 1 ? 'just now' : `${ageMins}m ago`
  return (
    <Tooltip content={`${label}\nLive feed · updated ${age}${dim ? '\n(serving cached data — last fetch failed)' : ''}`}>
      <span className={`inline-flex items-center gap-1 ${className}`}
        style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 8, letterSpacing: '0.1em', color: dim ? '#C9A84C' : '#2D8A50' }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: dim ? '#C9A84C' : '#2D8A50', display: 'inline-block' }} />
        {dim ? 'CACHED' : 'LIVE'}
      </span>
    </Tooltip>
  )
}
