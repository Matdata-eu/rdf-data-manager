import { Parser, Store } from 'n3'
import {
  ns, RDF_TYPE, type Literal, type NamedNode, type Quad, type Term, localName, pickByLanguage
} from '../rdf/terms'

const sh = ns.sh
const dash = ns.dash
const rdm = ns.rdm

export const DASH_DETAILS_EDITOR = 'http://datashapes.org/dash#DetailsEditor'
export const DASH_DETAILS_VIEWER = 'http://datashapes.org/dash#DetailsViewer'

/** Nested nodes are loaded and edited together with their parent up to this depth. */
export const MAX_DETAILS_DEPTH = 3

/** Language-tagged texts keyed by language tag ('' for plain literals). */
export type LangMap = Record<string, string>

export interface PropertyGroup {
  id: string
  label: LangMap
  order: number
}

export interface PropertyShape {
  id: Term
  key: string
  /** Simple predicate path. Shapes with complex paths are kept for validation only. */
  path: NamedNode
  name: LangMap
  description: LangMap
  group?: string
  order: number
  datatype?: string
  nodeKind?: string
  classes: string[]
  node?: string
  minCount?: number
  maxCount?: number
  languageIn?: string[]
  uniqueLang: boolean
  in?: Term[]
  pattern?: string
  flags?: string
  minInclusive?: number
  maxInclusive?: number
  editor?: string
  viewer?: string
  readOnly: boolean
  hidden: boolean
  singleLine?: boolean
  languages?: string[]
  defaultValue?: Term
  updateOnSave: boolean
  /** rdm:collapsed; when unset, fields with many values start collapsed. */
  collapsed?: boolean
  /** rdm:pageSize: values shown before "Show more". */
  pageSize?: number
  orderBy?: string
  orderDescending: boolean
}

/** True when values of this property are nested nodes edited or shown in place. */
export function isDetails (p: PropertyShape): boolean {
  if (p.editor === DASH_DETAILS_EDITOR || p.viewer === DASH_DETAILS_VIEWER) return true
  return !p.editor && !p.viewer && Boolean(p.node) && (p.nodeKind?.endsWith('#BlankNode') ?? false)
}

export interface NodeShape {
  id: string
  targetClasses: string[]
  label: LangMap
  comment: LangMap
  order: number
  uriStart?: string
  localNamePattern?: string
  localNameDescription: LangMap
  localNameProperty?: string
  hideFromMenu: boolean
  readOnly: boolean
  orderBy?: string
  orderDescending: boolean
  properties: PropertyShape[]
}

export interface ClassEntry {
  iri: string
  label: LangMap
  comment: LangMap
  order: number
  shape: NodeShape
}

export interface ShapesModel {
  quads: Quad[]
  groups: Map<string, PropertyGroup>
  nodeShapes: Map<string, NodeShape>
  /** Menu entries: target classes of labelled node shapes, merged per class. */
  classes: ClassEntry[]
  /** Merged node shape for instances of a class, or undefined when no shape targets it. */
  shapeForClass (classIri: string): NodeShape | undefined
}

function one (store: Store, s: Term, p: NamedNode): Term | undefined {
  return store.getObjects(s as never, p, null)[0]
}

function all (store: Store, s: Term, p: NamedNode): Term[] {
  return store.getObjects(s as never, p, null)
}

function num (t?: Term): number | undefined {
  if (!t) return undefined
  const n = Number(t.value)
  return Number.isFinite(n) ? n : undefined
}

function bool (t?: Term): boolean {
  return t?.value === 'true' || t?.value === '1'
}

function langMap (terms: Term[]): LangMap {
  const out: LangMap = {}
  for (const t of terms) {
    if (t.termType === 'Literal') out[(t as Literal).language ?? ''] = t.value
  }
  return out
}

function list (store: Store, head?: Term): Term[] {
  const out: Term[] = []
  let node = head
  const nil = ns.rdf('nil').value
  let guard = 0
  while (node && node.value !== nil && guard++ < 10000) {
    const first = one(store, node, ns.rdf('first'))
    if (first) out.push(first)
    node = one(store, node, ns.rdf('rest'))
  }
  return out
}

