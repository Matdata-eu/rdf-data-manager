import init, { Store, type Quad as OxQuad, type Term as OxTerm } from 'oxigraph'
import { blankNode, defaultGraph, literal, namedNode, type Bindings, type Quad, type SparqlQueryClient, type Term } from '@rdf-data-manager/core'
import { Parser, DataFactory } from 'n3'

const XSD = 'http://www.w3.org/2001/XMLSchema#'
/** Where literals of the datatypes below are kept inside Oxigraph. */
const KEPT = 'urn:x-rdf-data-manager:datatype:'
/**
 * Datatypes Oxigraph replaces with their primitive base on the way in (xsd:int becomes
 * xsd:integer, xsd:dateTimeStamp becomes xsd:dateTime). A real endpoint keeps them, and
 * sh:datatype checks the exact datatype, so the store keeps these under a private
 * datatype and restores them on the way out.
 */
const REWRITTEN = new Set([
  'dateTimeStamp', 'long', 'int', 'short', 'byte', 'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger',
  'negativeInteger', 'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte'
])
const REWRITTEN_IN_TEXT = new RegExp(`\\^\\^(?:<${XSD.replace(/[.#/]/g, '\\$&')}|xsd:)(${[...REWRITTEN].join('|')})>?(?![\\w-])`, 'g')

function keep (q: Quad): Quad {
  const o = q.object
  if (o.termType !== 'Literal' || !o.datatype.value.startsWith(XSD) || !REWRITTEN.has(o.datatype.value.slice(XSD.length))) return q
  return DataFactory.quad(q.subject, q.predicate, literal(o.value, namedNode(KEPT + o.datatype.value.slice(XSD.length))) as Quad['object'], q.graph)
}

/** The same for literals written into SPARQL text, which always spell out the datatype. */
function keepInText (sparql: string): string {
  return sparql.replace(REWRITTEN_IN_TEXT, (_, local: string) => `^^<${KEPT}${local}>`)
}

function toTerm (t: OxTerm): Term {
  switch (t.termType) {
    case 'NamedNode': return namedNode(t.value)
    case 'BlankNode': return blankNode(t.value)
    case 'Literal': return literal(t.value, t.language || namedNode(t.datatype.value.startsWith(KEPT) ? XSD + t.datatype.value.slice(KEPT.length) : t.datatype.value))
    default: return defaultGraph() as unknown as Term
  }
}

function toQuad (q: OxQuad): Quad {
  return DataFactory.quad(
    toTerm(q.subject) as Quad['subject'], toTerm(q.predicate) as Quad['predicate'], toTerm(q.object) as Quad['object'],
    q.graph.termType === 'DefaultGraph' ? undefined : toTerm(q.graph) as Quad['graph']
  )
}

let ready: Promise<void> | undefined

/** Loads the WebAssembly module once; in Node the module is ready as soon as it is imported. */
export function initMemoryStore (): Promise<void> {
  if (!ready) {
    const start = init as unknown
    ready = typeof start === 'function' ? (start as () => Promise<unknown>)().then(() => undefined) : Promise.resolve()
  }
  return ready
}

/**
 * A SPARQL store in memory, usable wherever the app expects an endpoint: tests, and a
 * demo that runs entirely in the browser. Call initMemoryStore() before constructing one
 * in a browser.
 */
export class MemoryClient implements SparqlQueryClient {
  readonly store: Store

  constructor (quads: Quad[] = []) {
    this.store = new Store()
    for (const q of quads) this.store.add(keep(q) as never)
  }

  /** Adds Turtle to the default graph, or to a named graph. */
  loadTurtle (turtle: string, graph?: string): void {
    for (const q of new Parser().parse(turtle)) {
      this.store.add(keep(DataFactory.quad(q.subject, q.predicate, q.object, graph ? namedNode(graph) : undefined)) as never)
    }
  }

  get size (): number {
    return this.store.size
  }

  async select (query: string): Promise<Bindings[]> {
    const result = this.store.query(keepInText(query)) as Array<Map<string, OxTerm>>
    return result.map(row => {
      const out: Bindings = {}
      for (const [k, v] of row) out[k] = toTerm(v)
      return out
    })
  }

  async ask (query: string): Promise<boolean> {
    return this.store.query(keepInText(query)) as boolean
  }

  async construct (query: string): Promise<Quad[]> {
    return (this.store.query(keepInText(query)) as OxQuad[]).map(toQuad)
  }

  async update (update: string): Promise<void> {
    this.store.update(keepInText(update))
  }

  /** Every quad, for exports and snapshots. */
  dump (): Quad[] {
    return this.store.match(null, null, null, null).map(toQuad)
  }
}
