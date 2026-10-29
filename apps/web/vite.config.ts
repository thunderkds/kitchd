import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // @kitchenos/shared compiles to CommonJS (the Nest API consumes the same
    // dist). Vite serves linked workspace packages raw over /@fs/ unless told
    // to pre-bundle them, and the browser can't import CJS as ESM — the app
    // never mounts. Force esbuild's CJS->ESM pre-bundle in dev.
    include: ['@kitchenos/shared'],
  },
  server: {
    port: 8766,
    strictPort: true,
  },
  preview: {
    // Render's Web Service serves the built app via `vite preview` behind
    // a *.onrender.com hostname that isn't known at config-write time —
    // allow the whole suffix rather than hardcoding one service's exact
    // subdomain (which can change if the service is renamed).
    allowedHosts: ['.onrender.com'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
