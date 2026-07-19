import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { getInitials, EXPERIENCE_LEVELS, getTimezoneFromCountry, COUNTRY_TIMEZONES } from '../../lib/profileUtils'

const SECTIONS = ['PROFILE', 'PREFERENCES', 'NOTIFICATIONS', 'SECURITY', 'DATA', 'SUBSCRIPTION']

const TIMEZONES = [
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'America/Toronto', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Asia/Tokyo', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Shanghai', 'Pacific/Auckland', 'UTC',
]

const MODULES = ['markets', 'crypto', 'fx', 'macro', 'watchlist', 'news', 'global']

// All countries — Australia first
const COUNTRIES = [
  'Australia', 'United States', 'United Kingdom', 'Canada', 'New Zealand',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh',
  'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso',
  'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Central African Republic', 'Chad',
  'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba',
  'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
  'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany',
  'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
  'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia',
  'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
  'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
  'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'Nicaragua', 'Niger', 'Nigeria',
  'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine',
  'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain',
  'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan',
  'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda',
  'Ukraine', 'United Arab Emirates', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
]

// ─── Shared components ────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative w-10 h-5 transition-colors flex-shrink-0 ${
        value ? 'bg-terminal-gold' : 'bg-terminal-border'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-terminal-bg transition-all ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  )
}

function SectionLabel({ children }) {
  return <div className="text-terminal-gold text-2xs font-bold tracking-widest uppercase border-b border-terminal-border pb-1 mb-4">{children}</div>
}

function FieldRow({ label, note, children }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-terminal-border/30">
      <div>
        <div className="text-xs text-terminal-text-bright">{label}</div>
        {note && <div className="text-2xs text-terminal-text-dim mt-0.5">{note}</div>}
      </div>
      {children}
    </div>
  )
}

function SaveButton({ onClick, loading, saved }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-4 py-1.5 text-xs font-bold bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-50"
    >
      {loading ? '...' : saved ? '✓ SAVED' : 'SAVE CHANGES'}
    </button>
  )
}

function Toast({ message }) {
  return (
    <div className="fixed bottom-6 right-6 z-[400] bg-terminal-green/20 border border-terminal-green px-4 py-2 text-xs text-terminal-green font-mono font-bold shadow-xl animate-pulse">
      ✓ {message}
    </div>
  )
}

