// REMINDER: Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel dashboard environment variables
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// storageKey must match the marketing site's Supabase client exactly —
// this is what lets a signed-in session be shared across both apps.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'maddex-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
