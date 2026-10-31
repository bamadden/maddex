# RBA decision day — runbook

Next decision: **Tuesday 3 November 2026, 2:30pm AEDT**. The meeting after
it is **Tuesday 8 December 2026**. Target: the update is live within 15
minutes of the statement.

## What happens on its own at 2:30pm

Nothing needs editing for the pre-decision material to go away. Every
pre-decision element reads `pendingRbaDecision()` in
`src/data/verifiedConstants.js`, which returns null once **either** of these
is true:

- the clock passes 2:30pm Sydney on `rbaNextDecision.date`;
- `rba.lastDecision` is updated to that date (or later).

Between 2:30pm and your update, the Rates hero says "Announced 2:30pm —
Result shown here once verified". It does not guess the outcome.

Last verified on 31 Oct 2026 in a headless test with the clock set to
3 Nov 5pm and a hypothetical decision in place (reverted afterwards). The
script is `rbaday.mjs` in that session's scratchpad, and the stale-element
audit is below.

## The update — one file, then the calendar

### 1. `src/data/verifiedConstants.js` → `rba`

Read the media release first: rba.gov.au → Media Releases → "Statement by
the Reserve Bank Board: Monetary Policy Decision". Take the vote from the
statement itself.

| Field | HIKE 25bp (example) | HOLD (example) |
|---|---|---|
| `cashRate` | `4.85` | `4.60` (unchanged) |
| `previousRate` | `4.60` | `4.60` |
| `lastChange` | `'+25bp'` | `'0bp'` |
| `lastDecision` | `'2026-11-03'` | `'2026-11-03'` |
| `lastDecisionVerb` | `'HIKE'` | `'HOLD'` |
| `nextMeeting` | `'2026-12-08'` | `'2026-12-08'` |
| `note` | one line in the statement's terms, plus the vote | same |
| `nextMeetingNote` | `null`, or a dated, sourced line about 8 Dec | same |
| `levelContext` | `'the highest since 2008'` ¹ | leave as is (`'the highest since 2011'`) |
| `source` | `'rba.gov.au (mr-26-XX)'` | same |
| `asOf` / `lastVerified` | `'2026-11-03'` | same |

¹ Table A2, read 31 Oct 2026: the 2010–11 peak was 4.75%. The last level
above 4.85% was 5.25%, effective from 5 Nov 2008 until the cut to 4.25% on
3 Dec 2008. If the move is anything other than +25bp, re-read A2.

Then add the decision to the history, and replace the statement:

```js
// append to rba.decisions
{ date: '2026-11-03', rate: 4.85, decision: 'HIKE', change: 25, vote: 'Unanimous',
  reason: '<one line from the statement>' },

// replace rba.latestStatement
latestStatement: {
  date: '2026-11-03',
  keyPoints: [ /* three to five short lines, in the statement's own words */ ],
  marketReaction: null,   // later: one dated, sourced line (AUD, ASX 200, 3Y yield)
  url: 'https://www.rba.gov.au/media-releases/2026/mr-26-XX.html',
},
```

For a hold, use `change: 0` and `decision: 'HOLD'`. Leave `minutes` alone:
the minutes of this meeting come out two weeks later, on Tue 17 Nov.

### 2. `rbaNextDecision` — leave it

It retires itself once `lastDecision` moves, so the ~85% reading is no
longer shown anywhere. Do not copy it forward to 8 Dec. Only replace it when
there is a new dated, sourced pricing reading for the December meeting:
change `date`, `currentRate`, `hikeRate`, `marketHikePct`, `marketSource`,
`marketAsOf`, `statementQuote` and `statementUrl` together.

### 3. `src/services/calendarService.js`

- Delete the 3 Nov `RBA Rate Decision` row from the forward list.
- Append to `FALLBACK_PREVIOUS`:
  `{ date: '2026-11-03', event: 'RBA Rate Decision', region: 'AU', result: 'HIKE +25bp to 4.85% (vote)' }`.
