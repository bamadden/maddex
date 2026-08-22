/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          // Core surfaces — bg/panel/header/accent are kept (not renamed) so
          // the existing bg-terminal-panel / bg-terminal-header / bg-terminal-accent
          // usages across every module keep resolving; panel/header are tuned
          // to line up with the new surface/surface2 tones below.
          bg:       '#060D1A',
          panel:    '#0B1628',
          header:   '#0A1F3D',
          accent:   '#1a3a6b',
          // New surface scale — same "card background" concept as `panel`,
          // just with more steps for elevation/hover states.
          surface:  '#0B1628',
          surface2: '#0F1E35',
          surface3: '#152540',
          // `border` stays a solid hex (not the spec's raw rgba) so every
          // existing border-terminal-border/NN opacity-modifier usage across
          // the app keeps working — Tailwind's /NN modifier can't cleanly
          // layer on top of a color that's already an rgba() string.
          // `border-gold` is a brand-new token with no prior usages, so it's
          // safe to use the raw rgba() from the spec directly.
          border:        '#16304F',
          'border-gold': 'rgba(201,168,76,0.25)',
          gold:        '#C9A84C',
          'gold-bright': '#E8C96A',
          'gold-dim':    '#8A6E2A',
          blue:        '#1A4E8A',
          'blue-bright': '#2D7DD2',
          // green/red now match --color-gain/--color-loss (index.css) exactly
          // — those CSS vars already used this exact tone for price deltas
          // throughout the app; badges/icons using text-terminal-green were
          // the odd ones out with a brighter, less premium #00c853/#ff1744.
          green:        '#2D8A50',
          'green-bright': '#3DAD65',
          'green-dim':    '#007a33',
          red:          '#A83232',
          'red-bright':   '#C93E3E',
          'red-dim':      '#b71c1c',
          muted:        '#637899',
          'muted-bright': '#8BA3C4',
          text:        '#E8EDF5',
          'text-dim':    '#B8C8D8',
          'text-bright': '#e8f0ff',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      animation: {
        'ticker-scroll': 'ticker 40s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        blink: 'blink 1s step-end infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
      },
    },
  },
  plugins: [],
}
