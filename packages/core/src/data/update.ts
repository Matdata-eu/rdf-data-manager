import { quadKey, toNT, type Quad, type Term } from '../rdf/terms'

export interface Diff {
  deletes: Quad[]
  inserts: Quad[]
}

export function diffQuads (before: Quad[], after: Quad[]): Diff {
  const beforeKeys = new Map(before.map(q => [quadKey(q), q]))
  const afterKeys = new Map(after.map(q => [quadKey(q), q]))
  return {
    deletes: [...beforeKeys].filter(([k]) => !afterKeys.has(k)).map(([, q]) => q),
    inserts: [...afterKeys].filter(([k]) => !beforeKeys.has(k)).map(([, q]) => q)
  }
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
