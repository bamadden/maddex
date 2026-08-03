import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/frankfurter': {
        // api.frankfurter.app 301-redirects to api.frankfurter.dev/v1 — point
        // at the new host directly to skip that hop.
        target: 'https://api.frankfurter.dev/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/frankfurter/, ''),
      },
      '/api/rba': {
        target: 'https://api.rba.gov.au',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rba/, ''),
      },
      '/api/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stooq/, ''),
      },
    },
  },
})
