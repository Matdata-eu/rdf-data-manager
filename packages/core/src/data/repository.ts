import { Parser } from 'n3'
import { SparqlClient, type SparqlQueryClient } from '../sparql/client'
import {
  LABEL_PROPERTIES, RDF_TYPE, toNT, type Quad, type Term
} from '../rdf/terms'
import { buildShapesModel, isDetails, MAX_DETAILS_DEPTH, type NodeShape, type ShapesModel } from '../shapes/model'
import { buildUpdate } from './update'

function iriList (iris: string[]): string {
  return iris.map(i => `<${i}>`).join(' ')
}

/** A string literal for a SPARQL query. */
export function sparqlString (value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`
}

export function chunk<T> (items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface InstanceSummary {
  iri: string
  labels: Term[]
}

export interface SearchHit extends InstanceSummary {
  classIri: string
}

/** A triple elsewhere that points at a resource. */
export interface Reference {
  subject: string
  predicate: string
  /** The subject's classes, so the app can link to it when one is managed. */
  classes: string[]
}

/** What the repository needs to know about the endpoint and the shapes. */
export interface RepositoryConfig {
  queryUrl: string
  updateUrl: string
  /** Named graph that holds the data. Empty means the default graph. */
  dataGraph: string
  shapes: ShapesSource
  timeoutMs?: number
  /** Extra HTTP headers for every request, e.g. an Authorization header. */
  headers?: Record<string, string>
}

export type ShapesSource =
  | { source: 'endpoint'; graph: string }
  | { source: 'url'; url: string }
  | { source: 'inline'; turtle: string; name: string }

export class Repository {
  readonly client: SparqlQueryClient

  constructor (readonly config: RepositoryConfig, client?: SparqlQueryClient) {
    this.client = client ?? new SparqlClient({
      queryUrl: config.queryUrl,
      updateUrl: config.updateUrl || config.queryUrl,
      timeoutMs: config.timeoutMs,
      headers: config.headers
    })
  }

  /** Wraps a graph pattern in GRAPH <g> when a data graph is configured. */
  g (pattern: string): string {
    return this.config.dataGraph ? `GRAPH <${this.config.dataGraph}> { ${pattern} }` : pattern
  }

  async loadShapes (): Promise<ShapesModel> {
    const src = this.config.shapes
    if (src.source === 'endpoint') {
      const quads = await this.client.construct(`CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <${src.graph}> { ?s ?p ?o } }`)
      if (quads.length === 0) {
        throw new Error(`The shapes graph <${src.graph}> is empty or missing on the endpoint. Load the shapes into it, or pick a shapes file or URL in Settings.`)
      }
      return buildShapesModel(quads)
    }
    if (src.source === 'url') {
      const response = await fetch(src.url)
      if (!response.ok) throw new Error(`Could not load shapes from ${src.url}: HTTP ${response.status}`)
      return buildShapesModel(new Parser({ baseIRI: src.url }).parse(await response.text()))
    }
    return buildShapesModel(new Parser().parse(src.turtle))
  }

  async countInstances (classes: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    if (classes.length === 0) return out
    const rows = await this.client.select(`
      SELECT ?c (COUNT(DISTINCT ?s) AS ?n)
      WHERE { VALUES ?c { ${iriList(classes)} } ${this.g('?s a ?c .')} }
      GROUP BY ?c`)
    for (const row of rows) out.set(row.c.value, Number(row.n.value))
    return out
  }

  async listInstances (classIri: string, limit = 5000): Promise<InstanceSummary[]> {
    const rows = await this.client.select(`
      SELECT ?s ?label
      WHERE {
        ${this.g(`?s a <${classIri}> . OPTIONAL { ?s ${LABEL_PROPERTIES.map(p => `<${p}>`).join('|')} ?label }`)}
      }
      LIMIT ${limit}`)
    const byIri = new Map<string, InstanceSummary>()
    for (const row of rows) {
      if (row.s.termType !== 'NamedNode') continue
      const entry = byIri.get(row.s.value) ?? { iri: row.s.value, labels: [] }
      if (row.label) entry.labels.push(row.label)
      byIri.set(row.s.value, entry)
    }
    return [...byIri.values()]
  }

  /** Label literals for the given resources, keyed by IRI. */
  async labels (iris: string[]): Promise<Map<string, Term[]>> {
    const out = new Map<string, Term[]>()
    for (const part of chunk([...new Set(iris)], 200)) {
      const rows = await this.client.select(`
        SELECT ?s ?label
        WHERE { VALUES ?s { ${iriList(part)} } ${this.g(`?s ${LABEL_PROPERTIES.map(p => `<${p}>`).join('|')} ?label .`)} }`)
      for (const row of rows) {
        const list = out.get(row.s.value) ?? []
        list.push(row.label)
        out.set(row.s.value, list)
      }
    }
    return out
  }

  async exists (iri: string): Promise<boolean> {
    return this.client.ask(`ASK { ${this.g(`{ <${iri}> ?p ?o } UNION { ?s ?p2 <${iri}> }`)} }`)
  }

  /**
   * Loads a resource with all its own triples and those of the nested nodes that its
   * shape edits or shows in place (dash:DetailsEditor / dash:DetailsViewer).
   */
  async loadResource (iri: string, shape: NodeShape, model: ShapesModel): Promise<Quad[]> {
    return this.client.construct(this.treeQuery(`<${iri}>`, `BIND(<${iri}> AS ?s0)`, shape, model))
  }

  /** The same triples as loadResource, for every instance of a class at once. */
  async loadClassData (classIri: string, shape: NodeShape, model: ShapesModel): Promise<Quad[]> {
    return this.client.construct(this.treeQuery('?s0', `?s0 a <${classIri}> .`, shape, model))
  }

  /**
   * CONSTRUCT for a root and the nested nodes its shape owns. Each branch binds its own
   * variables, so the query stays simple for any SPARQL 1.1 store.
   */
  private treeQuery (root: string, rootPattern: string, shape: NodeShape, model: ShapesModel): string {
    const branches: string[] = [`{ ${rootPattern} ${root} ?p0 ?o0 . }`]
    let counter = 0
    const walk = (s: NodeShape, prefix: string, depth: number) => {
      if (depth > MAX_DETAILS_DEPTH) return
      for (const p of s.properties) {
        if (!isDetails(p) || !p.node) continue
        const nested = model.nodeShapes.get(p.node)
        const n = ++counter
        const chain = `${prefix} <${p.path.value}> ?n${n} .`
        branches.push(`{ ${rootPattern} ${chain} ?n${n} ?p${n} ?o${n} . BIND(?n${n} AS ?s${n}) }`)
        if (nested) walk(nested, `${chain} ?n${n}`, depth + 1)
      }
    }
    walk(shape, root, 1)
    const template = branches.map((_, i) => `?s${i} ?p${i} ?o${i} .`).join(' ')
    return `CONSTRUCT { ${template} } WHERE { ${this.g(branches.join(' UNION '))} }`
  }

  /** Instances of the given classes whose label or IRI contains the text (case-insensitive). */
  async search (classIris: string[], needle: string, limit = 50): Promise<SearchHit[]> {
    const q = needle.trim()
    if (!q || classIris.length === 0) return []
    const rows = await this.client.select(`
      SELECT ?s ?c ?label
      WHERE {
        VALUES ?c { ${iriList(classIris)} }
        ${this.g(`?s a ?c . OPTIONAL { ?s ${LABEL_PROPERTIES.map(p => `<${p}>`).join('|')} ?label }`)}
        FILTER (CONTAINS(LCASE(STR(?label)), LCASE(${sparqlString(q)})) || CONTAINS(LCASE(STR(?s)), LCASE(${sparqlString(q)})))
      }
      LIMIT ${limit}`)
    const byIri = new Map<string, SearchHit>()
    for (const row of rows) {
      if (row.s.termType !== 'NamedNode') continue
      const entry = byIri.get(row.s.value) ?? { iri: row.s.value, classIri: row.c.value, labels: [] }
      if (row.label) entry.labels.push(row.label)
      byIri.set(row.s.value, entry)
    }
    return [...byIri.values()]
  }

  /** Triples outside the given nodes that point at the resource, with the subjects' classes. */
  async references (iri: string, owned: string[], limit = 200): Promise<Reference[]> {
    const rows = await this.client.select(`
      SELECT ?s ?p ?c
      WHERE {
        ${this.g(`?s ?p <${iri}> . OPTIONAL { ?s a ?c }`)}
        FILTER (?s NOT IN (${owned.map(o => `<${o}>`).join(', ') || `<${iri}>`}))
      }
      LIMIT ${limit * 4}`)
    const out = new Map<string, Reference>()
    for (const row of rows) {
      const key = `${toNT(row.s)} ${row.p.value}`
      const entry = out.get(key) ?? { subject: row.s.value, predicate: row.p.value, classes: [] }
      if (row.c && !entry.classes.includes(row.c.value)) entry.classes.push(row.c.value)
      out.set(key, entry)
    }
    return [...out.values()].slice(0, limit)
  }

  /** The texts reached from a value by a SPARQL property path (rdm:queryText), which may use the given prefixes. */
  async texts (iri: string, path: string, prefixes: Record<string, string> = {}): Promise<string[]> {
    const declared = Object.entries(prefixes).map(([p, ns]) => `PREFIX ${p}: <${ns}>`).join('\n')
    const rows = await this.client.select(`${declared}\nSELECT DISTINCT ?text WHERE { ${this.g(`<${iri}> ${path} ?text .`)} }`)
    return rows.map(r => r.text.value)
  }

  /** Runs a SELECT query as it is, for previews. */
  async preview (query: string, limit = 100): Promise<{ columns: string[]; rows: Record<string, Term>[] }> {
    const text = /\bLIMIT\s+\d+\s*$/i.test(query.trim()) ? query : `${query}\nLIMIT ${limit}`
    const rows = await this.client.select(text)
    const columns: string[] = []
    for (const row of rows) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k)
    return { columns, rows }
  }

  /** Adds triples, in chunks so a large import does not exceed request limits. */
  async insert (quads: Quad[]): Promise<void> {
    for (const part of chunk(quads, 2000)) {
      await this.update(buildUpdate({ deletes: [], inserts: part }, this.config.dataGraph || undefined))
    }
  }

  /**
   * Triples around the resources a form refers to (two hops out, and in and back
   * out except through rdf:type), so
   * validation can check sh:class and SPARQL constraints that look at neighbouring nodes.
   */
  async contextQuads (iris: string[]): Promise<Quad[]> {
    const out: Quad[] = []
    for (const part of chunk([...new Set(iris)], 100)) {
      out.push(...await this.client.construct(`
        CONSTRUCT { ?o ?p ?x . ?x ?r ?z . ?y ?q ?o . ?y ?s ?w }
        WHERE {
          VALUES ?o { ${iriList(part)} }
          ${this.g(`{ ?o ?p ?x } UNION { ?o ?p ?x . ?x ?r ?z }
            UNION { ?y ?q ?o . FILTER (?q != ${toNT(RDF_TYPE)}) }
            UNION { ?y ?q ?o . FILTER (?q != ${toNT(RDF_TYPE)}) ?y ?s ?w }`)}
        }`))
    }
    return out
  }

  /** Number of triples outside the given nodes that point at the resource. */
  async incomingReferences (iri: string, owned: string[]): Promise<number> {
    const rows = await this.client.select(`
      SELECT (COUNT(*) AS ?n)
      WHERE {
        ${this.g(`?s ?p <${iri}> .`)}
        FILTER (?s NOT IN (${owned.map(o => `<${o}>`).join(', ') || `<${iri}>`}))
      }`)
    return Number(rows[0]?.n.value ?? 0)
  }

  /** Instances of a class with labels, for pickers. */
  async options (classIris: string[]): Promise<InstanceSummary[]> {
    const lists = await Promise.all(classIris.map(c => this.listInstances(c, 2000)))
    const byIri = new Map<string, InstanceSummary>()
    for (const item of lists.flat()) byIri.set(item.iri, item)
    return [...byIri.values()]
  }

  async update (text: string): Promise<void> {
    await this.client.update(text)
  }
}
