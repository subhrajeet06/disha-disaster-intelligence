import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * maplibre-gl v6 builds its worker URL dynamically (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`
 * with an interpolated filename), so bundlers cannot statically detect and emit the worker asset.
 * Dev is fixed via `optimizeDeps.exclude` (the worker is served straight from node_modules); for the
 * production build we copy the worker + its shared chunk next to the emitted JS bundle so
 * `new URL(...)` still resolves at runtime.
 */
function copyMaplibreWorkers(): Plugin {
  const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']
  return {
    name: 'copy-maplibre-workers',
    apply: 'build',
    writeBundle(options) {
      const root = dirname(fileURLToPath(import.meta.url))
      const outDir = resolve(root, options.dir ?? 'dist')
      const assetsDir = resolve(outDir, 'assets')
      mkdirSync(assetsDir, { recursive: true })
      for (const f of files) {
        cpSync(resolve(root, 'node_modules/maplibre-gl/dist', f), resolve(assetsDir, f))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyMaplibreWorkers()],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
