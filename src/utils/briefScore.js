import { PAL } from '../styles/palette.js'
// MaddenAI market-score bands, shared by the Brief module's gauge and the
// dashboard's brief widget so a score is the same colour in both places.
export const BRIEF_BANDS = [
  { from: 0,  to: 30,  color: PAL.down }, // BEARISH
  { from: 30, to: 50,  color: PAL.gold }, // CAUTIOUS (amber-ish gold)
  { from: 50, to: 70,  color: '#E8C96A' }, // NEUTRAL
  { from: 70, to: 85,  color: '#6FCB8F' }, // BULLISH (light green)
  { from: 85, to: 100, color: PAL.up }, // STRONGLY BULLISH
]

export const scoreColour = (score) => BRIEF_BANDS.find((b) => score >= b.from && (score <= b.to || b.to === 100))?.color ?? PAL.dim

// MaddenAI's outlook is words only (it never gives a score), coloured on the
// same scale: bearish red, cautious gold, bullish green.
const OUTLOOK = {
  'STRONGLY BEARISH': PAL.down, BEARISH: PAL.down, 'CAUTIOUSLY BEARISH': PAL.gold,
  NEUTRAL: '#E8C96A', 'CAUTIOUSLY BULLISH': '#6FCB8F', BULLISH: '#6FCB8F', 'STRONGLY BULLISH': PAL.up,
}
export const outlookColour = (label) => OUTLOOK[String(label ?? '').toUpperCase()] ?? PAL.dim