export function text (map: LangMap, preferred: string[], fallback = ''): string {
  for (const lang of preferred) if (map[lang]) return map[lang]
  return map[''] ?? Object.values(map)[0] ?? fallback
}

function parsePropertyShape (store: Store, id: Term): PropertyShape | undefined {
  const path = one(store, id, sh('path'))
  if (!path || path.termType !== 'NamedNode') return undefined
  const lit = (p: NamedNode) => one(store, id, p)?.value
  const languages = one(store, id, rdm('languages'))
  const languageIn = one(store, id, sh('languageIn'))
  const inList = one(store, id, sh('in'))
  return {
    id,
    key: id.termType === 'BlankNode' ? `${path.value}#${id.value}` : id.value,
    path: path as NamedNode,
    name: langMap(all(store, id, sh('name'))),
    description: langMap(all(store, id, sh('description'))),
    group: lit(sh('group')),
    order: num(one(store, id, sh('order'))) ?? 1000,
    datatype: lit(sh('datatype')),
    nodeKind: lit(sh('nodeKind')),
    classes: all(store, id, sh('class')).map(t => t.value),
    node: lit(sh('node')),
    minCount: num(one(store, id, sh('minCount'))),
    maxCount: num(one(store, id, sh('maxCount'))),
    languageIn: languageIn ? list(store, languageIn).map(t => t.value) : undefined,
    uniqueLang: bool(one(store, id, sh('uniqueLang'))),
    in: inList ? list(store, inList) : undefined,
    pattern: lit(sh('pattern')),
    flags: lit(sh('flags')),
    minInclusive: num(one(store, id, sh('minInclusive'))),
    maxInclusive: num(one(store, id, sh('maxInclusive'))),
    editor: lit(dash('editor')),
    viewer: lit(dash('viewer')),
    readOnly: bool(one(store, id, dash('readOnly'))),
    hidden: bool(one(store, id, dash('hidden'))),
    singleLine: one(store, id, dash('singleLine')) ? bool(one(store, id, dash('singleLine'))) : undefined,
    languages: languages ? list(store, languages).map(t => t.value) : undefined,
    defaultValue: one(store, id, rdm('defaultValue')) ?? one(store, id, sh('defaultValue')),
    updateOnSave: bool(one(store, id, rdm('updateOnSave'))),
    collapsed: one(store, id, rdm('collapsed')) ? bool(one(store, id, rdm('collapsed'))) : undefined,
    pageSize: num(one(store, id, rdm('pageSize'))),
    orderBy: lit(rdm('orderBy')),
    orderDescending: bool(one(store, id, rdm('orderDescending')))
  }
}

function parseNodeShape (store: Store, id: Term, seen = new Set<string>()): NodeShape {
  seen.add(id.value)
  const properties: PropertyShape[] = []
  for (const p of all(store, id, sh('property'))) {
    const parsed = parsePropertyShape(store, p)
    if (parsed) properties.push(parsed)
  }
  // Node-level sh:node acts as inheritance for form purposes.
  for (const parent of all(store, id, sh('node'))) {
    if (seen.has(parent.value)) continue
    properties.push(...parseNodeShape(store, parent, seen).properties)
  }
  const readOnly = bool(one(store, id, dash('readOnly')))
  return {
    id: id.value,
    targetClasses: all(store, id, sh('targetClass')).map(t => t.value),
    label: langMap(all(store, id, ns.rdfs('label'))),
    comment: langMap(all(store, id, ns.rdfs('comment'))),
    order: num(one(store, id, rdm('order'))) ?? 1000,
    uriStart: one(store, id, dash('uriStart'))?.value,
    localNamePattern: one(store, id, rdm('localNamePattern'))?.value,
    localNameDescription: langMap(all(store, id, rdm('localNameDescription'))),
    localNameProperty: one(store, id, rdm('localNameProperty'))?.value,
    hideFromMenu: bool(one(store, id, rdm('hideFromMenu'))),
    readOnly,
    orderBy: one(store, id, rdm('orderBy'))?.value,
    orderDescending: bool(one(store, id, rdm('orderDescending'))),
    properties: readOnly ? properties.map(p => ({ ...p, readOnly: true })) : properties
  }
}

