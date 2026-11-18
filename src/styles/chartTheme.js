// One chart style (WS3, 19 Nov 2026), for every recharts chart: recessive
// axes and grid, 11px muted ticks, 2px lines, a tooltip on the panel colour.
// Spread the props: <XAxis {...CHART.xAxis} dataKey="m" />. Colours stay in
// PAL; series colours follow the entity, not its rank (docs/DESIGN_SYSTEM.md).
import { PAL } from './palette.js'

const tick = { fill: PAL.muted, fontSize: 11 }

export const CHART = {
  xAxis: { tick, axisLine: false, tickLine: false },
  yAxis: { tick, axisLine: false, tickLine: false, width: 52 },
  grid: { stroke: 'rgba(139,163,196,0.12)', vertical: false },
  line: { strokeWidth: 2, dot: false, isAnimationActive: false },
  tooltip: {
    contentStyle: { background: PAL.panel, border: '1px solid rgba(201,168,76,0.3)', borderRadius: 2, fontSize: 11, color: PAL.bright },
    labelStyle: { color: PAL.muted, fontSize: 11 },
    itemStyle: { color: PAL.bright, fontSize: 11 },
    cursor: { stroke: 'rgba(201,168,76,0.4)', strokeWidth: 1 },
  },
  margin: { top: 24, right: 12, left: 0, bottom: 4 },
}
