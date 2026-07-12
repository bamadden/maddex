import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const SECTIONS = ['PROFILE', 'PREFERENCES', 'NOTIFICATIONS', 'SECURITY', 'DATA', 'SUBSCRIPTION']

const TIMEZONES = [
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Hong_Kong', 'Asia/Singapore',
  'Asia/Dubai', 'UTC',
]

const MODULES = ['markets', 'crypto', 'fx', 'macro', 'watchlist', 'news', 'global']

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
      <span
        className={`absolute top-0.5 w-4 h-4 bg-terminal-bg transition-all ${
          value ? 'left-5' : 'left-0.5'
        }`}
      />
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

// ─── PROFILE ──────────────────────────────────────────────────────────────────

function ProfileSection() {
  const { profile, updateProfile, user } = useAuthStore()
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    country: profile?.country || '',
    phone: profile?.phone || '',
    timezone: profile?.timezone || 'Australia/Sydney',
    bio: profile?.bio || '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const initials = [form.first_name[0], form.last_name[0]].filter(Boolean).join('').toUpperCase() || '?'

  const handleSave = async () => {
    setLoading(true); setError(null)
    const { error } = await updateProfile(form)
    setLoading(false)
    if (error) setError(error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Profile</SectionLabel>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 flex items-center justify-center bg-terminal-accent border border-terminal-gold text-terminal-gold text-lg font-bold">
          {initials}
        </div>
        <div>
          <div className="text-xs text-terminal-text-bright font-bold">{form.first_name} {form.last_name}</div>
          <div className="text-2xs text-terminal-text-dim">{user?.email}</div>
          {profile?.updated_at && (
            <div className="text-2xs text-terminal-text-dim/60 mt-0.5">
              Updated {new Date(profile.updated_at).toLocaleDateString('en-AU')}
            </div>
          )}
        </div>
      </div>

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

      <div className="space-y-1">
        <div className="text-2xs text-terminal-text-dim">EMAIL</div>
        <input
          value={user?.email || ''}
          disabled
          className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-dim outline-none font-mono opacity-60"
        />
        <div className="text-2xs text-terminal-text-dim/60">Changing email requires verification</div>
      </div>

      {[['country', 'COUNTRY'], ['phone', 'PHONE (OPTIONAL)']].map(([k, l]) => (
        <div key={k} className="space-y-1">
          <div className="text-2xs text-terminal-text-dim">{l}</div>
          <input
            value={form[k]}
            onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
            className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
          />
        </div>
      ))}

      <div className="space-y-1">
        <div className="text-2xs text-terminal-text-dim">TIMEZONE</div>
        <select
          value={form.timezone}
          onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
          className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
        >
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <div className="text-2xs text-terminal-text-dim">BIO (OPTIONAL)</div>
        <textarea
          value={form.bio}
          onChange={e => setForm(f => ({ ...f, bio: e.target.value.slice(0, 200) }))}
          rows={3}
          placeholder="Tell us about yourself..."
          className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono resize-none"
        />
        <div className="text-2xs text-terminal-text-dim/60 text-right">{form.bio.length}/200</div>
      </div>

      {error && <div className="text-2xs text-terminal-red">{error}</div>}
      <SaveButton onClick={handleSave} loading={loading} saved={saved} />
    </div>
  )
}

// ─── PREFERENCES ─────────────────────────────────────────────────────────────

function PreferencesSection() {
  const { settings, updateSettings } = useAuthStore()
  const { setCurrency: setStoreCurrency } = useStore()
  const [currency, setCurrency] = useState(settings?.currency || 'AUD')
  const [defaultModule, setDefaultModule] = useState(settings?.default_module || 'markets')
  const [refreshInterval, setRefreshInterval] = useState(settings?.auto_refresh_interval || 60)
  const [compactMode, setCompactMode] = useState(settings?.compact_mode || false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    await updateSettings({ currency, default_module: defaultModule, auto_refresh_interval: refreshInterval, compact_mode: compactMode })
    setStoreCurrency(currency)
    setLoading(false)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
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

      <FieldRow label="Compact Mode" note="Reduces padding for more data density">
        <Toggle value={compactMode} onChange={setCompactMode} />
      </FieldRow>

      <FieldRow label="Theme" note="Light theme coming soon">
        <div className="flex gap-2">
          <span className="px-2 py-0.5 text-2xs bg-terminal-gold text-terminal-bg font-bold">Dark</span>
          <span className="px-2 py-0.5 text-2xs text-terminal-text-dim/40 border border-terminal-border">Light</span>
        </div>
      </FieldRow>

      <SaveButton onClick={handleSave} loading={loading} saved={saved} />
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
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)

  const handleUpdatePassword = async () => {
    setPwError(null)
    if (!newPw || newPw.length < 8) { setPwError('Password must be at least 8 characters'); return }
    if (newPw !== confirm) { setPwError('Passwords do not match'); return }
    setPwLoading(true)
    const { error } = await updatePassword(newPw)
    setPwLoading(false)
    if (error) setPwError(error.message)
    else { setPwSaved(true); setCurrent(''); setNewPw(''); setConfirm(''); setTimeout(() => setPwSaved(false), 2000) }
  }

  return (
    <div className="space-y-6">
      <SectionLabel>Security</SectionLabel>

      <div className="space-y-3">
        <div className="text-xs font-bold text-terminal-text-bright">CHANGE PASSWORD</div>
        <div className="space-y-1">
          <div className="text-2xs text-terminal-text-dim">CURRENT PASSWORD</div>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs outline-none focus:border-terminal-gold font-mono text-terminal-text-bright"
            placeholder="••••••••"
          />
        </div>
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
        <SaveButton onClick={handleUpdatePassword} loading={pwLoading} saved={pwSaved} />
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
        supabase.from('profiles').select('*').single(),
        supabase.from('watchlist').select('*'),
        supabase.from('portfolio_holdings').select('*'),
        supabase.from('price_alerts').select('*'),
        supabase.from('ai_notes').select('*'),
        supabase.from('user_settings').select('*').single(),
      ])
      const exportData = {
        exported_at: new Date().toISOString(),
        profile: profile.data,
        watchlist: watchlist.data,
        portfolio: portfolio.data,
        price_alerts: alerts.data,
        ai_notes: notes.data,
        settings: settings.data,
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
  const { profile } = useAuthStore()
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
            defaultValue={profile?.email || ''}
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

  const handleDeleteAccount = async (password) => {
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
          {active === 'SECURITY'      && (
            <SecuritySection onDeleteRequest={() => setConfirm('delete-account')} />
          )}
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
