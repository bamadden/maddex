// Model prose arrives as plain text that sometimes carries markdown. Strip the
// markup rather than render it — a stray "**" reads as a glitch.
export const clean = (t) => String(t ?? '').replace(/\*\*|__|^#+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '')
