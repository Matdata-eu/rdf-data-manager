import { Store } from 'n3'
import {
  RDF_LANG_STRING, RDF_TYPE, XSD_STRING, blankNode, literal, localName, namedNode, ns, quad,
  type Literal, type Quad, type Term
} from '../rdf/terms'
import type { NodeShape, PropertyShape, ShapesModel } from '../shapes/model'
import { editorFor, isLangEditor } from './kinds'
import { isDetails, MAX_DETAILS_DEPTH } from '../shapes/model'

const XSD = 'http://www.w3.org/2001/XMLSchema#'

let nextId = 0
export function newId (): string {
  return `v${++nextId}`
}

export interface ValueState {
  id: string
  /** Lexical form or IRI being edited. */
  text: string
  lang?: string
  /** Term as loaded, or as chosen in a select. */
  term?: Term
  /** Nested node for dash:DetailsEditor / dash:DetailsViewer properties. */
  node?: NodeState
}

export interface NodeState {
  id: string
  /** Existing subject, or undefined for a node that is minted on save. */
  subject?: Term
  shape: NodeShape
  types: Term[]
  values: Record<string, ValueState[]>
  /** Read-only nodes are shown but never written. */
  readOnly: boolean
}

export function nestedShape (p: PropertyShape, model: ShapesModel): NodeShape | undefined {
  if (!isDetails(p) || !p.node) return undefined
  return model.nodeShapes.get(p.node)
}

/** Property shapes that are edited as nested nodes in this form. */
function nestedTypeFor (p: PropertyShape, shape?: NodeShape): string | undefined {
  return p.classes[0] ?? shape?.targetClasses[0]
}

function sortValues (values: ValueState[], p: PropertyShape, shape: NodeShape | undefined): ValueState[] {
  const by = p.orderBy ?? shape?.orderBy
  if (!by) return values
  const desc = p.orderDescending || (shape?.orderDescending ?? false)
  const keyOf = (v: ValueState) => v.node?.values[by]?.[0]?.text ?? ''
  const cmp = (a: ValueState, b: ValueState) => {
    const ka = keyOf(a)
    const kb = keyOf(b)
    const na = Number(ka)
    const nb = Number(kb)
    const r = ka !== '' && kb !== '' && Number.isFinite(na) && Number.isFinite(nb) ? na - nb : ka.localeCompare(kb)
    return desc ? -r : r
  }
  return [...values].sort(cmp)
}

/** Builds the editable state of a resource from its loaded triples. */
export function stateFromQuads (
  subject: Term, shape: NodeShape, quads: Quad[] | Store, model: ShapesModel, depth = 1, readOnly = false
): NodeState {
  const store = quads instanceof Store ? quads : new Store(quads)
  const values: Record<string, ValueState[]> = {}
  for (const p of shape.properties) {
    const objects = store.getObjects(subject as never, p.path, null)
    const nested = depth <= MAX_DETAILS_DEPTH ? nestedShape(p, model) : undefined
    const list: ValueState[] = objects.map(o => {
      if (nested && o.termType !== 'Literal') {
        return { id: newId(), text: o.value, term: o, node: stateFromQuads(o, nested, store, model, depth + 1, readOnly || p.readOnly || nested.readOnly) }
      }
      const lit = o.termType === 'Literal' ? o as Literal : undefined
      return { id: newId(), text: o.value, lang: lit?.language || undefined, term: o }
    })
    values[p.path.value] = sortValues(list, p, nested)
  }
  return {
    id: newId(),
    subject,
    shape,
    types: store.getObjects(subject as never, RDF_TYPE, null),
    values,
    readOnly: readOnly || shape.readOnly
  }
}

function today (): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultFor (p: PropertyShape): ValueState[] {
  if (!p.defaultValue) return []
  if (p.defaultValue.value === ns.rdm('today').value) return [{ id: newId(), text: today() }]
  return [{ id: newId(), text: p.defaultValue.value, term: p.defaultValue }]
}

