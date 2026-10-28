// MaddenAI market-score bands, shared by the Brief module's gauge and the
// dashboard's brief widget so a score is the same colour in both places.
export const BRIEF_BANDS = [
  { from: 0,  to: 30,  color: '#A83232' }, // BEARISH
  { from: 30, to: 50,  color: '#C9A84C' }, // CAUTIOUS (amber-ish gold)
  { from: 50, to: 70,  color: '#E8C96A' }, // NEUTRAL
  { from: 70, to: 85,  color: '#6FCB8F' }, // BULLISH (light green)
  { from: 85, to: 100, color: '#2D8A50' }, // STRONGLY BULLISH
]

export const scoreColour = (score) => BRIEF_BANDS.find((b) => score >= b.from && (score <= b.to || b.to === 100))?.color ?? '#8BA3C4'