/**
 * Collapses property shapes that share a path into one form field. The shape with an
 * explicit editor (or else the first one) decides the widget; the others still take
 * part in validation, which always runs against the full shapes graph.
 */
function dedupeByPath (properties: PropertyShape[]): PropertyShape[] {
  const byPath = new Map<string, PropertyShape>()
  for (const p of properties) {
    const existing = byPath.get(p.path.value)
    if (!existing || (!existing.editor && p.editor)) {
      byPath.set(p.path.value, existing ? { ...p, readOnly: p.readOnly && existing.readOnly } : p)
    }
  }
  return [...byPath.values()].sort((a, b) => a.order - b.order)
}

function mergeShapes (shapes: NodeShape[]): NodeShape {
  const first = shapes.find(s => Object.keys(s.label).length > 0) ?? shapes[0]
  const pick = <K extends keyof NodeShape>(k: K) => shapes.find(s => s[k] !== undefined && s[k] !== '')?.[k]
  return {
    ...first,
    uriStart: pick('uriStart') as string | undefined,
    localNamePattern: pick('localNamePattern') as string | undefined,
    localNameProperty: pick('localNameProperty') as string | undefined,
    orderBy: pick('orderBy') as string | undefined,
    order: Math.min(...shapes.map(s => s.order)),
    hideFromMenu: shapes.some(s => s.hideFromMenu),
    readOnly: shapes.every(s => s.readOnly),
    properties: dedupeByPath(shapes.flatMap(s => s.properties))
  }
}

export function buildShapesModel (quads: Quad[]): ShapesModel {
  const store = new Store(quads)

  const groups = new Map<string, PropertyGroup>()
  for (const g of store.getSubjects(RDF_TYPE, sh('PropertyGroup'), null)) {
    groups.set(g.value, {
      id: g.value,
      label: langMap(all(store, g, ns.rdfs('label'))),
      order: num(one(store, g, sh('order'))) ?? 1000
    })
  }

  // Node shapes: explicitly typed, or anything with sh:targetClass / sh:property.
  const ids = new Map<string, Term>()
  for (const s of store.getSubjects(RDF_TYPE, sh('NodeShape'), null)) ids.set(s.value, s)
  for (const s of store.getSubjects(sh('targetClass'), null, null)) ids.set(s.value, s)
  for (const s of store.getSubjects(sh('property'), null, null)) ids.set(s.value, s)

  const nodeShapes = new Map<string, NodeShape>()
  for (const [key, term] of ids) {
    if (term.termType !== 'NamedNode') continue
    nodeShapes.set(key, parseNodeShape(store, term))
  }

  const byClass = new Map<string, NodeShape[]>()
  for (const shape of nodeShapes.values()) {
    for (const cls of shape.targetClasses) {
      if (!byClass.has(cls)) byClass.set(cls, [])
      byClass.get(cls)!.push(shape)
    }
  }
  const merged = new Map<string, NodeShape>()
  for (const [cls, shapes] of byClass) merged.set(cls, mergeShapes(shapes))

  const classes: ClassEntry[] = []
  for (const [cls, shapes] of byClass) {
    if (!shapes.some(s => Object.keys(s.label).length > 0)) continue
    const shape = merged.get(cls)!
    if (shape.hideFromMenu) continue
    const labelled = shapes.find(s => Object.keys(s.label).length > 0)!
    classes.push({ iri: cls, label: labelled.label, comment: labelled.comment, order: shape.order, shape })
  }
  classes.sort((a, b) => a.order - b.order || localName(a.iri).localeCompare(localName(b.iri)))

  return {
    quads,
    groups,
    nodeShapes,
    classes,
    shapeForClass: (cls: string) => merged.get(cls)
  }
}

export function parseShapes (turtle: string, baseIRI?: string): ShapesModel {
  return buildShapesModel(new Parser({ baseIRI }).parse(turtle))
}

/** Label for a shape-related LangMap with an IRI fallback. */
export function labelOf (map: LangMap, iri: string, preferred: string[]): string {
  return text(map, preferred, localName(iri))
}

export { pickByLanguage }
