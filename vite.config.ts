import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// RDM_PROXY_TARGET lets the dev server forward /proxy/* to a SPARQL server, which
// avoids CORS problems during development, e.g.
//   RDM_PROXY_TARGET=http://localhost:8030 npm run dev
// and then use http://localhost:5173/proxy/jena-fuseki/metadata/ as the dataset URL.
const proxyTarget = process.env.RDM_PROXY_TARGET

export default defineConfig({
  base: './',
  plugins: [react()],
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
    globals: true,
    environment: 'node'
  }
})
