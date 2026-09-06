// ─── Scanner settings ──────────────────────────────────────────────────────
//
// Persisted scan configuration. Kept in its own module rather than in
// component state because the settings outlive the panel that edits them and
// are read by the scan functions, not just rendered.
//
// A NOTE ON WHAT THESE ACTUALLY FILTER. The universe, minimum volume and
// minimum market cap all apply to the DEMO dataset this scanner runs on —
// they narrow which of the ~40 tracked symbols a scan considers. They are
// real filters over real fields, but the field values are the mock ones, and
// the module is badged DEMO for exactly that reason. When a live equities
// feed is wired in, these thresholds keep working unchanged.

const KEY = 'maddex_scanner_settings_v1'

export const SCAN_UNIVERSES = [
  { id: 'asx',  label: 'ASX',  test: (sym) => sym.endsWith('.AX') },
  { id: 'us',   label: 'US',   test: (sym) => !sym.endsWith('.AX') },
  { id: 'all',  label: 'ALL',  test: () => true },
]

export const MIN_VOLUME_OPTIONS = [
  { id: 0,       label: 'ANY' },
  { id: 500_000, label: '500K' },
  { id: 1e6,     label: '1M' },
  { id: 5e6,     label: '5M' },
]

export const MIN_MCAP_OPTIONS = [
  { id: 0,     label: 'ANY' },
  { id: 1e8,   label: 'A$100M' },
  { id: 5e8,   label: 'A$500M' },
  { id: 1e9,   label: 'A$1B' },
]

export const INTERVAL_OPTIONS = [
  { id: 60_000,  label: '1 MIN' },
  { id: 120_000, label: '2 MIN' },
  { id: 300_000, label: '5 MIN' },
]

export const DEFAULT_SETTINGS = {
  universe: 'all',
  minVolume: 0,
  minMarketCap: 0,
  intervalMs: 120_000,
}

export function loadScanSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function saveScanSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* best-effort */ }
  return settings
}

// Applied to a scan's results rather than to the universe before scanning.
//
// Filtering afterwards keeps every scan function ignorant of settings, which
// means they stay independently testable and a new scan gets the filters for
// free. The cost is scanning symbols that will be discarded — irrelevant at
// forty symbols, and the honest trade to make at this size.
export function applyScanFilters(rows, settings = loadScanSettings()) {
  const universe = SCAN_UNIVERSES.find((u) => u.id === settings.universe) ?? SCAN_UNIVERSES[2]
  return rows.filter((r) => {
    if (!universe.test(r.symbol)) return false
    const vol = r.q?.regularMarketVolume ?? r.volume
    if (settings.minVolume > 0 && (vol ?? 0) < settings.minVolume) return false
    const mcap = r.q?.marketCap ?? r.marketCap
    if (settings.minMarketCap > 0 && (mcap ?? 0) < settings.minMarketCap) return false
    return true
  })
}
