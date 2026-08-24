import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getTimezoneFromCountry } from '../lib/profileUtils'
import { fetchFxRates } from '../services/api'

// preferred_currency values the marketing site's profiles.preferred_currency
// check constraint accepts — kept in sync manually since both apps read the
// same Supabase project.
export const CURRENCY_SYMBOLS = {
  AUD: 'A$', USD: 'US$', GBP: '£', EUR: '€',
  SGD: 'S$', NZD: 'NZ$', JPY: '¥', CAD: 'C$',
}

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  session: null,
  settings: null,
  loading: true,
  fxRates: {},
  // Set when Supabase itself is unreachable during initialize() (a real
  // network/DNS/outage failure, not just "no session yet") — distinct from
  // TopBar's navigator.onLine check, which only knows about the browser's
  // own connectivity, not whether this specific backend is reachable.
  supabaseOffline: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        set({ session, user: session.user })

        // Verify profile row exists — create if missing (DB trigger may not have fired)
        const { data: profileCheck, error: checkError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, country, email')
          .eq('id', session.user.id)
        console.log('Profile check on init:', profileCheck, checkError)
        if (!profileCheck || profileCheck.length === 0) {
          console.log('No profile found — creating one for', session.user.id)
          const { error: insertError } = await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          if (insertError) console.error('Profile insert error:', insertError.message)
        }

        await get().loadProfile()
        await get().loadSettings()
        await get().loadFxRates()
      }
    } catch (e) {
      // Supabase unreachable — fall through to offline mode rather than
      // leaving `loading` stuck true forever (which would spin the
      // AppLoader indefinitely). Watchlist/portfolio already read from
      // localStorage first, so they keep showing their last known state.
      console.error('[MADDEN AUTH] initialize() failed — Supabase unreachable:', e.message)
      set({ supabaseOffline: true })
    }
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null })
      if (session) {
        await get().loadProfile()
        await get().loadSettings()
        await get().loadFxRates()
      } else {
        set({ profile: null, settings: null, fxRates: {} })
      }
    })
  },

  loadProfile: async () => {
    const userId = get().user?.id
    console.log('loadProfile called for user:', userId)
    if (!userId) { console.log('loadProfile: no user id — skipping'); return }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).limit(1)
    console.log('loadProfile response:', data, error)
    if (error) console.error('loadProfile error:', error.message, error.details)
    const profile = data?.[0]
    if (profile) { console.log('loadProfile: setting profile', profile); set({ profile }) }
    else console.warn('loadProfile: no profile row found for user', userId)
  },

  // Fetches live rates relative to the user's preferred_currency (defaults to
  // AUD until that column exists / is set). fxRates[quote] = how many `quote`
  // units per 1 unit of preferred_currency — same shape the marketing site
  // uses, so DualCurrencyValue/convertAmount behave identically in both apps.
  loadFxRates: async () => {
    const preferred = get().profile?.preferred_currency || 'AUD'
    try {
      const rates = await fetchFxRates(preferred)
      set({ fxRates: { ...rates, [preferred]: 1 } })
    } catch (err) {
      console.error('loadFxRates error:', err.message)
    }
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
    console.log('updateProfile called with:', updates)
    console.log('updateProfile user id:', userId)
    if (!userId) return { data: null, error: new Error('Not authenticated') }
    const payload = { ...updates, updated_at: new Date().toISOString() }
    let { data, error } = await supabase
      .from('profiles').update(payload).eq('id', userId).select()
    console.log('updateProfile response data:', data)
    console.log('updateProfile response error:', error)
    if (error?.message?.includes('experience_level')) {
      console.log('updateProfile: retrying without experience_level column')
      const { experience_level: _dropped, ...rest } = payload
      ;({ data, error } = await supabase
        .from('profiles').update(rest).eq('id', userId).select())
      console.log('updateProfile retry data:', data, 'error:', error)
    }
    if (error) console.error('updateProfile error:', error.message, error.details, error.hint)
    const profile = data?.[0]
    console.log('updateProfile updated profile:', profile)
    if (profile) { set({ profile }); console.log('updateProfile: profile state updated') }
    else console.warn('updateProfile: update returned empty data — check RLS policies and row existence')
    if (!error && updates.preferred_currency) {
      await get().loadFxRates()
    }
    return { data: profile ?? null, error }
  },

  // Converts `amount` (in fromCurrency) into the signed-in user's
  // preferred_currency. Returns null when no conversion is needed/possible
  // (same currency, no profile yet, or the rate hasn't loaded).
  convertAmount: (amount, fromCurrency) => {
    const profile = get().profile
    if (!profile) return null
    const preferred = profile.preferred_currency || 'AUD'
    if (fromCurrency === preferred) return null

    const rate = get().fxRates[fromCurrency]
    if (!rate) return null

    const converted = amount / rate
    const symbol = CURRENCY_SYMBOLS[preferred] || preferred

    return {
      converted,
      display: `${symbol}${converted.toLocaleString('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: fromCurrency === 'JPY' ? 0 : 2,
      })}`,
      symbol,
    }
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
