import { useEffect, useState } from 'react'

// OpenFreeMap: no key, no registration, commercial use allowed, no SLA
// (openfreemap.org; docs/DATA_SOURCES.md). Its required credit is
// "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (16 Nov 2026; the
// CARTO tiles used before were requested without a key, so unlicensed).
export const OFM_DARK = 'https://tiles.openfreemap.org/styles/dark'
export const OFM_CREDIT = 'OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors'

// The basemap style as an object: fetched once per URL, label layers removed
// for INTEL. Null while loading or after a failure (`failed`); the map then
// shows its plain dark background and every deck.gl marker, arc and label
// still draws.
const cache = new globalThis.Map()

export function useBasemapStyle(key, source) {
  const [loaded, setLoaded] = useState({})   // key -> style | 'failed'
  const isObj = source && typeof source === 'object'
  useEffect(() => {
    if (!source || isObj) return
    let live = true
    const load = cache.get(source) ?? fetch(source).then((r) => { if (!r.ok) throw new Error('style'); return r.json() })
    cache.set(source, load)
    load.then((st) => {
      if (!live) return
      const style = key === 'intel' ? { ...st, layers: st.layers.filter((l) => l.type !== 'symbol') } : st
      setLoaded((m) => ({ ...m, [key]: style }))
    }).catch(() => { cache.delete(source); if (live) setLoaded((m) => ({ ...m, [key]: 'failed' })) })
    return () => { live = false }
  }, [key, source, isObj])
  if (isObj) return { style: source, failed: false }
  const v = loaded[key]
  return { style: v && v !== 'failed' ? v : null, failed: v === 'failed' }
}
