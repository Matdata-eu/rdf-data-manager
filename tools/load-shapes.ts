/**
 * Uploads a shapes file into a named graph of a Fuseki dataset, replacing that graph.
 *
 *   npm run load-shapes -- http://localhost:8030/jena-fuseki/metadata/
 *
 * Uses the SPARQL 1.1 Graph Store Protocol endpoint (<dataset>/data).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { DEFAULT_SHAPES_GRAPH } from '../src/config/config'

async function main (): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      shapes: { type: 'string', default: fileURLToPath(new URL('../shapes/dim-metadata.shapes.ttl', import.meta.url)) },
      graph: { type: 'string', default: DEFAULT_SHAPES_GRAPH },
      help: { type: 'boolean', short: 'h', default: false }
    }
  })
  if (values.help || positionals.length !== 1) {
    console.error('Usage: load-shapes <dataset URL> [--shapes file] [--graph iri]')
    return values.help ? 0 : 2
  }
  const url = `${positionals[0].replace(/\/+$/, '')}/data?graph=${encodeURIComponent(values.graph!)}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/turtle; charset=utf-8' },
    body: readFileSync(values.shapes!)
  })
  if (!response.ok) {
    console.error(`Upload failed: HTTP ${response.status} ${await response.text()}`)
    return 1
  }
  console.log(`Loaded ${values.shapes} into <${values.graph}> (HTTP ${response.status})`)
  return 0
}

main().then(code => process.exit(code), err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(2)
})
