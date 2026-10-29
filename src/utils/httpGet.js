// The GET this app needs, on fetch, in place of axios.
//
// axios was 41 KB of the first-paint bundle and every call site used it for
// one thing: a GET with query params and a timeout, returning `{ data }`. This
// keeps that contract: JSON bodies are parsed (text otherwise, as axios did),
// a non-2xx status throws with `err.response.status`, and the timeout aborts.
import { recordTiming } from '../services/diagnostics'

export async function httpGet(url, { params, timeout, headers } = {}) {
  let full = url
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]),
    ).toString()
    if (qs) full += (url.includes('?') ? '&' : '?') + qs
  }
  const t0 = performance.now()
  const res = await fetch(full, { headers, signal: timeout ? AbortSignal.timeout(timeout) : undefined })
  const text = await res.text()
  // Response time for Settings → About; the host only, never the query.
  try { recordTiming('api', new URL(full, location.href).host, performance.now() - t0) } catch { /* bad URL */ }
  let data = text
  try { data = text ? JSON.parse(text) : null } catch { /* not JSON — keep the text */ }
  if (!res.ok) {
    const err = new Error(`Request failed with status code ${res.status}`)
    err.response = { status: res.status, data }
    throw err
  }
  return { data, status: res.status }
}
