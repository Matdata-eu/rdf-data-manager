import { quadKey, toNT, type Quad, type Term } from '../rdf/terms'

export interface Diff {
  deletes: Quad[]
  inserts: Quad[]
}

/**
 * The quads to delete and insert to turn `before` into `after`.
 *
 * A blank node has no identity outside its graph, so a changed triple of one cannot be
 * swapped on its own: the delete would match by value and the insert would mint a new,
 * unconnected node. Every blank node touched by a change is therefore replaced as a
 * whole: all of its triples (and those of blank nodes reachable from it, and the triple
 * that links it from its parent) are deleted and the new ones inserted.
 */
export function diffQuads (before: Quad[], after: Quad[]): Diff {
  const beforeKeys = new Map(before.map(q => [quadKey(q), q]))
  const afterKeys = new Map(after.map(q => [quadKey(q), q]))
  const deletes = [...beforeKeys].filter(([k]) => !afterKeys.has(k)).map(([, q]) => q)
  const inserts = [...afterKeys].filter(([k]) => !beforeKeys.has(k)).map(([, q]) => q)
  const touched = new Set<string>()
  for (const q of [...deletes, ...inserts]) for (const b of blanksOf(q)) touched.add(b)
  if (!touched.size) return { deletes, inserts }
  return { deletes: merge(deletes, closure(before, touched)), inserts: merge(inserts, closure(after, touched)) }
}

function merge (a: Quad[], b: Quad[]): Quad[] {
  const seen = new Set(a.map(quadKey))
  return [...a, ...b.filter(q => !seen.has(quadKey(q)))]
}

function blanksOf (q: Quad): string[] {
  return [q.subject, q.object].filter(t => t.termType === 'BlankNode').map(t => t.value)
}

/** All quads of a set that mention a blank node in `seeds`, following blank nodes transitively. */
function closure (quads: Quad[], seeds: Set<string>): Quad[] {
  const blanks = new Set<string>()
  const out: Quad[] = []
  const taken = new Set<string>()
  const queue = [...seeds]
  while (queue.length) {
    const b = queue.pop()!
    if (blanks.has(b)) continue
    blanks.add(b)
    for (const q of quads) {
      const own = blanksOf(q)
      if (!own.includes(b) || taken.has(quadKey(q))) continue
      taken.add(quadKey(q))
      out.push(q)
      for (const other of own) if (!blanks.has(other)) queue.push(other)
    }
  }
  return out
}

function hasBlank (q: Quad): boolean {
  return q.subject.termType === 'BlankNode' || q.object.termType === 'BlankNode'
}

function triples (quads: Quad[], render: (t: Term) => string = toNT): string {
  return quads.map(q => `  ${render(q.subject)} ${render(q.predicate)} ${render(q.object)} .`).join('\n')
}

function inGraph (body: string, graph?: string): string {
  return graph ? `GRAPH <${graph}> {\n${body}\n}` : body
}

export interface UpdateOptions {
  /**
   * IRI of a resource being created. The insert then only happens when nothing is
   * stored about it yet, so two people creating the same IRI cannot both succeed.
   */
  createOnly?: string
}

/**
 * Builds a SPARQL Update for a diff. Triples with blank nodes cannot be deleted with
 * DELETE DATA, so they are matched with variables in a DELETE … WHERE instead.
 */
export function buildUpdate (diff: Diff, graph?: string, options: UpdateOptions = {}): string {
  const ops: string[] = []
  if (options.createOnly && diff.deletes.length === 0 && diff.inserts.length) {
    const absent = inGraph(`<${options.createOnly}> ?p ?o .`, graph)
    return `INSERT {\n${inGraph(triples(diff.inserts), graph)}\n}\nWHERE {\n  FILTER NOT EXISTS { ${absent} }\n}`
  }
  const plainDeletes = diff.deletes.filter(q => !hasBlank(q))
  const blankDeletes = diff.deletes.filter(hasBlank)
  if (plainDeletes.length) ops.push(`DELETE DATA {\n${inGraph(triples(plainDeletes), graph)}\n}`)
  if (blankDeletes.length) {
    const asVar = (t: Term) => t.termType === 'BlankNode' ? `?b_${t.value.replace(/[^A-Za-z0-9_]/g, '_')}` : toNT(t)
    const pattern = inGraph(triples(blankDeletes, asVar), graph)
    ops.push(`DELETE {\n${pattern}\n}\nWHERE {\n${pattern}\n}`)
  }
  if (diff.inserts.length) ops.push(`INSERT DATA {\n${inGraph(triples(diff.inserts), graph)}\n}`)
  return ops.join(' ;\n')
}