function CountryDropdown({ value, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono flex justify-between items-center"
      >
        <span className={value ? 'text-terminal-text-bright' : 'text-terminal-text-dim'}>{value || 'Select country...'}</span>
        <span className="text-terminal-text-dim">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 w-full top-full mt-0.5 bg-terminal-panel border border-terminal-border shadow-2xl max-h-44 flex flex-col">
          <div className="p-1 border-b border-terminal-border flex-shrink-0">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-terminal-accent/30 transition-colors ${
                  c === value ? 'text-terminal-gold' : 'text-terminal-text-bright'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

function ProfileSection() {
  const { profile, updateProfile, loadProfile, user } = useAuthStore()
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    country: profile?.country || '',
    experience_level: profile?.experience_level || 'INTERMEDIATE',
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(false)
  const [error, setError] = useState(null)

  // Sync form when profile loads from Supabase (useState only runs once at mount)
  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        country: profile.country || '',
        experience_level: profile.experience_level || 'INTERMEDIATE',
      })
    }
  }, [profile?.id]) // only re-sync when the profile ID changes (initial load), not on every field update

  const initials = getInitials(
    { ...profile, first_name: form.first_name, last_name: form.last_name },
    user
  )

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    : null

  const handleSave = async () => {
    setLoading(true); setError(null)
    const updates = {
      ...form,
      timezone: getTimezoneFromCountry(form.country),
    }
    console.log('ProfileSection handleSave:', updates)
    const { data, error } = await updateProfile(updates)
    console.log('ProfileSection save result:', { data, error })
    if (!error) {
      // Reload from Supabase to confirm persistence
      await loadProfile()
    }
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setToast(true)
      setTimeout(() => setToast(false), 3000)
    }
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Profile</SectionLabel>

      {/* Avatar + meta */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 flex items-center justify-center bg-terminal-accent border border-terminal-gold text-terminal-gold text-xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-terminal-text-bright font-bold truncate">
            {form.first_name || form.last_name ? `${form.first_name} ${form.last_name}`.trim() : user?.email}
          </div>
          <div className="text-2xs text-terminal-text-dim truncate">{user?.email}</div>
          {memberSince && (
            <div className="text-2xs text-terminal-text-dim/60 mt-0.5">Member since {memberSince}</div>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        {[['first_name', 'FIRST NAME'], ['last_name', 'LAST NAME']].map(([k, l]) => (
          <div key={k} className="space-y-1">
            <div className="text-2xs text-terminal-text-dim">{l}</div>
            <input
              value={form[k]}
              onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
            />
          </div>
        ))}
      </div>

      {/* Email (read-only) */}
      <div className="space-y-1">
        <div className="text-2xs text-terminal-text-dim">EMAIL</div>
        <input
          value={user?.email || ''}
          disabled
          className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-dim outline-none font-mono opacity-60"
        />
        <div className="text-2xs text-terminal-text-dim/60">Changing email requires verification</div>
      </div>

      {/* Country */}
      <div className="space-y-1">
        <div className="text-2xs text-terminal-text-dim">COUNTRY</div>
        <CountryDropdown
          value={form.country}
          onChange={v => setForm(f => ({ ...f, country: v }))}
        />
      </div>

      {/* Experience Level */}
      <div className="space-y-2">
        <div className="text-2xs text-terminal-text-dim">INVESTMENT EXPERIENCE LEVEL</div>
        <div className="grid grid-cols-2 gap-1.5">
          {EXPERIENCE_LEVELS.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm(f => ({ ...f, experience_level: value }))}
              className={`px-3 py-2 text-left border transition-colors ${
                form.experience_level === value
                  ? 'border-terminal-gold bg-terminal-gold/10 text-terminal-gold'
                  : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold/50 hover:text-terminal-text'
              }`}
            >
              <div className="text-2xs font-bold">{label}</div>
              <div className="text-2xs opacity-70 mt-0.5 leading-tight">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-2xs text-terminal-red">{error}</div>}
      <SaveButton onClick={handleSave} loading={loading} saved={false} />
      {toast && <Toast message="Profile updated successfully" />}
    </div>
  )
}

// ─── PREFERENCES ─────────────────────────────────────────────────────────────

const DISPLAY_CURRENCIES = [
  { code: 'AUD', flag: '🇦🇺' }, { code: 'USD', flag: '🇺🇸' },
  { code: 'GBP', flag: '🇬🇧' }, { code: 'EUR', flag: '🇪🇺' },
  { code: 'SGD', flag: '🇸🇬' }, { code: 'NZD', flag: '🇳🇿' },
  { code: 'JPY', flag: '🇯🇵' }, { code: 'CAD', flag: '🇨🇦' },
]

function PreferencesSection() {
  const { settings, updateSettings, profile, updateProfile } = useAuthStore()
  const { setCurrency: setStoreCurrency } = useStore()
  const [currency, setCurrency] = useState(settings?.currency || 'AUD')
  const [defaultModule, setDefaultModule] = useState(settings?.default_module || 'markets')
  const [refreshInterval, setRefreshInterval] = useState(settings?.auto_refresh_interval || 60)
  const [compactMode, setCompactMode] = useState(settings?.compact_mode || false)
  const [timezone, setTimezone] = useState(settings?.timezone || 'Australia/Sydney')
  const [preferredCurrency, setPreferredCurrency] = useState(profile?.preferred_currency || 'AUD')
  const [showSecondary, setShowSecondary] = useState(profile?.show_secondary_currency !== false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    await updateSettings({ currency, default_module: defaultModule, auto_refresh_interval: refreshInterval, compact_mode: compactMode, timezone })
    await updateProfile({ preferred_currency: preferredCurrency, show_secondary_currency: showSecondary })
    setStoreCurrency(currency)
    setLoading(false)
    setToast(true); setTimeout(() => setToast(false), 3000)
  }

  return (
    <div className="space-y-5">
      <SectionLabel>Preferences</SectionLabel>

      <div>
        <div className="text-2xs text-terminal-text-dim mb-2">DEFAULT CURRENCY</div>
        <div className="flex border border-terminal-border w-32">
          {['AUD', 'USD'].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                currency === c ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-terminal-border/30">
        <div className="text-2xs text-terminal-text-dim mb-1">PREFERRED DISPLAY CURRENCY</div>
        <div className="text-2xs text-terminal-text-dim/60 mb-2">
          Used across Maddex products for dual-currency conversion (e.g. Research Notes).
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {DISPLAY_CURRENCIES.map(({ code, flag }) => (
            <button
              key={code}
              type="button"
              onClick={() => setPreferredCurrency(code)}
              className={`flex items-center gap-1.5 px-2 py-1.5 border text-left transition-colors ${
                preferredCurrency === code
                  ? 'border-terminal-gold bg-terminal-gold/10 text-terminal-gold'
                  : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold/50'
              }`}
            >
              <span className="text-xs">{flag}</span>
              <span className="text-2xs font-bold">{code}</span>
            </button>
          ))}
        </div>
      </div>

      <FieldRow label="Show secondary currency" note="e.g. AAPL shows US$333.74 with A$517.48 below it">
        <Toggle value={showSecondary} onChange={setShowSecondary} />
      </FieldRow>

      <div>
        <div className="text-2xs text-terminal-text-dim mb-2">DEFAULT MODULE</div>
        <select
          value={defaultModule}
          onChange={e => setDefaultModule(e.target.value)}
          className="bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
        >
          {MODULES.map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-2xs text-terminal-text-dim mb-2">AUTO-REFRESH INTERVAL</div>
        <div className="flex border border-terminal-border">
          {[['30s', 30], ['60s', 60], ['5min', 300], ['Manual', 0]].map(([label, val]) => (
            <button key={label} onClick={() => setRefreshInterval(val)}
              className={`flex-1 py-1.5 text-2xs font-bold transition-colors border-r border-terminal-border last:border-r-0 ${
                refreshInterval === val ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-2xs text-terminal-text-dim mb-2">TIMEZONE</div>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
        >
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
        <div className="text-2xs text-terminal-text-dim/60 mt-1">Auto-set from country on signup. Override here.</div>
      </div>

      <FieldRow label="Compact Mode" note="Reduces padding for more data density">
        <Toggle value={compactMode} onChange={setCompactMode} />
      </FieldRow>

      <FieldRow label="Theme" note="Light theme coming soon">
        <div className="flex gap-2">
          <span className="px-2 py-0.5 text-2xs bg-terminal-gold text-terminal-bg font-bold">Dark</span>
          <span className="px-2 py-0.5 text-2xs text-terminal-text-dim/40 border border-terminal-border">Light</span>
        </div>
      </FieldRow>

      <SaveButton onClick={handleSave} loading={loading} saved={false} />
      {toast && <Toast message="Preferences saved" />}
    </div>
  )
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

function NotificationsSection() {
  const { settings, updateSettings } = useAuthStore()
  const [vals, setVals] = useState({
    price_alerts_enabled: settings?.price_alerts_enabled ?? true,
    market_alerts_enabled: settings?.market_alerts_enabled ?? true,
    news_alerts_enabled: settings?.news_alerts_enabled ?? true,
    rba_alerts_enabled: settings?.rba_alerts_enabled ?? true,
    email_notifications: settings?.email_notifications ?? false,
  })
  const [saving, setSaving] = useState(null)

  const toggle = async (key) => {
    const next = !vals[key]
    setVals(v => ({ ...v, [key]: next }))
    setSaving(key)
    await updateSettings({ [key]: next })
    setSaving(null)
  }

  const ROWS = [
    ['price_alerts_enabled', 'Price Alerts', 'Get notified when assets hit target prices'],
    ['market_alerts_enabled', 'Market Open/Close Alerts', 'Exchange open and close notifications'],
    ['news_alerts_enabled', 'Breaking News Alerts', 'Market-moving news notifications'],
    ['rba_alerts_enabled', 'RBA Meeting Alerts', 'Reserve Bank of Australia event reminders'],
    ['email_notifications', 'Email Notifications', 'Receive alerts via email'],
  ]

  return (
    <div className="space-y-1">
      <SectionLabel>Notifications</SectionLabel>
      {ROWS.map(([key, label, note]) => (
        <FieldRow key={key} label={label} note={note}>
          <Toggle value={vals[key]} onChange={() => toggle(key)} disabled={saving === key} />
        </FieldRow>
      ))}
    </div>
  )
}

// ─── SECURITY ─────────────────────────────────────────────────────────────────

function SecuritySection({ onDeleteRequest }) {
  const { updatePassword, signOut } = useAuthStore()
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwToast, setPwToast] = useState(false)

  const handleUpdatePassword = async () => {
    setPwError(null)
    if (!newPw || newPw.length < 8) { setPwError('Password must be at least 8 characters'); return }
    if (newPw !== confirm) { setPwError('Passwords do not match'); return }
    setPwLoading(true)
    const { error } = await updatePassword(newPw)
    setPwLoading(false)
    if (error) setPwError(error.message)
    else { setPwToast(true); setNewPw(''); setConfirm(''); setTimeout(() => setPwToast(false), 3000) }
  }

  return (
    <div className="space-y-6">
      <SectionLabel>Security</SectionLabel>

      <div className="space-y-3">
        <div className="text-xs font-bold text-terminal-text-bright">CHANGE PASSWORD</div>
        <div className="space-y-1">
          <div className="text-2xs text-terminal-text-dim">NEW PASSWORD</div>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs outline-none focus:border-terminal-gold font-mono text-terminal-text-bright"
            placeholder="Min 8 characters"
          />
        </div>
        <div className="space-y-1">
          <div className="text-2xs text-terminal-text-dim">CONFIRM NEW PASSWORD</div>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs outline-none focus:border-terminal-gold font-mono text-terminal-text-bright"
            placeholder="••••••••"
          />
        </div>
        {pwError && <div className="text-2xs text-terminal-red">{pwError}</div>}
        <SaveButton onClick={handleUpdatePassword} loading={pwLoading} saved={false} />
        {pwToast && <Toast message="Password updated" />}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-bold text-terminal-text-bright">ACTIVE SESSIONS</div>
        <div className="border border-terminal-border p-3 space-y-1">
          <div className="text-2xs text-terminal-text-bright font-bold">Current session</div>
          <div className="text-2xs text-terminal-text-dim">Active now</div>
        </div>
        <button
          onClick={() => signOut()}
          className="px-4 py-1.5 text-xs font-bold border border-terminal-red/50 text-terminal-red hover:bg-terminal-red/10 transition-colors"
        >
          SIGN OUT ALL DEVICES
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-terminal-text-bright">TWO-FACTOR AUTHENTICATION</div>
        <div className="text-2xs text-terminal-text-dim border border-terminal-border p-3">Coming Soon</div>
      </div>

      <div className="border border-terminal-red/30 p-4 space-y-3">
        <div className="text-xs font-bold text-terminal-red tracking-widest">DANGER ZONE</div>
        <button
          onClick={onDeleteRequest}
          className="px-4 py-2 text-xs font-bold border border-terminal-red text-terminal-red hover:bg-terminal-red/10 transition-colors"
        >
          DELETE ACCOUNT
        </button>
        <div className="text-2xs text-terminal-text-dim">This will permanently delete your account and all data.</div>
      </div>
    </div>
  )
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

function DataSection({ onClearWatchlist, onClearPortfolio, onClearNotes }) {
  const [exporting, setExporting] = useState(false)

  const exportUserData = async () => {
    setExporting(true)
    try {
      const [profile, watchlist, portfolio, alerts, notes, settings] = await Promise.all([
        supabase.from('profiles').select('*').limit(1),
        supabase.from('watchlist').select('*'),
        supabase.from('portfolio_holdings').select('*'),
        supabase.from('price_alerts').select('*'),
        supabase.from('ai_notes').select('*'),
        supabase.from('user_settings').select('*').limit(1),
      ])
      const exportData = {
        exported_at: new Date().toISOString(),
        profile: profile.data?.[0] ?? null,
        watchlist: watchlist.data,
        portfolio: portfolio.data,
        price_alerts: alerts.data,
        ai_notes: notes.data,
        settings: settings.data?.[0] ?? null,
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `maddex_data_export_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionLabel>Data</SectionLabel>

      <div className="space-y-3">
        <div className="text-xs font-bold text-terminal-text-bright">EXPORT MY DATA</div>
        <div className="text-2xs text-terminal-text-dim">Download all your Maddex data as a JSON file.</div>
        <button
          onClick={exportUserData}
          disabled={exporting}
          className="px-4 py-1.5 text-xs font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-50"
        >
          {exporting ? '...' : 'EXPORT MY DATA'}
        </button>
      </div>

      <div className="border border-terminal-red/30 p-4 space-y-3">
        <div className="text-xs font-bold text-terminal-red tracking-widest">CLEAR DATA</div>
        {[
          ['Clear Watchlist', onClearWatchlist],
          ['Clear Portfolio', onClearPortfolio],
          ['Clear AI Notes', onClearNotes],
        ].map(([label, handler]) => (
          <button
            key={label}
            onClick={handler}
            className="block px-4 py-1.5 text-xs border border-terminal-red/40 text-terminal-red hover:bg-terminal-red/10 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── SUBSCRIPTION ─────────────────────────────────────────────────────────────

function SubscriptionSection() {
  const { user } = useAuthStore()
  return (
    <div className="space-y-5">
      <SectionLabel>Subscription</SectionLabel>

      <div className="flex items-center gap-3">
        <div className="text-xs text-terminal-text-bright font-bold">Current Plan:</div>
        <span className="px-2 py-0.5 text-2xs font-bold bg-terminal-gold text-terminal-bg">FREE</span>
      </div>

      <div className="border border-terminal-border p-4 space-y-3">
        <div className="text-xs font-bold text-terminal-text-bright">MADDEX PRO</div>
        <div className="text-2xs text-terminal-text-dim">Coming Soon</div>
        {[
          'Real-time market data',
          'Unlimited price alerts',
          'Advanced AI analysis',
          'Priority data refresh',
          'Multi-portfolio tracking',
        ].map(f => (
          <div key={f} className="flex items-center gap-2 text-2xs text-terminal-text-dim/60">
            <span className="text-terminal-text-dim/40">○</span>
            {f}
            <span className="ml-auto text-2xs bg-terminal-border px-1.5 py-0.5">COMING SOON</span>
          </div>
        ))}
      </div>

      <div className="border border-terminal-border p-4 space-y-2">
        <div className="text-2xs text-terminal-text-dim">Get notified when Pro launches:</div>
        <div className="flex gap-2">
          <input
            defaultValue={user?.email || ''}
            placeholder="your@email.com"
            className="flex-1 bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs outline-none focus:border-terminal-gold font-mono text-terminal-text-bright"
          />
          <button className="px-3 py-1.5 text-xs font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors whitespace-nowrap">
            NOTIFY ME
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel, requiresType, requiresPassword }) {
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const canConfirm = (!requiresType || typed === requiresType) && (!requiresPassword || password.length > 0)

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70">
      <div className="w-full max-w-sm bg-terminal-panel border border-terminal-border p-5 mx-4 space-y-4 font-mono">
        <div className="text-xs font-bold text-terminal-red tracking-widest">{title}</div>
        <div className="text-2xs text-terminal-text-dim">{message}</div>
        {requiresType && (
          <div className="space-y-1">
            <div className="text-2xs text-terminal-text-dim">Type <span className="text-terminal-red font-bold">{requiresType}</span> to confirm:</div>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs outline-none focus:border-terminal-red font-mono text-terminal-text-bright"
            />
          </div>
        )}
        {requiresPassword && (
          <div className="space-y-1">
            <div className="text-2xs text-terminal-text-dim">Enter your password:</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs outline-none focus:border-terminal-red font-mono text-terminal-text-bright"
              placeholder="••••••••"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 text-2xs border border-terminal-border text-terminal-text-dim hover:text-terminal-text transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={() => canConfirm && onConfirm(password)}
            disabled={!canConfirm}
            className="flex-1 py-1.5 text-2xs font-bold border border-terminal-red text-terminal-red hover:bg-terminal-red/10 transition-colors disabled:opacity-30"
          >
            CONFIRM DELETE
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Settings Panel ──────────────────────────────────────────────────────

export default function SettingsPanel({ onClose }) {
  const [active, setActive] = useState('PROFILE')
  const { deleteAccount } = useAuthStore()
  const { clearWatchlist } = useStore()
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleDeleteAccount = async () => {
    setConfirm(null)
    await deleteAccount()
  }

  const handleClearWatchlist = async () => {
    setConfirm(null)
    clearWatchlist()
    await supabase.from('watchlist').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const handleClearPortfolio = async () => {
    setConfirm(null)
    await supabase.from('portfolio_holdings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const handleClearNotes = async () => {
    setConfirm(null)
    await supabase.from('ai_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  return (
    <div className="fixed inset-0 z-[150] flex font-mono bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="ml-auto h-full flex bg-terminal-panel border-l border-terminal-border shadow-2xl"
        style={{ width: 720 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 border-r border-terminal-border flex flex-col bg-terminal-bg">
          <div className="p-4 border-b border-terminal-border">
            <div className="text-terminal-gold text-xs font-bold tracking-widest">⚙ SETTINGS</div>
          </div>
          <nav className="flex-1 py-2">
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={`w-full text-left px-4 py-2.5 text-2xs font-bold tracking-widest transition-colors ${
                  active === s
                    ? 'text-terminal-gold border-l-2 border-terminal-gold bg-terminal-panel'
                    : 'text-terminal-text-dim hover:text-terminal-text hover:bg-terminal-accent/20'
                }`}
              >
                {s}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-terminal-border">
            <button onClick={onClose} className="text-2xs text-terminal-text-dim hover:text-terminal-text">✕ CLOSE</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {active === 'PROFILE'       && <ProfileSection />}
          {active === 'PREFERENCES'   && <PreferencesSection />}
          {active === 'NOTIFICATIONS' && <NotificationsSection />}
          {active === 'SECURITY'      && <SecuritySection onDeleteRequest={() => setConfirm('delete-account')} />}
          {active === 'DATA'          && (
            <DataSection
              onClearWatchlist={() => setConfirm('clear-watchlist')}
              onClearPortfolio={() => setConfirm('clear-portfolio')}
              onClearNotes={() => setConfirm('clear-notes')}
            />
          )}
          {active === 'SUBSCRIPTION'  && <SubscriptionSection />}
        </div>
      </div>

      {confirm === 'delete-account' && (
        <ConfirmDialog
          title="DELETE ACCOUNT"
          message="This will permanently delete your Maddex account and all associated data. This action cannot be undone."
          requiresType="DELETE"
          requiresPassword
          onConfirm={handleDeleteAccount}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'clear-watchlist' && (
        <ConfirmDialog
          title="CLEAR WATCHLIST"
          message="This will remove all symbols from your watchlist. This cannot be undone."
          onConfirm={handleClearWatchlist}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'clear-portfolio' && (
        <ConfirmDialog
          title="CLEAR PORTFOLIO"
          message="This will remove all holdings from your portfolio. This cannot be undone."
          onConfirm={handleClearPortfolio}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'clear-notes' && (
        <ConfirmDialog
          title="CLEAR AI NOTES"
          message="This will delete all your saved AI notes. This cannot be undone."
          onConfirm={handleClearNotes}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
