import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, LineStyle,
} from 'lightweight-charts'
import {
  generateOHLCV, PERIOD_DAYS, sma, ema, bollingerBands, rsi, macd,
} from '../../utils/generateOHLCV'

const PERIODS = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y']

const CHART_COLORS = {
  bg: '#060D1A',
  grid: '#0d1a2e',
  text: '#8a94a6',
  border: '#1a2b4a',
  up: '#3aaa63',
  down: '#a83232',
  gold: '#c8a84b',
  sma20: '#4a9dff',
  sma50: '#c8a84b',
  ema20: '#e879f9',
  bbBand: 'rgba(138,148,166,0.5)',
  rsi: '#c8a84b',
  macdLine: '#4a9dff',
  macdSignal: '#e879f9',
}

const INDICATOR_DEFS = [
  { key: 'sma20', label: 'SMA 20', pane: 'main' },
  { key: 'sma50', label: 'SMA 50', pane: 'main' },
  { key: 'ema20', label: 'EMA 20', pane: 'main' },
  { key: 'bollinger', label: 'Bollinger (20,2)', pane: 'main' },
  { key: 'rsi', label: 'RSI (14)', pane: 'sub' },
  { key: 'macd', label: 'MACD', pane: 'sub' },
]

const DRAW_TOOLS = [
  { key: 'hline', label: 'H-Line', icon: '—' },
  { key: 'trend', label: 'Trend', icon: '/' },
]

