// Testele automate ale site-ului: Vitest, cu un DOM simulat (jsdom) și Testing Library.
// Site-ul rulează pe backend-ul simulat din @evoting/api (fără VITE_API_URL), cu criptografie reală.

import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.tsx'],
      setupFiles: ['test/setup.ts'],
      // fără server: chiar dacă există un .env local cu VITE_API_URL, testele folosesc backend-ul simulat
      env: { VITE_API_URL: '' },
      // backend-ul simulat generează scrutinele de demonstrație cu criptografie reală la prima cerere
      testTimeout: 60_000,
    },
  }),
)
