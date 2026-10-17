import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The workspace packages resolve to their sources, so nothing needs building first.
const alias = {
  '@rdf-data-manager/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url))
}

export default defineConfig({
  resolve: { alias },
  test: { name: 'store-memory', globals: true, environment: 'node' }
})
