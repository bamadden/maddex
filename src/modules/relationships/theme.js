// Shared look and formatting for the Relationships screens.

export const TYPE_COLOUR = {
  company: '#8BA3C4', commodity: '#C4653A', macro: '#6FA34A', index: '#7B8FD1',
  etf: '#A37BD1', person: '#5F7896', fund: '#3FA7A0',
}
// Solid = VERIFIED, dotted = DISCLOSED, dashed = INFERRED.
export const DASH = { VERIFIED: null, DISCLOSED: '2 3', INFERRED: '6 4' }
export const CONF_TONE = { VERIFIED: '#2D8A50', DISCLOSED: '#8BA3C4', INFERRED: '#C9A84C' }
export const STALE_TONE = '#C4653A'
// Held and watched nodes: green, so gold stays reserved for the selection.
export const HELD_TONE = '#2D8A50'

export const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const nodeLabel = (n) => n.ticker ?? (n.type === 'person' ? n.name.split(' ').slice(-1)[0] : n.name)
export const pageOf = (e) => e.page ?? (Number(String(e.source?.url ?? '').match(/#page=(\d+)/)?.[1]) || null)
