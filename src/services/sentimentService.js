import { getDaily } from './aiDailyClient'

// The market sentiment score — one per Sydney day, shared by every reader.
//
// Until 31 Oct 2026 this was generated in each reader's browser once per
// calendar hour, from the headlines that browser happened to have loaded: a
// thousand readers meant thousands of near-identical completions a day. It is
// now generated once on the server from public feeds (/api/ai-daily, kind
// "sentiment") and cached for everyone until Sydney midnight.
//
// The headlines argument is kept for callers but no longer used for the
// score: the server reads the feeds itself, so no reader's copy of the news
// can change what another reader sees. The keyword fallback in useSentiment
// still uses them when the shared score is unavailable.
export async function calculateSentiment() {
  const { data, generatedAt } = await getDaily('sentiment')
  return { ...data, generatedAt }
}
