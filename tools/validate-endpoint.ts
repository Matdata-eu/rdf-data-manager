/**
 * Validates the content of a SPARQL endpoint against a shapes file.
 *
 *   npm run validate-endpoint -- http://localhost:8030/jena-fuseki/metadata/
 *
 * By default only the data the shapes look at is read, with a few CONSTRUCT queries:
 *   - all triples of instances of the classes the shapes target or reference
 *     (sh:targetClass, sh:class), plus their csvw:tableSchema and its csvw:column nodes;
 *   - dcterms:isVersionOf, dcterms:created and spin:text of managed query versions;
 *   - the dcat:Distribution nodes linked from those instances (skip with --no-distributions).
 * Each pattern is matched in the default graph and in every named graph except the
 * shapes graph. Use --full to CONSTRUCT the whole dataset instead.
 *
 * Exit code: 0 when the data conforms (warnings allowed), 1 when it does not, 2 on errors.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { Parser } from 'n3'
import { endpointsFromDataset, DEFAULT_SHAPES_GRAPH } from '../src/config/config'
import { SparqlClient } from '../src/sparql/client'
import { ShapesValidator, type Issue } from '../src/validation/validate'
import type { Quad } from '../src/rdf/terms'
import { ipv4Loopback } from './loopback'

const SH = 'http://www.w3.org/ns/shacl#'
const DISTRIBUTION = 'http://www.w3.org/ns/dcat#Distribution'

const PREFIXES = `
PREFIX csvw: <http://www.w3.org/ns/csvw#>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX spin: <http://spinrdf.org/spin#>
PREFIX yasgui: <https://matdata.eu/ns/yasgui#>
`

function inAllGraphs (pattern: string, shapesGraph: string): string {
  return `
  { ${pattern} }
  UNION
  { GRAPH ?g { ${pattern} } FILTER (?g != <${shapesGraph}>) }`
}

function queries (classes: string[], distributions: boolean, shapesGraph: string): Record<string, string> {
  const values = `VALUES ?type { ${classes.map(c => `<${c}>`).join(' ')} }`
  const all = (p: string) => inAllGraphs(p, shapesGraph)
  const result: Record<string, string> = {
    instances: `CONSTRUCT { ?s ?p ?o } WHERE { ${values} ${all('?s a ?type ; ?p ?o . FILTER (?p != dcat:distribution)')} }`,
    'table schemas': `CONSTRUCT { ?x ?p ?o } WHERE { ${values} ${all('?s a ?type ; csvw:tableSchema|csvw:tableSchema/csvw:column ?x . ?x ?p ?o .')} }`,
    'query versions': `CONSTRUCT { ?v dcterms:isVersionOf ?q ; dcterms:created ?created ; spin:text ?text } WHERE { ${all(`
      ?v dcterms:isVersionOf ?q .
      ?q a yasgui:ManagedQuery .
      OPTIONAL { ?v dcterms:created ?created }
      OPTIONAL { ?v spin:text ?text }`)} }`
  }
  if (distributions) {
    result.distributions = `CONSTRUCT { ?s dcat:distribution ?d . ?d ?p ?o } WHERE { ${values} ${all('?s a ?type ; dcat:distribution ?d . ?d ?p ?o .')} }`
  }
  return result
}

function shapeClasses (shapes: Quad[]): string[] {
  const classes = new Set(
    shapes
      .filter(q => q.predicate.value === `${SH}targetClass` || q.predicate.value === `${SH}class`)
      .map(q => q.object.value)
  )
  classes.delete(DISTRIBUTION)
  return [...classes].sort()
}

function summarise (issues: Issue[]): string {
  const groups = new Map<string, Issue[]>()
  for (const i of issues) {
    // SPARQL constraint messages embed the value, so those group by constraint alone.
    const key = [i.severity, i.sourceShape ?? '', i.sourceConstraint ?? '', i.constraint ?? '', i.sourceConstraint ? '' : i.message].join('\t')
    groups.set(key, [...(groups.get(key) ?? []), i])
  }
  const lines: string[] = []
  for (const [key, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const [severity, shape, , constraint] = key.split('\t')
    lines.push(`${String(list.length).padStart(5)}  ${severity.padEnd(9)} ${shape} (${constraint})`)
    lines.push(`       ${list.length > 1 && list[0].sourceConstraint ? `${list[0].message.replace(/:[^:]*$/, '')} (value differs per result)` : list[0].message}`)
    lines.push(`       e.g. ${list.slice(0, 3).map(i => i.focusNode).join(', ')}`)
  }
  return lines.join('\n')
}

async function main (): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      shapes: { type: 'string', default: fileURLToPath(new URL('../shapes/dim-metadata.shapes.ttl', import.meta.url)) },
      'shapes-graph': { type: 'string', default: DEFAULT_SHAPES_GRAPH },
      full: { type: 'boolean', default: false },
      'no-distributions': { type: 'boolean', default: false },
      timeout: { type: 'string', default: '300' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  })
  if (values.help || positionals.length !== 1) {
    console.error('Usage: validate-endpoint <dataset URL> [--shapes file] [--shapes-graph iri] [--full] [--no-distributions] [--timeout seconds] [--json]')
    return values.help ? 0 : 2
  }

  const shapes = new Parser().parse(readFileSync(values.shapes!, 'utf8'))
  const { queryUrl, updateUrl } = endpointsFromDataset(ipv4Loopback(positionals[0]))
  const client = new SparqlClient({ queryUrl, updateUrl, timeoutMs: Number(values.timeout) * 1000 })
  const shapesGraph = values['shapes-graph']!
  const todo = values.full
    ? { 'whole dataset': `CONSTRUCT { ?s ?p ?o } WHERE { ${inAllGraphs('?s ?p ?o', shapesGraph)} }` }
    : queries(shapeClasses(shapes), !values['no-distributions'], shapesGraph)

  const data: Quad[] = []
  for (const [name, query] of Object.entries(todo)) {
    const started = performance.now()
    const quads = await client.construct(PREFIXES + query)
    data.push(...quads)
    console.error(`Read ${quads.length} triples (${name}) in ${((performance.now() - started) / 1000).toFixed(1)}s`)
  }
  console.error(`Validating ${data.length} triples from ${queryUrl}`)

  const report = await new ShapesValidator(shapes).validate(data)
  if (values.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const count = (s: string) => report.issues.filter(i => i.severity === s).length
    console.log(`Conforms: ${report.conforms}. ${count('Violation')} violations, ${count('Warning')} warnings, ${count('Info')} infos.`)
    if (report.issues.length) console.log(`\n${summarise(report.issues)}`)
  }
  return report.conforms ? 0 : 1
}

main().then(code => process.exit(code), err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(2)
})
