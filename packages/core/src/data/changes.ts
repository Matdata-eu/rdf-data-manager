import { RDF_TYPE, localName, type Literal, type Quad, type Term } from '../rdf/terms'
import { text, type LangMap, type NodeShape, type ShapesModel } from '../shapes/model'
import type { Diff } from './update'

export interface Change {
  /** The node the change is on: the resource, or a nested node named by its parent path. */
  subject: string
  subjectLabel: string
  property: string
  propertyLabel: string
  removed: string[]
  added: string[]
}

function show (t: Term): string {
  if (t.termType === 'Literal') {
    const lit = t as Literal
    const tag = lit.language ? `@${lit.language}` : ''
    return `${lit.value}${tag}`
  }
  if (t.termType === 'BlankNode') return '(nested node)'
  return t.value
}

function propertyName (shape: NodeShape | undefined, predicate: string, languages: string[]): string {
  if (predicate === RDF_TYPE.value) return 'type'
  const p = shape?.properties.find(x => x.path.value === predicate)
  return (p && text(p.name as LangMap, languages)) || localName(predicate)
}

/**
 * The diff grouped by subject and property, in the words of the shapes, so a person can
 * read what a save will do without reading SPARQL.
 */
export function describeChanges (diff: Diff, root: string, shape: NodeShape, model: ShapesModel, languages: string[]): Change[] {
  // Which shape describes each subject: the root's, or the nested shape of the property that links the node.
  const shapes = new Map<string, NodeShape>([[root, shape]])
  const names = new Map<string, string>([[root, localName(root)]])
  const link = (quads: Quad[]) => {
    let grew = true
    while (grew) {
      grew = false
      for (const q of quads) {
        const parent = shapes.get(q.subject.value)
        if (!parent || shapes.has(q.object.value) || q.object.termType === 'Literal') continue
        const p = parent.properties.find(x => x.path.value === q.predicate.value)
        const nested = p?.node ? model.nodeShapes.get(p.node) : undefined
        if (!nested) continue
        shapes.set(q.object.value, nested)
        names.set(q.object.value, `${names.get(q.subject.value)} › ${propertyName(parent, q.predicate.value, languages)}`)
        grew = true
      }
    }
  }
  link(diff.deletes)
  link(diff.inserts)

  const out = new Map<string, Change>()
  const add = (q: Quad, side: 'removed' | 'added') => {
    const key = `${q.subject.value} ${q.predicate.value}`
    const change = out.get(key) ?? {
      subject: q.subject.value,
      subjectLabel: names.get(q.subject.value) ?? (q.subject.termType === 'BlankNode' ? '(nested node)' : localName(q.subject.value)),
      property: q.predicate.value,
      propertyLabel: propertyName(shapes.get(q.subject.value), q.predicate.value, languages),
      removed: [],
      added: []
    }
    change[side].push(show(q.object))
    out.set(key, change)
  }
  for (const q of diff.deletes) add(q, 'removed')
  for (const q of diff.inserts) add(q, 'added')
  return [...out.values()]
}
