// Gold and silver in AUD from ExchangeRate-API, fetched on the server so the
// key never reaches the browser. It used to be read in the client as
// import.meta.env.VITE_EXCHANGERATE_API_KEY, which Vite compiles into the
// public bundle (legal-risk pass, item 7: service keys stay server-side).
//
// Key: EXCHANGERATE_API_KEY (server-only); VITE_EXCHANGERATE_API_KEY is read
// as a fallback so an existing environment keeps working until it is renamed.
// Without a key: 204, and the tape simply has no metals segment.

export default async function handler(req, res) {
  const key = process.env.EXCHANGERATE_API_KEY || process.env.VITE_EXCHANGERATE_API_KEY
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')
  if (!key) return res.status(204).json(null)
  try {
    const r = await fetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/AUD`)
    const data = await r.json()
    if (data?.result !== 'success') return res.status(502).json({ error: 'upstream refused' })
    const { XAU, XAG } = data.conversion_rates ?? {}
    // Only the two rates the terminal shows, and the provider's update time.
    return res.status(200).json({ XAU: XAU ?? null, XAG: XAG ?? null, updated: data.time_last_update_utc ?? null })
  } catch {
    return res.status(502).json({ error: 'upstream unavailable' })
  }
}
