import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dashboardFileStore } from './server/fileStore'

export default defineConfig({
  // The file store serves /api/data locally, so dev and preview persist to
  // data/dashboard.json instead of leaving edits in one browser.
  plugins: [react(), tailwindcss(), dashboardFileStore()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: { port: 3000 },
  test: {
    // Pure logic only — no DOM harness. Anything needing a document is a
    // sign the logic belongs in a lib module instead.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
