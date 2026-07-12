import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getTimezoneFromCountry } from '../lib/profileUtils'

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  session: null,
  settings: null,
  loading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      set({ session, user: session.user })
      await get().loadProfile()
      await get().loadSettings()
    }
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null })
      if (session) {
        await get().loadProfile()
        await get().loadSettings()
      } else {
        set({ profile: null, settings: null })
      }
    })
  },

  loadProfile: async () => {
    const userId = get().user?.id
    if (!userId) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).limit(1)
    if (error) console.error('loadProfile error:', error.message, error.details)
    const profile = data?.[0]
    if (profile) set({ profile })
  },

  loadSettings: async () => {
    const userId = get().user?.id
    if (!userId) return null
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).limit(1)
    if (error) console.error('loadSettings error:', error.message, error.details)
    const settings = data?.[0]
    if (settings) set({ settings })
    return settings ?? null
  },

  signUp: async (email, password, firstName, lastName, country) => {
    const timezone = getTimezoneFromCountry(country)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, country },
      },
    })
    // Upsert profile directly — don't rely solely on the DB trigger
    if (data?.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        first_name: firstName,
        last_name: lastName,
        country,
        timezone,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (profileError) console.error('signUp profile upsert error:', profileError.message)
      await supabase.from('user_settings').upsert({
        user_id: data.user.id,
        timezone,
        updated_at: new Date().toISOString(),
      })
    }
    return { data, error }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  },

  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { data, error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, session: null, settings: null })
  },

  updateProfile: async (updates) => {
    const userId = get().user?.id
    if (!userId) return { data: null, error: new Error('Not authenticated') }
    const payload = { ...updates, updated_at: new Date().toISOString() }
    let { data, error } = await supabase
      .from('profiles').update(payload).eq('id', userId).select()
    if (error?.message?.includes('experience_level')) {
      const { experience_level: _dropped, ...rest } = payload
      ;({ data, error } = await supabase
        .from('profiles').update(rest).eq('id', userId).select())
    }
    if (error) console.error('updateProfile error:', error.message, error.details, error.hint)
    const profile = data?.[0]
    if (profile) set({ profile })
    return { data: profile ?? null, error }
  },

  updateSettings: async (updates) => {
    const userId = get().user?.id
    if (!userId) return
    const { data, error } = await supabase
      .from('user_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
    if (error) console.error('updateSettings error:', error.message, error.details)
    const settings = data?.[0]
    if (settings) set({ settings })
    return { data: settings ?? null, error }
  },

  updatePassword: async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    return { data, error }
  },

  deleteAccount: async () => {
    const userId = get().user?.id
    if (!userId) return
    await supabase.from('watchlist').delete().eq('user_id', userId)
    await supabase.from('portfolio_holdings').delete().eq('user_id', userId)
    await supabase.from('price_alerts').delete().eq('user_id', userId)
    await supabase.from('ai_notes').delete().eq('user_id', userId)
    await supabase.from('user_settings').delete().eq('user_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.signOut()
    set({ user: null, profile: null, session: null, settings: null })
  },
}))
