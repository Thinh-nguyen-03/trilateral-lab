import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['maplibre-gl', 'react-map-gl'],
  },
})
