import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // In dev, the Bun server runs on :3000; proxy all /api/* so cookies
      // and same-origin requests Just Work without CORS shenanigans.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
        // Pass through Set-Cookie headers so the session cookie sticks
        // back on the vite dev server's origin.
        cookieDomainRewrite: ''
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
