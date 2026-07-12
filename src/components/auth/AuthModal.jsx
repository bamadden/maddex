import { useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabase'

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

function passwordStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['', '#ff1744', '#f59e0b', '#3b82f6', '#00c853']

function PasswordStrength({ password }) {
  if (!password) return null
  const score = passwordStrength(password)
  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-0.5 flex-1 transition-all duration-300"
            style={{ backgroundColor: i <= score ? STRENGTH_COLORS[score] : '#0d2244' }}
          />
        ))}
      </div>
      <div className="text-2xs" style={{ color: STRENGTH_COLORS[score] }}>
        {STRENGTH_LABELS[score]}
      </div>
    </div>
  )
}

function CountrySelect({ value, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left bg-terminal-bg border border-terminal-border px-3 py-2 text-xs text-terminal-text-bright focus:border-terminal-gold outline-none font-mono flex justify-between items-center"
      >
        <span className={value ? 'text-terminal-text-bright' : 'text-terminal-text-dim'}>{value || 'Select country...'}</span>
        <span className="text-terminal-text-dim">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 w-full top-full mt-0.5 bg-terminal-panel border border-terminal-border shadow-2xl max-h-48 flex flex-col">
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
                } ${c === 'Australia' ? 'font-bold' : ''}`}
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

function Input({ label, error, ...props }) {
  return (
    <div className="space-y-1">
      {label && <div className="text-2xs text-terminal-text-dim tracking-widest uppercase">{label}</div>}
      <input
        {...props}
        className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono placeholder-terminal-text-dim/50 disabled:opacity-40"
      />
      {error && <div className="text-2xs text-terminal-red">{error}</div>}
    </div>
  )
}

export default function AuthModal({ deletedMessage }) {
  const [tab, setTab] = useState('signin')
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState(deletedMessage || null)
  const [forgotSent, setForgotSent] = useState(false)

  // Sign in state
  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [siErrors, setSiErrors] = useState({})

  // Sign up state
  const [suFirst, setSuFirst] = useState('')
  const [suLast, setSuLast] = useState('')
  const [suCountry, setSuCountry] = useState('Australia')
  const [suEmail, setSuEmail] = useState('')
  const [suPassword, setSuPassword] = useState('')
  const [suConfirm, setSuConfirm] = useState('')
  const [suErrors, setSuErrors] = useState({})
  const [signedUp, setSignedUp] = useState(false)

  const { signIn, signUp, signInWithGoogle } = useAuthStore()

  const handleSignIn = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!siEmail) errs.email = 'Email is required'
    if (!siPassword) errs.password = 'Password is required'
    if (Object.keys(errs).length) { setSiErrors(errs); return }
    setSiErrors({}); setGlobalError(null); setLoading(true)
    const { error } = await signIn(siEmail, siPassword)
    setLoading(false)
    if (error) setGlobalError(error.message)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!suFirst.trim()) errs.firstName = 'First name is required'
    if (!suLast.trim()) errs.lastName = 'Last name is required'
    if (!suCountry) errs.country = 'Country is required'
    if (!suEmail) errs.email = 'Email is required'
    if (!suPassword || suPassword.length < 8) errs.password = 'Password must be at least 8 characters'
    if (suPassword !== suConfirm) errs.confirm = 'Passwords do not match'
    if (Object.keys(errs).length) { setSuErrors(errs); return }
    setSuErrors({}); setGlobalError(null); setLoading(true)
    const { error } = await signUp(suEmail, suPassword, suFirst, suLast, suCountry)
    setLoading(false)
    if (error) setGlobalError(error.message)
    else setSignedUp(true)
  }

  const handleForgotPassword = async () => {
    if (!siEmail) { setSiErrors({ email: 'Enter your email above first' }); return }
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(siEmail, { redirectTo: window.location.origin })
    setLoading(false)
    setForgotSent(true)
  }

  return (
    <div className="fixed inset-0 z-[200] bg-terminal-bg flex items-center justify-center font-mono"
      style={{ backgroundImage: 'radial-gradient(circle, #0d2244 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="w-full max-w-[420px] border border-terminal-gold bg-terminal-panel shadow-2xl mx-4">
        {/* Header */}
        <div className="py-6 px-6 text-center border-b border-terminal-border">
          <div className="text-terminal-gold text-2xl font-bold tracking-[0.3em]">▲ MADDEX</div>
          <div className="text-terminal-text-dim text-2xs tracking-[0.4em] mt-1">FINANCIAL INTELLIGENCE</div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-terminal-border">
          {['signin', 'signup'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setGlobalError(null) }}
              className={`flex-1 py-2.5 text-2xs font-bold tracking-widest transition-colors ${
                tab === t
                  ? 'text-terminal-gold border-b-2 border-terminal-gold -mb-px'
                  : 'text-terminal-text-dim hover:text-terminal-text'
              }`}
            >
              {t === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {globalError && (
            <div className="bg-terminal-red/10 border border-terminal-red/30 px-3 py-2 text-2xs text-terminal-red">
              {globalError}
            </div>
          )}

          {tab === 'signin' ? (
            signedUp ? null : (
              <form onSubmit={handleSignIn} className="space-y-3">
                {forgotSent && (
                  <div className="bg-terminal-green/10 border border-terminal-green/30 px-3 py-2 text-2xs text-terminal-green">
                    Password reset email sent — check your inbox.
                  </div>
                )}
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={siEmail}
                  onChange={e => setSiEmail(e.target.value)}
                  disabled={loading}
                  error={siErrors.email}
                  autoComplete="email"
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={siPassword}
                  onChange={e => setSiPassword(e.target.value)}
                  disabled={loading}
                  error={siErrors.password}
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-bold bg-terminal-gold text-terminal-bg tracking-widest hover:bg-terminal-gold-bright transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : 'SIGN IN'}
                </button>
                <div className="flex items-center gap-3 text-terminal-text-dim text-2xs">
                  <div className="flex-1 h-px bg-terminal-border" />
                  <span>or</span>
                  <div className="flex-1 h-px bg-terminal-border" />
                </div>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full text-center text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors"
                >
                  Forgot password?
                </button>
              </form>
            )
          ) : signedUp ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-terminal-green text-2xl">✓</div>
              <div className="text-xs text-terminal-text-bright font-bold">Account created!</div>
              <div className="text-2xs text-terminal-text-dim">
                Check your email to confirm your account, then sign in.
              </div>
              <button
                onClick={() => { setTab('signin'); setSignedUp(false) }}
                className="text-terminal-gold text-2xs underline"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="Ben"
                  value={suFirst}
                  onChange={e => setSuFirst(e.target.value)}
                  disabled={loading}
                  error={suErrors.firstName}
                  autoComplete="given-name"
                />
                <Input
                  label="Last Name"
                  placeholder="Madden"
                  value={suLast}
                  onChange={e => setSuLast(e.target.value)}
                  disabled={loading}
                  error={suErrors.lastName}
                  autoComplete="family-name"
                />
              </div>
              <div className="space-y-1">
                <div className="text-2xs text-terminal-text-dim tracking-widest uppercase">Country</div>
                <CountrySelect value={suCountry} onChange={setSuCountry} />
                {suErrors.country && <div className="text-2xs text-terminal-red">{suErrors.country}</div>}
              </div>
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={suEmail}
                onChange={e => setSuEmail(e.target.value)}
                disabled={loading}
                error={suErrors.email}
                autoComplete="email"
              />
              <div className="space-y-1">
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={suPassword}
                  onChange={e => setSuPassword(e.target.value)}
                  disabled={loading}
                  error={suErrors.password}
                  autoComplete="new-password"
                />
                <PasswordStrength password={suPassword} />
              </div>
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={suConfirm}
                onChange={e => setSuConfirm(e.target.value)}
                disabled={loading}
                error={suErrors.confirm}
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-xs font-bold bg-terminal-gold text-terminal-bg tracking-widest hover:bg-terminal-gold-bright transition-colors disabled:opacity-50"
              >
                {loading ? '...' : 'CREATE ACCOUNT'}
              </button>
              <div className="text-2xs text-terminal-text-dim text-center">
                By creating an account you agree to our Terms of Service
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
