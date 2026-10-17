import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// RDM_PROXY_TARGET lets the dev server forward /proxy/* to a SPARQL server, which
// avoids CORS problems during development, e.g.
//   RDM_PROXY_TARGET=http://localhost:8030 npm run dev
// and then use http://localhost:5173/proxy/jena-fuseki/metadata/ as the dataset URL.
const proxyTarget = process.env.RDM_PROXY_TARGET

// The workspace packages resolve to their sources, so nothing needs building first.
const alias = {
  '@rdf-data-manager/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
  '@rdf-data-manager/react': fileURLToPath(new URL('../react/src/index.ts', import.meta.url)),
  '@rdf-data-manager/widget-map': fileURLToPath(new URL('../widget-map/src/index.tsx', import.meta.url)),
  '@rdf-data-manager/widget-time': fileURLToPath(new URL('../widget-time/src/index.tsx', import.meta.url))
}

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias },
  server: proxyTarget
    ? {
        proxy: {
          '/proxy': {
            target: proxyTarget,
            changeOrigin: true,
            rewrite: path => path.replace(/^\/proxy/, '')
          }
        }
      }
    : undefined,
  test: {
    name: 'app',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**']
  }
})
