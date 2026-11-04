// The Terminal API is retired (5 Nov 2026). It was offered to Apex as
// "API access" but never worked as described: it accepted any key of the
// right shape without checking an account, and served demo data. Every
// request now gets 410 Gone, so any old caller sees a clear end rather than
// a 404. Nothing in the app links here (docs/CLAIMS_REGISTER.md P4).

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(410).json({ error: 'Gone: the Maddex Terminal API has been retired and serves no data.' })
}