/** Empty state for a new node, with defaults and one row per configured language. */
export function emptyState (shape: NodeShape, model: ShapesModel, type?: string, depth = 1): NodeState {
  const values: Record<string, ValueState[]> = {}
  for (const p of shape.properties) {
    if (p.readOnly) {
      values[p.path.value] = []
      continue
    }
    const defaults = defaultFor(p)
    if (defaults.length) {
      values[p.path.value] = defaults
      continue
    }
    const kind = editorFor(p)
    if (isLangEditor(kind)) {
      values[p.path.value] = (p.languages ?? p.languageIn ?? ['']).map(lang => ({ id: newId(), text: '', lang: lang || undefined }))
    } else if (kind === 'details') {
      const nested = nestedShape(p, model)
      values[p.path.value] = nested && (p.minCount ?? 0) > 0 && depth < MAX_DETAILS_DEPTH
        ? [{ id: newId(), text: '', node: emptyState(nested, model, nestedTypeFor(p, nested), depth + 1) }]
        : []
    } else {
      values[p.path.value] = (p.minCount ?? 0) > 0 ? [{ id: newId(), text: '' }] : []
    }
  }
  return {
    id: newId(),
    shape,
    types: type ? [namedNode(type)] : [],
    values,
    readOnly: false
  }
}

/**
 * Adds empty rows for configured languages that a property has no value for yet, so a
 * missing translation shows up as an empty field instead of being invisible.
 */
export function withLanguageSlots (state: NodeState): NodeState {
  const values: Record<string, ValueState[]> = {}
  for (const p of state.shape.properties) {
    let list = state.values[p.path.value] ?? []
    if (!state.readOnly && !p.readOnly && isLangEditor(editorFor(p)) && p.languages) {
      const present = new Set(list.map(v => v.lang ?? ''))
      const missing = p.languages.filter(l => !present.has(l))
      const order = p.languages
      const rank = (v: ValueState) => { const i = order.indexOf(v.lang ?? ''); return i < 0 ? order.length : i }
      list = [...list, ...missing.map(lang => ({ id: newId(), text: '', lang }))].sort((a, b) => rank(a) - rank(b))
    }
    values[p.path.value] = list.map(v => v.node ? { ...v, node: withLanguageSlots(v.node) } : v)
  }
  return { ...state, values }
}

export function newNestedValue (p: PropertyShape, model: ShapesModel): ValueState | undefined {
  const nested = nestedShape(p, model)
  if (!nested) return undefined
  return { id: newId(), text: '', node: withLanguageSlots(emptyState(nested, model, nestedTypeFor(p, nested), 2)) }
}

function literalFor (p: PropertyShape, v: ValueState): Term | undefined {
  const textValue = v.text
  if (textValue.trim() === '') return undefined
  const kind = editorFor(p)
  const original = v.term?.termType === 'Literal' ? v.term as Literal : undefined
  if (isLangEditor(kind)) return v.lang ? literal(textValue, v.lang) : literal(textValue)
  if (original && original.value === textValue && !original.language) return original
  switch (kind) {
    case 'date': return literal(textValue, namedNode(`${XSD}date`))
    case 'dateTime': return literal(textValue.length === 16 ? `${textValue}:00` : textValue, namedNode(`${XSD}dateTime`))
    case 'boolean': return literal(textValue, namedNode(`${XSD}boolean`))
  }
  if (p.datatype && p.datatype !== XSD_STRING && p.datatype !== RDF_LANG_STRING) return literal(textValue, namedNode(p.datatype))
  return literal(textValue)
}

function termFor (p: PropertyShape, v: ValueState): Term | undefined {
  const kind = editorFor(p)
  if (kind === 'instances' || kind === 'enum') return v.term && v.text !== '' ? v.term : undefined
  if (kind === 'uri') return v.text.trim() ? namedNode(v.text.trim()) : undefined
  if (kind === 'details') return v.term
  if (v.term && v.term.termType !== 'Literal' && v.text === v.term.value) return v.term
  return literalFor(p, v)
}

