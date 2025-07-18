import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:1218',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:1218',
        changeOrigin: true,
      },
      '/download': {
        target: 'http://localhost:1218',
        changeOrigin: true,
      },
    },
  },
})