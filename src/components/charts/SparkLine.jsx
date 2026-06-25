import { LineChart, Line, ResponsiveContainer } from 'recharts'

export default function SparkLine({ data, color = 'var(--color-gain)', height = 28 }) {
  if (!data || data.length < 2) return <span className="text-terminal-text-dim text-2xs">—</span>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
