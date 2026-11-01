// Plain tone words for displays that used "bullish" / "bearish". Those read as
// a market call; these describe direction only. Accepts the old words (cached
// AI content, scanner kinds) and returns the new ones.
const MAP = {
  'STRONGLY BULLISH': 'STRONGLY POSITIVE', 'EXTREMELY BULLISH': 'STRONGLY POSITIVE',
  BULLISH: 'POSITIVE', 'CAUTIOUSLY BULLISH': 'MIXED, LEANING POSITIVE', 'MILDLY BULLISH': 'MILDLY POSITIVE',
  'STRONGLY BEARISH': 'STRONGLY NEGATIVE', 'EXTREMELY BEARISH': 'STRONGLY NEGATIVE',
  BEARISH: 'NEGATIVE', 'CAUTIOUSLY BEARISH': 'MIXED, LEANING NEGATIVE', 'MILDLY BEARISH': 'MILDLY NEGATIVE',
}
export const toneWord = (v) => {
  const u = String(v ?? '').toUpperCase().trim()
  return MAP[u] ?? u
}
// -1 / 0 / 1 for colouring, from either vocabulary.
export const toneSign = (v) => {
  const u = toneWord(v)
  return /NEGATIVE/.test(u) && !/LEANING POSITIVE/.test(u) ? -1 : /POSITIVE/.test(u) ? 1 : 0
}