// symbol/name/basePrice/currency describe what to chart. volatility tunes
// the mock generator. Pass `data` (real OHLCV: [{time,open,high,low,close,
// volume}]) to chart live data instead — the built-in period pills hide
// themselves in that case since the caller owns the timeframe (e.g. an
// existing "1D 5D 1M..." selector already driving its own data fetch).
export default function TradingChart({ symbol, name, basePrice = 100, currency = 'AUD', volatility = 0.02, height = 420, data: realData }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const overlaySeriesRef = useRef(new Map())   // indicator key -> series or {upper,middle,lower}
  const rsiSeriesRef = useRef(null)
  const macdSeriesRef = useRef({ line: null, signal: null, hist: null })
  const drawingsRef = useRef([])                // { key, priceLine } or { key, series }
  const pendingTrendPointRef = useRef(null)

  const [period, setPeriod] = useState('3M')
  const [indicators, setIndicators] = useState({ sma20: false, sma50: false, ema20: false, bollinger: false, rsi: false, macd: false })
  const [activeTool, setActiveTool] = useState(null)
  const [drawingsCount, setDrawingsCount] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [crosshair, setCrosshair] = useState(null)

  const mockData = useMemo(
    () => generateOHLCV(basePrice, PERIOD_DAYS[period] ?? 90, volatility),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, period, basePrice]
  )
  const data = realData?.length ? realData : mockData
  const usingRealData = !!realData?.length

  const activePanes = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0)

  // ── Create the chart once ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: CHART_COLORS.bg }, textColor: CHART_COLORS.text, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
      grid: { vertLines: { color: CHART_COLORS.grid }, horzLines: { color: CHART_COLORS.grid } },
      rightPriceScale: { borderColor: CHART_COLORS.border },
      timeScale: { borderColor: CHART_COLORS.border, timeVisible: true },
      crosshair: { mode: 0 },
      autoSize: true,
    })
    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up, downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up, borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up, wickDownColor: CHART_COLORS.down,
    })
    candleSeriesRef.current = candleSeries

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#2a3a55', priceFormat: { type: 'volume' }, priceScaleId: 'vol',
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    volumeSeriesRef.current = volumeSeries

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData?.size) { setCrosshair(null); return }
      const bar = param.seriesData.get(candleSeries)
      if (bar) setCrosshair({ time: param.time, ...bar })
    })

    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      overlaySeriesRef.current.clear()
      rsiSeriesRef.current = null
      macdSeriesRef.current = { line: null, signal: null, hist: null }
      drawingsRef.current = []
    }
  }, [symbol])

  // Click handling for the drawing tools lives in its own effect, keyed on
  // activeTool, so the handler always closes over the current tool without
  // needing a ref mirror (subscribe/unsubscribe cost is negligible — this
  // only re-runs when the user picks a different tool).
  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candleSeriesRef.current
    if (!chart || !candleSeries) return

    const handler = (param) => {
      if (!activeTool || !param.point || !param.time) return
      const price = candleSeries.coordinateToPrice(param.point.y)
      if (price == null) return

      if (activeTool === 'hline') {
        const line = candleSeries.createPriceLine({
          price, color: CHART_COLORS.gold, lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title: price.toFixed(2),
        })
        drawingsRef.current.push({ key: 'hline', priceLine: line })
        setDrawingsCount((n) => n + 1)
        setActiveTool(null)
      } else if (activeTool === 'trend') {
        if (!pendingTrendPointRef.current) {
          pendingTrendPointRef.current = { time: param.time, price }
        } else {
          const p1 = pendingTrendPointRef.current
          const series = chart.addSeries(LineSeries, { color: CHART_COLORS.gold, lineWidth: 2 })
          series.setData([{ time: p1.time, value: p1.price }, { time: param.time, value: price }].sort((a, b) => a.time - b.time))
          drawingsRef.current.push({ key: 'trend', series })
          setDrawingsCount((n) => n + 1)
          pendingTrendPointRef.current = null
          setActiveTool(null)
        }
      }
    }

    chart.subscribeClick(handler)
    return () => chart.unsubscribeClick(handler)
    // Re-subscribes on symbol change too, since that recreates the chart
    // instance in the effect above — a stale handler would point at a
    // disposed chart otherwise.
  }, [activeTool, symbol])

  // ── Push OHLCV + volume whenever the period/data changes ───────────────
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return
    candleSeriesRef.current.setData(data)
    volumeSeriesRef.current.setData(data.map((d) => ({
      time: d.time, value: d.volume, color: d.close >= d.open ? 'rgba(58,170,99,0.5)' : 'rgba(168,50,50,0.5)',
    })))
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // ── Overlay indicators (SMA/EMA/Bollinger) on the main pane ────────────
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const map = overlaySeriesRef.current

    const sync = (key, want, build) => {
      const existing = map.get(key)
      if (want && !existing) {
        map.set(key, build())
      } else if (!want && existing) {
        if (Array.isArray(existing)) existing.forEach((s) => chart.removeSeries(s))
        else chart.removeSeries(existing)
        map.delete(key)
      }
    }

    sync('sma20', indicators.sma20, () => {
      const s = chart.addSeries(LineSeries, { color: CHART_COLORS.sma20, lineWidth: 1, title: 'SMA20' })
      s.setData(sma(data, 20)); return s
    })
    sync('sma50', indicators.sma50, () => {
      const s = chart.addSeries(LineSeries, { color: CHART_COLORS.sma50, lineWidth: 1, title: 'SMA50' })
      s.setData(sma(data, 50)); return s
    })
    sync('ema20', indicators.ema20, () => {
      const s = chart.addSeries(LineSeries, { color: CHART_COLORS.ema20, lineWidth: 1, title: 'EMA20' })
      s.setData(ema(data, 20)); return s
    })
    sync('bollinger', indicators.bollinger, () => {
      const { upper, middle, lower } = bollingerBands(data, 20, 2)
      const up = chart.addSeries(LineSeries, { color: CHART_COLORS.bbBand, lineWidth: 1, title: 'BB Upper' })
      const mid = chart.addSeries(LineSeries, { color: CHART_COLORS.bbBand, lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'BB Mid' })
      const low = chart.addSeries(LineSeries, { color: CHART_COLORS.bbBand, lineWidth: 1, title: 'BB Lower' })
      up.setData(upper); mid.setData(middle); low.setData(lower)
      return [up, mid, low]
    })
  }, [indicators.sma20, indicators.sma50, indicators.ema20, indicators.bollinger, data])

  // ── RSI + MACD get their own sub-panes (paneIndex 1 / next free index) ──
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    if (indicators.rsi && !rsiSeriesRef.current) {
      const paneIdx = indicators.macd && macdSeriesRef.current.line ? 2 : 1
      const s = chart.addSeries(LineSeries, { color: CHART_COLORS.rsi, lineWidth: 1.5, title: 'RSI' }, paneIdx)
      s.setData(rsi(data, 14))
      s.createPriceLine({ price: 70, color: CHART_COLORS.down, lineWidth: 1, lineStyle: LineStyle.Dotted })
      s.createPriceLine({ price: 30, color: CHART_COLORS.up, lineWidth: 1, lineStyle: LineStyle.Dotted })
      rsiSeriesRef.current = s
    } else if (!indicators.rsi && rsiSeriesRef.current) {
      chart.removeSeries(rsiSeriesRef.current)
      rsiSeriesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi, data])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    if (indicators.macd && !macdSeriesRef.current.line) {
      const paneIdx = indicators.rsi && rsiSeriesRef.current ? 2 : 1
      const { macdLine, signal, histogram } = macd(data)
      const line = chart.addSeries(LineSeries, { color: CHART_COLORS.macdLine, lineWidth: 1.5, title: 'MACD' }, paneIdx)
      const sig = chart.addSeries(LineSeries, { color: CHART_COLORS.macdSignal, lineWidth: 1, title: 'Signal' }, paneIdx)
      const hist = chart.addSeries(HistogramSeries, { color: '#2a3a55', title: 'Hist' }, paneIdx)
      line.setData(macdLine); sig.setData(signal)
      hist.setData(histogram.map((d) => ({ time: d.time, value: d.value, color: d.value >= 0 ? 'rgba(58,170,99,0.6)' : 'rgba(168,50,50,0.6)' })))
      macdSeriesRef.current = { line, signal: sig, hist }
    } else if (!indicators.macd && macdSeriesRef.current.line) {
      chart.removeSeries(macdSeriesRef.current.line)
      chart.removeSeries(macdSeriesRef.current.signal)
      chart.removeSeries(macdSeriesRef.current.hist)
      macdSeriesRef.current = { line: null, signal: null, hist: null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, data])

  const clearDrawings = () => {
    const chart = chartRef.current
    const candle = candleSeriesRef.current
    if (!chart || !candle) return
    drawingsRef.current.forEach((d) => {
      if (d.priceLine) candle.removePriceLine(d.priceLine)
      if (d.series) chart.removeSeries(d.series)
    })
    drawingsRef.current = []
    pendingTrendPointRef.current = null
    setDrawingsCount(0)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current?.closest('.trading-chart-root')
    if (!el) return
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setFullscreen(true) }
    else { document.exitFullscreen?.(); setFullscreen(false) }
  }

  const downloadScreenshot = () => {
    const chart = chartRef.current
    if (!chart) return
    const canvas = chart.takeScreenshot()
    canvas.toBlob?.((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${symbol || 'chart'}-${period}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const toggleIndicator = (key) => setIndicators((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className={`trading-chart-root h-full flex flex-col ${fullscreen ? 'bg-terminal-bg p-2' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap px-2 py-1.5 border-b border-terminal-border flex-shrink-0">
        {!usingRealData && (
          <div className="flex items-center border border-terminal-border rounded-full overflow-hidden">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`text-2xs px-2 py-0.5 font-bold transition-colors ${period === p ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
              >{p}</button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 border-l border-terminal-border pl-2">
          {DRAW_TOOLS.map((t) => (
            <button key={t.key}
              onClick={() => setActiveTool((cur) => cur === t.key ? null : t.key)}
              title={t.label}
              className={`text-2xs px-2 py-0.5 border rounded transition-colors ${activeTool === t.key ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10' : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold'}`}
            >{t.icon} {t.label}</button>
          ))}
          {drawingsCount > 0 && (
            <button onClick={clearDrawings} className="text-2xs px-2 py-0.5 text-terminal-text-dim hover:text-terminal-red">CLEAR</button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={downloadScreenshot} title="Download screenshot" className="text-2xs px-2 py-0.5 border border-terminal-border rounded text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold">⬇</button>
          <button onClick={toggleFullscreen} title="Fullscreen" className="text-2xs px-2 py-0.5 border border-terminal-border rounded text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold">{fullscreen ? '⤡' : '⤢'}</button>
        </div>
      </div>

      {/* Indicators row */}
      <div className="flex items-center gap-1.5 flex-wrap px-2 py-1 border-b border-terminal-border flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim tracking-wider">INDICATORS</span>
        {INDICATOR_DEFS.map((ind) => (
          <button key={ind.key} onClick={() => toggleIndicator(ind.key)}
            className={`text-2xs px-2 py-0.5 rounded-full border transition-colors ${indicators[ind.key] ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'}`}
          >{ind.label}</button>
        ))}
      </div>

      {/* Crosshair OHLCV readout */}
      <div className="px-2 py-1 border-b border-terminal-border flex-shrink-0 text-2xs font-mono flex items-center gap-3 text-terminal-text-dim" style={{ minHeight: 22 }}>
        {crosshair ? (
          <>
            <span>{name || symbol}</span>
            <span>O <span className="text-terminal-text-bright">{crosshair.open?.toFixed(2)}</span></span>
            <span>H <span className="text-terminal-text-bright">{crosshair.high?.toFixed(2)}</span></span>
            <span>L <span className="text-terminal-text-bright">{crosshair.low?.toFixed(2)}</span></span>
            <span>C <span className={crosshair.close >= crosshair.open ? 'text-terminal-green' : 'text-terminal-red'}>{crosshair.close?.toFixed(2)}</span></span>
            <span className="text-terminal-text-dim/60">{currency}</span>
          </>
        ) : <span className="opacity-50">Hover the chart for OHLCV</span>}
      </div>

      <div
        ref={containerRef}
        style={{ minHeight: fullscreen ? undefined : height + (activePanes * 90) }}
        className="flex-1 min-h-0"
      />
    </div>
  )
}
