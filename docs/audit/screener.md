# Audit: Screener

Phase D, 16 Nov 2026. File: `src/modules/screener/ScreenerModule.jsx`.
Surveyed with a read-only agent; each finding checked in the code.

| # | Impact | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | High: legal | Presets framed results as picks: RATE HIKE WINNERS / VICTIMS, VALUE PLAYS, OVERSOLD QUALITY, DEFENSIVE QUALITY, "benefit from", "pricing power", "payout more likely sustainable" | `:112-187` | Done 16 Nov: named by their criteria; keys kept so saved screens still load |
| 2 | High: legal | Yield prompt: "what should I consider about these results?"; interpret prompt named stocks "that would match and why" | `:248, :844` | Done: describe the criteria and measures; no stock names or ranking |
| 3 | High: honesty | Cash and term-deposit rates with no badge | `:256` | Done: HandEnteredBadge (RBA) |
| 4 | Medium: judgement | Yield "premium" green/amber; match bar green | `:265-271, :453` | Done: neutral; "above / below the cash rate" |
| 5 | Medium: honesty | No 52-week data shown as mid-range (50) or at the high (0); `null < 30` matched two screens | `:33-34, :115, :210` | Done: null, excluded from those screens, "—" |
| 6 | Medium: honesty | Ask MaddenAI sent a simulated price as "Current Price" | `:1410` | Done: labelled demo |
| 7 | Medium: a11y | Hover-only icon buttons unnamed and unreachable by keyboard | `:1112, :1406` | Done: named, visible on focus |
| 8 | Low: times | Saved-screen dates browser-local; CSV name UTC | `:1107, :946` | Done |
| 9 | Medium: a11y | Clickable rows and sortable headers mouse-only | `:1295, :1347, :1372` | Next (Phase F a11y pass) |
