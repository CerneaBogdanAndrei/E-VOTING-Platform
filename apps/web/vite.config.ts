import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // verificatorul pornește Web Workers ca module ES (src/lib/verify.worker.ts)
  worker: { format: 'es' },
})