- Give the 8 Dec row a `description` (e.g. "Cash rate 4.85% after the
  3 Nov hike, the fifth of 2026."), plus `sourceUrl`, `sourceLabel` and
  `watch: ['cashRate']`, copied from the old 3 Nov row.

### 4. Check, then push

```bash
npm run check-stats    # see the note below
npx eslint src         # 0 errors (9 warnings is the baseline)
npm run build
git add -A
git commit -m "fix: RBA decision 3 Nov 2026 — <HIKE +25bp to 4.85% | HOLD at 4.60%> (<vote>)"
git push origin main
```

**Timing note.** Table A2 records a change on its *effective* date, the day
after the announcement (a 3 Nov hike shows as 04-Nov-2026). If A2 has not
updated yet:
- check-stats reports the cash rate as a mismatch;
- the hero's LIVE CHECK badge shows DRIFT.

Both clear once the RBA publishes the row. If they persist the next
morning, rerun check-stats and investigate.

## What switches on after the update

| Element | Where | Window |
|---|---|---|
| Post-decision quick prompts ("WHAT DID THE RBA JUST DECIDE?" …) | MaddenAI on Dashboard / Rates / Macro | 7 days from 2:30pm |
| Decision card "RBA HIKED 25bp ON 3 NOVEMBER" | top of Rates | 14 days, dismissable |
| Hero: verb + date, "from X%", countdown to 8 Dec | Rates | until the next decision |
| Portfolio rate-impact banner | Portfolio → Holdings | 3 days |
| `RBA_DECISION` smart notification | notification centre | once |
| Decision line in the MaddenAI context | every chat turn | 7 days |

## Stale-element audit (31 Oct 2026)

Every element below was checked with `lastDecision = '2026-11-03'` set and
the clock left at 31 Oct, so the hiding is due to the update and not the
time. All of them now go through `pendingRbaDecision()`.

| Element | Hid on time before this change? | Hides on lastDecision now? |
|---|---|---|
| "⚠ HIGH HIKE PROBABILITY — RBA MEETING IN X DAYS · ~85%" banner (Rates) | yes | ✓ |
| "FIFTH HIKE OF 2026 PRICED IN" (hero) | yes | ✓ |
| HIKE 85% / HOLD 15% bars (hero) | yes | ✓ |
| RBA decision preview strip + MaddenAI PREVIEW button (Rates) | yes | ✓ |
| Hike impact panel (Rates) | yes | ✓ |
| HIKE / HOLD scenario curves (Rates yield curve) | yes | ✓ |
| Decision-week quick prompts ("WHAT DOES 85% HIKE PRICING MEAN?") | yes | ✓ |
| Market Pulse widget pricing (Dashboard) | yes | ✓ |
| Intelligence feed "RBA decision in N days — ~85% hike priced" | yes | ✓ |
| Personal digest "RBA decides in N days (~85% hike priced)" | yes | ✓ |
| 72-hour RBA proximity notification | yes | ✓ |
| Calculator HOLD / HIKE presets and hike note | yes | ✓ |
| Screener yield bar AI prompt | yes | ✓ |
| Morning brief "Next RBA decision … ~85%" line | yes | ✓ |
| MaddenAI context pricing line | yes | ✓ |
| Data health "Next RBA decision" row | **no** — kept showing 3 Nov after it passed | ✓ fixed |
| Macro sensitivity matrix "Markets price ~85%…" | **no** — ran to local midnight | ✓ fixed |
| Research note macro block "Next RBA decision … ~85%" | **no** — never hid | ✓ fixed |
| Macro theme prompt "Market pricing … ~85%" | **no** — never hid | ✓ fixed |
| Stress test label "RBA HIKES TO 4.85% (3 NOV)" | **no** — never hid | ✓ fixed ² |
| Portfolio analytics "hike to 4.85%" | **no** — never hid | ✓ fixed |
| Digest "Today 14:30: RBA Rate Decision" after 2:30pm | **no** — stayed all day | ✓ fixed: past timed events drop off |

² The stress-test label is computed when the module first loads. A tab left
open across 2:30pm keeps the old label until it is reloaded.

Things that need the manual update rather than the clock:
- the static text in `rba.note`, `nextMeetingNote` and `levelContext`;
- the 3 Nov calendar row's description;
- `rba.source` / `asOf`, which feed the hero's provenance line.
