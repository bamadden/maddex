// The Supabase calls the app makes, shared by the recorder
// (scripts/record-supabase-requests.mjs) and tests/supabaseClient.test.mjs.
export const QUERIES = [
  ['select', (c) => c.from('profiles').select('id, plan').eq('id', 'u-1')],
  ['insert', (c) => c.from('watchlist').insert({ user_id: 'u-1', symbol: 'CBA' })],
  ['delete', (c) => c.from('price_alerts').delete().eq('user_id', 'u-1')],
  ['rpc', (c) => c.rpc('get_shared_link', { p_id: 'abc', p_kind: 'watchlist' })],
]
// A session already on the device; expires far in the future so no refresh.
export const SESSION = { access_token: 'user-token-123', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { id: 'u-1', aud: 'authenticated' } }
