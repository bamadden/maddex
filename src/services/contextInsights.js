// ─── Context insights ───────────────────────────────────────────────────────
//
// The one-line observations MaddenAI offers about what the user is looking
// at — "your portfolio is down A$284 today, Materials is driving it". Every
// figure is computed here from data already on screen; MaddenAI is only asked
// to explain it, never to supply it (see verifiedConstants' header).

const money = (v) => `A$${Math.abs(v).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`

// rows: [{ mktVal, dayPct, sector }] — positions with a live price.
// Returns null when there is nothing honest to say (no prices, no move).
export function portfolioDayInsight(rows) {
  const live = rows.filter((r) => r.mktVal > 0 && Number.isFinite(r.dayPct))
  if (!live.length) return null
  const total = live.reduce((s, r) => s + r.mktVal, 0)
  const move = live.reduce((s, r) => s + r.mktVal * (r.dayPct / 100), 0)
  const startValue = total - move
  const pct = startValue > 0 ? (move / startValue) * 100 : 0
  if (Math.abs(move) < 1) return null

  const bySector = new Map()
  for (const r of live) {
    const k = r.sector ?? 'Other'
    bySector.set(k, (bySector.get(k) ?? 0) + r.mktVal * (r.dayPct / 100))
  }
  // The sector contributing most in the direction of the day's move. It is
  // only "driving" the move when it accounts for at least half of it.
  const [lead, leadMove] = [...bySector.entries()]
    .filter(([, v]) => Math.sign(v) === Math.sign(move))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? []
  const share = lead ? leadMove / move : 0
  const dir = move >= 0 ? 'up' : 'down'
  const head = `Your portfolio is ${dir} ${money(move)} today (${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%).`
  const why = !lead || lead === 'Other' || bySector.size < 2 ? ''
    : share >= 0.5 ? ` ${lead} holdings are driving the move.` : ` ${lead} holdings contributed most.`
  return {
    text: head + why,
    move, pct, lead: lead ?? null, leadMove: leadMove ?? null,
    prompt: `My portfolio is ${dir} ${money(move)} today (${pct >= 0 ? '+' : '-'}${Math.abs(pct).toFixed(2)}%).` +
      (lead ? ` By sector, ${[...bySector.entries()].map(([k, v]) => `${k} ${v >= 0 ? '+' : '-'}${money(v)}`).join(', ')}.` : '') +
      ' Explain what is likely behind today\'s move in my holdings, and whether anything in it needs my attention. Use only these figures.',
  }
}
