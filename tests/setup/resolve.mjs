// Test-only module hooks, so node --test can import app services directly:
//   - resolve the app's extensionless imports ("./api") as Vite does, trying
//     .js, .jsx and /index.js;
//   - give modules under src/ a stand-in for Vite's import.meta.env (a
//     production-mode env with placeholder Supabase values — no network
//     call is made by creating the client).
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
const ENV = JSON.stringify({ DEV: false, PROD: true, MODE: 'test', VITE_SUPABASE_URL: 'https://test.invalid', VITE_SUPABASE_ANON_KEY: 'test-anon-key' })
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx) } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' || !/^\\.{1,2}\\//.test(spec) || /\\.[cm]?jsx?$/.test(spec)) throw err
    for (const ext of ['.js', '.jsx', '/index.js']) { try { return await next(spec + ext, ctx) } catch { /* next */ } }
    throw err
  }
}
export async function load(url, ctx, next) {
  const r = await next(url, ctx)
  if (!url.includes('/src/') || !/\\.jsx?$/.test(new URL(url).pathname) || r.source == null) return r
  const src = String(r.source)
  if (!src.includes('import.meta.env')) return r
  return { ...r, source: src.replaceAll('import.meta.env', '(' + ENV + ')') }
}`))
