import { Parser } from 'n3'
import type { AppConfig } from '../config/config'
import { SparqlClient } from '../sparql/client'
import {
  LABEL_PROPERTIES, RDF_TYPE, toNT, type Quad, type Term
} from '../rdf/terms'
import { buildShapesModel, type NodeShape, type PropertyShape, type ShapesModel } from '../shapes/model'
import { DASH } from '../form/editors'

/** Nested nodes are loaded and edited together with their parent up to this depth. */
export const MAX_DETAILS_DEPTH = 3

export function isDetails (p: PropertyShape): boolean {
  if (p.editor === DASH.DetailsEditor || p.viewer === DASH.DetailsViewer) return true
  return !p.editor && !p.viewer && Boolean(p.node) && (p.nodeKind?.endsWith('#BlankNode') ?? false)
}

function iriList (iris: string[]): string {
  return iris.map(i => `<${i}>`).join(' ')
}

function chunk<T> (items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface InstanceSummary {
  iri: string
  labels: Term[]
}

export class Repository {
  readonly client: SparqlClient

  constructor (readonly config: AppConfig, client?: SparqlClient) {
    this.client = client ?? new SparqlClient({
      queryUrl: config.queryUrl,
      updateUrl: config.updateUrl || config.queryUrl,
      timeoutMs: config.timeoutMs
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
    const branches: string[] = [`{ <${iri}> ?p0 ?o0 . BIND(<${iri}> AS ?s0) }`]
    let counter = 0
    const walk = (s: NodeShape, prefix: string, depth: number) => {
      if (depth > MAX_DETAILS_DEPTH) return
      for (const p of s.properties) {
        if (!isDetails(p) || !p.node) continue
        const nested = model.nodeShapes.get(p.node)
        const n = ++counter
        const chain = `${prefix} <${p.path.value}> ?n${n} .`
        branches.push(`{ ${chain} ?n${n} ?p${n} ?o${n} . BIND(?n${n} AS ?s${n}) }`)
        if (nested) walk(nested, `${chain} ?n${n}`, depth + 1)
      }
    }
    walk(shape, `<${iri}>`, 1)
    // Each branch binds its own variables; a single CONSTRUCT template per branch keeps
    // the query simple for any SPARQL 1.1 store.
    const template = branches.map((_, i) => `?s${i} ?p${i} ?o${i} .`).join(' ')
    const where = branches.join(' UNION ')
    return this.client.construct(`CONSTRUCT { ${template} } WHERE { ${this.g(where)} }`)
  }

  /**
   * Triples around the resources a form refers to (two hops out, and in
   * and back out except through rdf:type), so
   * validation can check sh:class and SPARQL constraints that look at neighbouring nodes.
   */
  async contextQuads (iris: string[]): Promise<Quad[]> {
    const out: Quad[] = []
    for (const part of chunk([...new Set(iris)], 100)) {
      out.push(...await this.client.construct(`
        CONSTRUCT { ?o ?p ?x . ?x ?r ?z . ?y ?q ?o . ?y ?s ?w }
        WHERE {
          VALUES ?o { ${iriList(part)} }
          ${this.g(`{ ?o ?p ?x } UNION { ?o ?p ?x . ?x ?r ?z } UNION { ?y ?q ?o }
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
