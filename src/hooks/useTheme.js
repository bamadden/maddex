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

function applyTheme(name) {
  const theme = THEMES[name] || THEMES.dark
  const root = document.documentElement.style
  for (const [key, value] of Object.entries(theme.vars)) root.setProperty(key, value)
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved && THEMES[saved] ? saved : 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((name) => {
    if (!THEMES[name]) return
    localStorage.setItem(STORAGE_KEY, name)
    setThemeState(name)
  }, [])

  return { theme, setTheme, themes: THEMES }
}
