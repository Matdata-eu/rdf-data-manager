#!/usr/bin/env node
// Serves the built app from a local port, with no dependencies beyond Node itself.
//
//   npx rdf-data-manager [--port 8080] [--config ./config.json] [--host 127.0.0.1]
//
// --config copies a config.json next to index.html so the app starts on a given endpoint.
import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: process.env.PORT ?? '8080' },
    host: { type: 'string', default: '127.0.0.1' },
    config: { type: 'string', short: 'c' },
    help: { type: 'boolean', short: 'h', default: false }
  }
})
if (values.help) {
  console.log('Usage: rdf-data-manager [--port 8080] [--host 127.0.0.1] [--config config.json]')
  process.exit(0)
}

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
if (!existsSync(join(dist, 'index.html'))) {
  console.error('The built app is missing (dist/index.html). Run "npm run build" first.')
  process.exit(1)
}
const config = values.config ? readFileSync(resolve(values.config)) : undefined

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttl': 'text/turtle; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  if (path === '/config.json' && config) {
    res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' })
    res.end(config)
    return
  }
  const file = normalize(join(dist, path === '/' ? 'index.html' : path))
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }
  const immutable = path.startsWith('/assets/')
  res.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
  })
  createReadStream(file).pipe(res)
})

server.listen(Number(values.port), values.host, () => {
  console.log(`RDF Data Manager at http://${values.host}:${values.port}/`)
})
