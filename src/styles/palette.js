// The colour tokens for values set in JavaScript (inline styles, charts,
// canvas, SVG). Tailwind classes use the matching terminal-* tokens, which
// resolve through CSS variables (index.css, hooks/useTheme).
//
// Values stay hex so code that appends an alpha suffix (`${PAL.gold}66`)
// keeps working. up / down / muted were raised on 1 Nov 2026 to pass WCAG AA
// (4.5:1) on every panel background: the old red #A83232 was 2.4–2.9:1, the
// old green #2D8A50 3.6–4.5:1 and the old label grey #4A6080 2.5–3.0:1.
export const PAL = {
  gold:    '#C9A84C',
  up:      '#3FB06B',   // positive change — 5.7:1 on the lightest panel row
  down:    '#EB6B66',   // negative change — 5.1:1 on the lightest panel row
  dim:     '#8BA3C4',   // secondary text
  muted:   '#7D93B5',   // labels, captions — 5.0:1
  bright:  '#E8EDF5',   // primary text
  amber:   '#E8A33D',
  blue:    '#2D7DD2',
  bg:      '#060D1A',
  panel:   '#0B1628',
  header:  '#0F1E35',
}
