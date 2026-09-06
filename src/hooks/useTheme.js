import { useCallback, useEffect, useState } from 'react'

// Each theme sets every --t-x CSS custom property tailwind.config.js's
// terminal-* colors resolve through (rgb(var(--t-x) / <alpha-value>)).
// Values are "R G B" space-separated triplets, except border-gold which
// is consumed as a raw rgba() string (see index.css comment for why).
export const THEMES = {
  dark: {
    label: 'DARK', swatch: '#0B1628',
    vars: {
      '--t-bg': '6 13 26', '--t-panel': '11 22 40', '--t-header': '10 31 61', '--t-accent': '26 58 107',
      '--t-surface': '11 22 40', '--t-surface2': '15 30 53', '--t-surface3': '21 37 64',
      '--t-border': '22 48 79', '--t-border-gold': 'rgba(201,168,76,0.25)',
      '--t-gold': '201 168 76', '--t-gold-bright': '232 201 106', '--t-gold-dim': '138 110 42',
      '--t-blue': '26 78 138', '--t-blue-bright': '45 125 210',
      '--t-green': '45 138 80', '--t-green-bright': '61 173 101', '--t-green-dim': '0 122 51',
      '--t-red': '168 50 50', '--t-red-bright': '201 62 62', '--t-red-dim': '183 28 28',
      '--t-muted': '99 120 153', '--t-muted-bright': '139 163 196',
      '--t-text': '232 237 245', '--t-text-dim': '184 200 216', '--t-text-bright': '232 240 255',
    },
  },
  darker: {
    label: 'DARKER', swatch: '#0A0A0C',
    vars: {
      '--t-bg': '0 0 0', '--t-panel': '10 10 12', '--t-header': '13 13 16', '--t-accent': '30 30 36',
      '--t-surface': '10 10 12', '--t-surface2': '16 16 20', '--t-surface3': '22 22 28',
      '--t-border': '36 36 44', '--t-border-gold': 'rgba(201,168,76,0.2)',
      '--t-gold': '201 168 76', '--t-gold-bright': '232 201 106', '--t-gold-dim': '122 98 36',
      '--t-blue': '20 51 94', '--t-blue-bright': '45 125 210',
      '--t-green': '35 122 69', '--t-green-bright': '52 160 92', '--t-green-dim': '10 92 42',
      '--t-red': '146 44 44', '--t-red-bright': '201 62 62', '--t-red-dim': '140 31 31',
      '--t-muted': '90 100 120', '--t-muted-bright': '126 138 160',
      '--t-text': '220 226 236', '--t-text-dim': '166 175 192', '--t-text-bright': '240 243 248',
    },
  },
  matrix: {
    label: 'MATRIX', swatch: '#04120A',
    vars: {
      '--t-bg': '0 4 1', '--t-panel': '3 10 5', '--t-header': '4 18 10', '--t-accent': '13 47 27',
      '--t-surface': '3 10 5', '--t-surface2': '6 20 7', '--t-surface3': '10 31 12',
      '--t-border': '20 92 44', '--t-border-gold': 'rgba(46,255,110,0.25)',
      '--t-gold': '46 255 110', '--t-gold-bright': '124 255 168', '--t-gold-dim': '30 158 72',
      '--t-blue': '20 107 58', '--t-blue-bright': '34 179 105',
      '--t-green': '46 204 93', '--t-green-bright': '108 255 156', '--t-green-dim': '21 122 52',
      '--t-red': '255 65 54', '--t-red-bright': '255 107 96', '--t-red-dim': '184 40 31',
      '--t-muted': '62 122 84', '--t-muted-bright': '99 181 134',
      '--t-text': '200 255 218', '--t-text-dim': '143 203 164', '--t-text-bright': '228 255 238',
    },
  },
  midnight: {
    label: 'MIDNIGHT', swatch: '#100E38',
    vars: {
      '--t-bg': '5 4 26', '--t-panel': '11 10 42', '--t-header': '16 14 56', '--t-accent': '42 36 112',
      '--t-surface': '11 10 42', '--t-surface2': '16 15 56', '--t-surface3': '24 20 84',
      '--t-border': '50 42 110', '--t-border-gold': 'rgba(168,148,255,0.25)',
      '--t-gold': '168 148 255', '--t-gold-bright': '198 184 255', '--t-gold-dim': '110 95 176',
      '--t-blue': '59 58 160', '--t-blue-bright': '108 111 224',
      '--t-green': '45 138 106', '--t-green-bright': '61 190 144', '--t-green-dim': '20 102 72',
      '--t-red': '178 58 107', '--t-red-bright': '224 86 140', '--t-red-dim': '131 42 78',
      '--t-muted': '108 102 152', '--t-muted-bright': '148 144 196',
      '--t-text': '230 226 255', '--t-text-dim': '182 175 222', '--t-text-bright': '244 241 255',
    },
  },
}

