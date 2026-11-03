// REMINDER: Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel dashboard environment variables
//
// The two Supabase parts this app uses — auth and the database (from / rpc)
// — wired exactly as @supabase/supabase-js's createClient wires them
// (2.110.2: SupabaseClient constructor, _initSupabaseAuthClient,
// fetchWithAuth). createClient also builds the realtime, storage and
// functions clients; nothing here uses them, and they were ~20KB gzip of
// first paint. Same storage key, same auth options, same headers: an
// existing session carries over unchanged.
import { AuthClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const base = new URL(supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`)

// storageKey must match the marketing site's Supabase client exactly —
// this is what lets a signed-in session be shared across both apps.
const auth = new AuthClient({
  url: new URL('auth/v1', base).href,
  headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
  storageKey: 'maddex-auth',
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'implicit', // createClient's default
  hasCustomAuthorizationHeader: false,
})

// Database requests carry the signed-in user's access token (the anon key
// when signed out), as createClient's fetchWithAuth does.
const fetchWithAuth = async (input, init) => {
  const headers = new Headers(init?.headers)
  if (!headers.has('apikey')) headers.set('apikey', supabaseAnonKey)
  if (!headers.has('Authorization')) {
    const { data } = await auth.getSession()
    headers.set('Authorization', `Bearer ${data.session?.access_token ?? supabaseAnonKey}`)
  }
  return fetch(input, { ...init, headers })
}

const rest = new PostgrestClient(new URL('rest/v1', base).href, { schema: 'public', fetch: fetchWithAuth })

export const supabase = {
  auth,
  from: (relation) => rest.from(relation),
  rpc: (fn, args, options) => rest.rpc(fn, args, options),
}
