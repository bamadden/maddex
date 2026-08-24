// Shared helpers for the Three.js visualisations — kept tiny and
// dependency-free so each visualisation file stays focused on its own scene.

export const GAIN_COLOR   = '#3aaa63'
export const GAIN_BRIGHT  = '#4ade80'
export const LOSS_COLOR   = '#a83232'
export const LOSS_BRIGHT  = '#f87171'
export const NEUTRAL      = '#8a94a6'
export const GOLD         = '#c8a84b'
export const BG_COLOR     = '#060D1A'

// Interpolates between loss/neutral/gain colour stops based on a signed
// percentage, clamped to +/-clampPct for the gradient range.
export function pctToColor(pct, clampPct = 5) {
  if (pct == null || Number.isNaN(pct)) return NEUTRAL
  const t = Math.max(-1, Math.min(1, pct / clampPct))
  const lerp = (a, b, f) => Math.round(a + (b - a) * f)
  const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  const rgbToHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')
  const neutral = hexToRgb('8a94a6')
  const gain = hexToRgb('3aaa63')
  const loss = hexToRgb('a83232')
  if (t >= 0) {
    return rgbToHex(neutral.map((c, i) => lerp(c, gain[i], t)))
  }
  return rgbToHex(neutral.map((c, i) => lerp(c, loss[i], -t)))
}

// Normalises a value against the max of a set into a [min, max] range —
// used for bar/sphere sizing so the largest item always fills the scene
// nicely regardless of absolute scale (market cap, volume, etc).
export function normalise(value, maxValue, outMin = 0.4, outMax = 4) {
  if (!maxValue || value == null) return outMin
  const t = Math.max(0, Math.min(1, value / maxValue))
  return outMin + t * (outMax - outMin)
}
