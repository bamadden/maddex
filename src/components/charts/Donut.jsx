// A ring chart from slices of { label, value, color }. SVG, no chart library:
// the crypto holdings and DeFi category breakdowns both need one, and a
// recharts PieChart for a static ring is a lot of bundle for a circle.
// `centre` renders inside the ring (a total, usually).
export default function Donut({ slices, size = 140, thickness = 22, centre = null, label = 'Breakdown' }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const lens = slices.map((x) => (Math.max(0, x.value) / total) * c)
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0F1E35" strokeWidth={thickness} />
        {slices.map((s, i) => (
          <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${lens[i]} ${c - lens[i]}`} strokeDashoffset={-starts[i]} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <title>{`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}</title>
          </circle>
        ))}
      </svg>
      {centre && <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">{centre}</div>}
    </div>
  )
}
