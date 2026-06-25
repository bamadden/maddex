/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#040d1a',
          panel: '#071428',
          border: '#0d2244',
          accent: '#1a3a6b',
          gold: '#c8a84b',
          'gold-bright': '#f0c040',
          blue: '#1e5fa8',
          'blue-bright': '#3b82f6',
          green: '#00c853',
          'green-dim': '#007a33',
          red: '#ff1744',
          'red-dim': '#b71c1c',
          text: '#b8cce4',
          'text-dim': '#4a6580',
          'text-bright': '#e8f0ff',
          header: '#0a1f3d',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
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
