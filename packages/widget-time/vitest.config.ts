import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The workspace packages resolve to their sources, so nothing needs building first.
const alias = {
  '@rdf-data-manager/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
  '@rdf-data-manager/react': fileURLToPath(new URL('../react/src/index.ts', import.meta.url))
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: { name: 'widget-time', globals: true, environment: 'jsdom', setupFiles: ['./tests/setup.ts'] }
})