/** Decides the subjects of new nodes. Called once per save, before serialising. */
export function assignSubjects (root: NodeState, rootIri: string, taken: Set<string> = new Set()): NodeState {
  const rootLocal = root.shape.uriStart && rootIri.startsWith(root.shape.uriStart)
    ? rootIri.slice(root.shape.uriStart.length)
    : localName(rootIri)
  const assign = (node: NodeState): NodeState => {
    const values: Record<string, ValueState[]> = {}
    for (const [path, list] of Object.entries(node.values)) {
      values[path] = list.map(v => {
        if (!v.node) return v
        let child = assign(v.node)
        if (!child.subject) {
          let subject: Term = blankNode()
          if (child.shape.uriStart) {
            const fromProp = child.shape.localNameProperty ? child.values[child.shape.localNameProperty]?.[0]?.text.trim() : ''
            const base = `${child.shape.uriStart}${rootLocal}${fromProp ? `_${fromProp.replace(/[^A-Za-z0-9_-]/g, '_')}` : ''}`
            let i = 1
            let candidate = fromProp ? base : `${base}_${i}`
            while (taken.has(candidate)) candidate = `${base}_${++i}`
            taken.add(candidate)
            subject = namedNode(candidate)
          }
          child = { ...child, subject }
        }
        return { ...v, term: child.subject, node: child }
      })
    }
    return { ...node, values }
  }
  return { ...assign(root), subject: root.subject ?? namedNode(rootIri) }
}

/** Subjects of the node and all nested nodes. */
export function ownedSubjects (node: NodeState, out: Term[] = []): Term[] {
  if (node.subject) out.push(node.subject)
  for (const list of Object.values(node.values)) for (const v of list) if (v.node) ownedSubjects(v.node, out)
  return out
}

/** All IRIs the node refers to outside itself (for loading validation context). */
export function referencedIris (node: NodeState, out: Set<string> = new Set()): Set<string> {
  // Read-only nodes are never written, so what they refer to needs no checking.
  if (node.readOnly) return out
  for (const p of node.shape.properties) {
    for (const v of node.values[p.path.value] ?? []) {
      if (v.node) referencedIris(v.node, out)
      else if (v.term?.termType === 'NamedNode' && editorFor(p) !== 'details') out.add(v.term.value)
      else if (editorFor(p) === 'uri' && v.text.trim()) out.add(v.text.trim())
    }
  }
  return out
}

/**
 * The triples this form manages: types and the values of editable properties,
 * recursively for nested nodes. Read-only properties and properties outside the shape
 * are not included, so saving never touches them.
 */
export function managedQuads (node: NodeState, out: Quad[] = []): Quad[] {
  if (node.readOnly || !node.subject) return out
  const s = node.subject as Quad['subject']
  for (const t of node.types) out.push(quad(s, RDF_TYPE, t as Quad['object']))
  for (const p of node.shape.properties) {
    if (p.readOnly) continue
    for (const v of node.values[p.path.value] ?? []) {
      if (v.node) {
        if (!v.node.subject) continue
        out.push(quad(s, p.path, v.node.subject as Quad['object']))
        managedQuads(v.node, out)
        continue
      }
      const o = termFor(p, v)
      if (o) out.push(quad(s, p.path, o as Quad['object']))
    }
  }
  return out
}

/** Sets properties marked rdm:updateOnSave (e.g. a modified date) to today. */
export function touch (node: NodeState): NodeState {
  const values = { ...node.values }
  for (const p of node.shape.properties) {
    if (p.updateOnSave && !p.readOnly) values[p.path.value] = [{ id: newId(), text: today() }]
  }
  return { ...node, values }
}

export function isEmptyValue (v: ValueState): boolean {
  return !v.node && v.text.trim() === '' && !v.term
}
