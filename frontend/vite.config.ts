import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // KoboToolbox endpoints: /<username>/<project>/<list>/export/<file>.csv  and  /<username>/<project>/<list>/(add|remove|delete)
      '^/[^/]+/[^/]+/[^/]+/export/[^/]+\.csv$': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '^/[^/]+/[^/]+/[^/]+/(add|remove|delete)$': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
