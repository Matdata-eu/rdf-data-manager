import { Store, Writer } from 'n3'
import { RDF_TYPE, localName, ns, pickByLanguage, type Literal, type Quad, type Term } from '../rdf/terms'
import { isDetails, type NodeShape, type ShapesModel } from '../shapes/model'
import { editorFor } from '../form/kinds'

/** The prefixes the shapes declare (sh:declare), plus the usual ones. */
export function declaredPrefixes (model: ShapesModel): Record<string, string> {
  const out: Record<string, string> = {
    rdf: ns.rdf('').value, rdfs: ns.rdfs('').value, xsd: ns.xsd('').value, dcterms: ns.dcterms('').value, skos: ns.skos('').value
  }
  const store = new Store(model.quads)
  for (const decl of store.getObjects(null, ns.sh('declare'), null)) {
    const prefix = store.getObjects(decl as never, ns.sh('prefix'), null)[0]?.value
    const namespace = store.getObjects(decl as never, ns.sh('namespace'), null)[0]?.value
    if (prefix && namespace) out[prefix] = namespace
  }
  return out
}

export function toTurtle (quads: Quad[], prefixes: Record<string, string> = {}): string {
  const writer = new Writer({ prefixes })
  // Named-graph quads are written as plain triples: the export is the data, not its graph.
  for (const q of quads) writer.addQuad(q.subject, q.predicate, q.object)
  let out = ''
  writer.end((error, result) => {
    if (error) throw error
    out = result
  })
  return out
}

export interface Table {
  columns: string[]
  rows: string[][]
}

function cell (terms: Term[]): string {
  return terms.map(t => t.value).join(' | ')
}

/**
 * One row per instance with a column per top-level property. Language-tagged texts get
 * a column per language; nested nodes are left out (they have their own shapes), and
 * the IRI column comes first so the table can be joined back to the data.
 */
export function toTable (classIri: string, shape: NodeShape, quads: Quad[], languages: string[]): Table {
  const store = new Store(quads)
  const subjects = store.getSubjects(RDF_TYPE, { termType: 'NamedNode', value: classIri } as never, null)
    .filter(s => s.termType === 'NamedNode')
    .sort((a, b) => a.value.localeCompare(b.value))
  const properties = shape.properties.filter(p => !isDetails(p) && !p.hidden)
  const langs = new Set<string>()
  for (const p of properties) {
    if (!['langText', 'langTextarea'].includes(editorFor(p))) continue
    for (const l of p.languages ?? p.languageIn ?? languages) langs.add(l)
    for (const s of subjects) {
      for (const o of store.getObjects(s, p.path, null)) if (o.termType === 'Literal' && (o as Literal).language) langs.add((o as Literal).language)
    }
  }
  const columns = ['iri']
  const cells: Array<(s: Term) => string> = [s => s.value]
  for (const p of properties) {
    const name = p.name.en ?? Object.values(p.name)[0] ?? localName(p.path.value)
    if (['langText', 'langTextarea'].includes(editorFor(p))) {
      for (const l of [...langs].sort()) {
        columns.push(`${name}@${l}`)
        cells.push(s => cell(store.getObjects(s as never, p.path, null).filter(o => (o as Literal).language === l)))
      }
    } else {
      columns.push(name)
      cells.push(s => cell(store.getObjects(s as never, p.path, null)))
    }
  }
  return { columns, rows: subjects.map(s => cells.map(f => f(s))) }
}

export function toCsv (table: Table): string {
  const escape = (v: string) => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  return [table.columns, ...table.rows].map(r => r.map(escape).join(',')).join('\r\n') + '\r\n'
}

/** A label for a resource from its own triples, for file names and listings. */
export function labelFromQuads (iri: string, quads: Quad[], languages: string[]): string {
  const store = new Store(quads)
  for (const p of [ns.dcterms('title'), ns.rdfs('label'), ns.skos('prefLabel'), ns.schema('name')]) {
    const picked = pickByLanguage(store.getObjects({ termType: 'NamedNode', value: iri } as never, p, null), languages)
    if (picked) return picked.value
  }
  return localName(iri)
}
