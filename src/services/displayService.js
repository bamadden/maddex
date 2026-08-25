// Display/scaling preferences, persisted to localStorage and applied as CSS
// custom properties + a couple of direct DOM effects on :root.
//
// Real, visible effects wired this pass: uiScale (scales the whole app via
// root font-size — Tailwind's text-2xs etc are rem-based, so this cascades
// everywhere for free), animations/reducedMotion (controls --transition-speed,
// consumed by .module-fade/.panel-fade/.card-hover in index.css), and
// clockFormat (consumed directly by TopBar). The remaining fields (density,
// currency, numberFormat, decimalPlaces, chart defaults, newsLayout,
// sidebarDefault, timezone) are stored/settable and exposed as CSS custom
// properties where applicable, but are not yet threaded into every
// consuming component — currency in particular already has an existing,
// separate mechanism (useStore / SettingsPanel's Preferences section) that
// this deliberately doesn't duplicate.
const DISPLAY_DEFAULTS = {
  uiScale: 100, // 80 | 90 | 100 | 110 | 120
  density: 'comfortable', // compact | comfortable | spacious
  numberFormat: 'standard', // standard | compact | full
  decimalPlaces: 2,
  animations: true,
  reducedMotion: false,
  defaultChartPeriod: '1M',
  defaultChartType: 'candle',
  chartGrid: true,
  chartCrosshair: true,
  newsLayout: 'standard',
  sidebarDefault: 'collapsed',
  clockFormat: '24h', // 12h | 24h
}

const DISPLAY_KEY = 'maddex_display'

class DisplayService {
  constructor() {
    this.prefs = this.load()
    this.listeners = new Set()
    this.apply()
  }

  load() {
    try {
      const saved = localStorage.getItem(DISPLAY_KEY)
      return { ...DISPLAY_DEFAULTS, ...JSON.parse(saved || '{}') }
    } catch {
      return { ...DISPLAY_DEFAULTS }
    }
  }

  save() {
    try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(this.prefs)) } catch { /* best-effort */ }
    this.listeners.forEach((cb) => cb())
  }

  subscribe(cb) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  set(key, value) {
    this.prefs[key] = value
    this.save()
    this.apply()
  }

  get(key) {
    return this.prefs[key]
  }

  resetAll() {
    this.prefs = { ...DISPLAY_DEFAULTS }
    try { localStorage.removeItem(DISPLAY_KEY) } catch { /* best-effort */ }
    this.apply()
    this.listeners.forEach((cb) => cb())
  }

  apply() {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    root.style.fontSize = `${this.prefs.uiScale}%`
    root.setAttribute('data-density', this.prefs.density)

    const densityMap = {
      compact:     { cardPad: '8px',  rowHeight: '28px', gap: '8px' },
      comfortable: { cardPad: '12px', rowHeight: '36px', gap: '12px' },
      spacious:    { cardPad: '18px', rowHeight: '44px', gap: '18px' },
    }
    const d = densityMap[this.prefs.density] ?? densityMap.comfortable
    root.style.setProperty('--card-padding', d.cardPad)
    root.style.setProperty('--row-height', d.rowHeight)
    root.style.setProperty('--grid-gap', d.gap)

    root.style.setProperty('--transition-speed', (this.prefs.reducedMotion || !this.prefs.animations) ? '0ms' : '150ms')
  }
}

export const displayService = new DisplayService()
export { DISPLAY_DEFAULTS }
