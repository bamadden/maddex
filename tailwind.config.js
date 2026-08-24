/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          // Every terminal-* token resolves through a CSS custom property
          // holding an "R G B" triplet, via Tailwind's rgb(var(x) / <alpha-value>)
          // pattern — this is what lets useTheme.js swap the whole palette at
          // runtime (see :root in index.css for defaults) while still fully
          // supporting existing bg-terminal-x/NN opacity-modifier usages
          // across the app (Tailwind substitutes NN as <alpha-value>, default 1).
          bg:       'rgb(var(--t-bg) / <alpha-value>)',
          panel:    'rgb(var(--t-panel) / <alpha-value>)',
          header:   'rgb(var(--t-header) / <alpha-value>)',
          accent:   'rgb(var(--t-accent) / <alpha-value>)',
          surface:  'rgb(var(--t-surface) / <alpha-value>)',
          surface2: 'rgb(var(--t-surface2) / <alpha-value>)',
          surface3: 'rgb(var(--t-surface3) / <alpha-value>)',
          border:        'rgb(var(--t-border) / <alpha-value>)',
          // border-gold has no /NN modifier usages anywhere in the app, so it
          // stays a plain rgba() var swap rather than needing the triplet dance.
          'border-gold': 'var(--t-border-gold)',
          gold:        'rgb(var(--t-gold) / <alpha-value>)',
          'gold-bright': 'rgb(var(--t-gold-bright) / <alpha-value>)',
          'gold-dim':    'rgb(var(--t-gold-dim) / <alpha-value>)',
          blue:        'rgb(var(--t-blue) / <alpha-value>)',
          'blue-bright': 'rgb(var(--t-blue-bright) / <alpha-value>)',
          green:        'rgb(var(--t-green) / <alpha-value>)',
          'green-bright': 'rgb(var(--t-green-bright) / <alpha-value>)',
          'green-dim':    'rgb(var(--t-green-dim) / <alpha-value>)',
          red:          'rgb(var(--t-red) / <alpha-value>)',
          'red-bright':   'rgb(var(--t-red-bright) / <alpha-value>)',
          'red-dim':      'rgb(var(--t-red-dim) / <alpha-value>)',
          muted:        'rgb(var(--t-muted) / <alpha-value>)',
          'muted-bright': 'rgb(var(--t-muted-bright) / <alpha-value>)',
          text:        'rgb(var(--t-text) / <alpha-value>)',
          'text-dim':    'rgb(var(--t-text-dim) / <alpha-value>)',
          'text-bright': 'rgb(var(--t-text-bright) / <alpha-value>)',
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
