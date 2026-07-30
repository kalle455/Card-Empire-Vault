import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Codespaces forwards the local Vite server through a public app.github.dev address.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