const STORAGE_KEY = 'maddex_theme'
const ACCENT_KEY = 'maddex_accent'

// The accent is the colour every heading, active tab, badge border and primary
// button in this terminal resolves through — `--t-gold` and its two variants.
// Themes each set their own, so the accent is applied AFTER the theme and
// overwrites those three properties only; everything else stays the theme's.
//
// Named "gold" throughout the codebase because that was the only option when
// the variables were written. Renaming ~400 usages to `--t-accent` to make the
// variable honest would touch every file and change nothing a user sees, so
// the name stays and this comment explains it.
export const ACCENTS = {
  gold:   { label: 'GOLD',   swatch: '#C9A84C', vars: { '--t-gold': '201 168 76',  '--t-gold-bright': '232 201 106', '--t-gold-dim': '138 110 42' } },
  blue:   { label: 'BLUE',   swatch: '#4A90D9', vars: { '--t-gold': '74 144 217',  '--t-gold-bright': '110 174 240', '--t-gold-dim': '42 88 138' } },
  green:  { label: 'GREEN',  swatch: '#4FA86B', vars: { '--t-gold': '79 168 107',  '--t-gold-bright': '110 200 138', '--t-gold-dim': '44 106 66' } },
  silver: { label: 'SILVER', swatch: '#A8B2C1', vars: { '--t-gold': '168 178 193', '--t-gold-bright': '206 214 226', '--t-gold-dim': '110 120 136' } },
}

function applyTheme(name, accent) {
  const theme = THEMES[name] || THEMES.dark
  const root = document.documentElement.style
  for (const [key, value] of Object.entries(theme.vars)) root.setProperty(key, value)

  // Applied second, deliberately: the theme sets a gold triplet of its own and
  // the accent has to win, or picking BLUE under DARKER would silently revert
  // to gold on the next theme application.
  const acc = ACCENTS[accent]
  if (acc) for (const [key, value] of Object.entries(acc.vars)) root.setProperty(key, value)
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved && THEMES[saved] ? saved : 'dark'
    } catch { return 'dark' }
  })

  const [accent, setAccentState] = useState(() => {
    try {
      const saved = localStorage.getItem(ACCENT_KEY)
      return saved && ACCENTS[saved] ? saved : 'gold'
    } catch { return 'gold' }
  })

  useEffect(() => {
    applyTheme(theme, accent)
  }, [theme, accent])

  const setTheme = useCallback((name) => {
    if (!THEMES[name]) return
    try { localStorage.setItem(STORAGE_KEY, name) } catch { /* private mode */ }
    setThemeState(name)
  }, [])

  const setAccent = useCallback((name) => {
    if (!ACCENTS[name]) return
    try { localStorage.setItem(ACCENT_KEY, name) } catch { /* private mode */ }
    setAccentState(name)
  }, [])

  return { theme, setTheme, themes: THEMES, accent, setAccent, accents: ACCENTS }
}
