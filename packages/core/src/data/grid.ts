import { Store } from 'n3'
import { LABEL_PROPERTIES, RDF_TYPE, namedNode, pickByLanguage, type Quad, type Term } from '../rdf/terms'
import { editorFor, isLangEditor, type EditorKind } from '../form/kinds'
import { newId, stateFromQuads, type NodeState } from '../form/state'
import { isDetails, type NodeShape, type PropertyShape, type ShapesModel } from '../shapes/model'
import type { Repository } from './repository'
import { loadForEditing, prepareSave, type PreparedSave } from './editing'
import type { ShapesValidator } from '../validation/validate'

/** Editor kinds a grid cell can edit in place. */
const CELL_KINDS: EditorKind[] = ['text', 'textarea', 'date', 'dateTime', 'boolean', 'enum', 'instances', 'uri']

export interface GridColumn {
  property: PropertyShape
  kind: EditorKind
  /** Single-valued properties of a kind a cell can edit, on a shape the user may write. */
  editable: boolean
}

/**
 * A column per top-level property shown in the form. Nested nodes are left out (they
 * have their own forms); language-tagged texts are shown but edited on the
 * translations page, and multi-valued properties only in the form.
 */
export function gridColumns (shape: NodeShape): GridColumn[] {
  return shape.properties
    .filter(p => !p.hidden && !isDetails(p))
    .map(p => {
      const kind = editorFor(p)
      return { property: p, kind, editable: !shape.readOnly && !p.readOnly && p.maxCount === 1 && CELL_KINDS.includes(kind) }
    })
}

export interface GridRow {
  iri: string
  label: string
  state: NodeState
}

/** The values of the grid's columns for every instance of a class, as form states. */
export async function loadGrid (
  repo: Repository, model: ShapesModel, classIri: string, shape: NodeShape, columns: GridColumn[], languages: string[]
): Promise<GridRow[]> {
  const predicates = [...new Set([RDF_TYPE.value, ...LABEL_PROPERTIES, ...columns.map(c => c.property.path.value)])]
  const quads: Quad[] = await repo.client.construct(`
    CONSTRUCT { ?s ?p ?o }
    WHERE { ${repo.g(`?s a <${classIri}> . ?s ?p ?o . FILTER (?p IN (${predicates.map(p => `<${p}>`).join(', ')}))`)} }`)
  const store = new Store(quads)
  const subjects = store.getSubjects(RDF_TYPE, namedNode(classIri) as never, null).filter(s => s.termType === 'NamedNode')
  return subjects.map(s => {
    const labels = LABEL_PROPERTIES.flatMap(p => store.getObjects(s, namedNode(p) as never, null))
    return { iri: s.value, label: pickByLanguage(labels, languages)?.value ?? s.value, state: stateFromQuads(s, shape, store, model) }
  }).sort((a, b) => a.label.localeCompare(b.label))
}

/** The value an editable cell shows: the text (or IRI) of the first value. */
export function cellValue (state: NodeState, property: PropertyShape): string {
  return state.values[property.path.value]?.[0]?.text ?? ''
}

/** The values of a cell as terms, for showing read-only cells. */
export function cellTerms (state: NodeState, property: PropertyShape): Term[] {
  return (state.values[property.path.value] ?? []).flatMap(v => v.term ? [v.term] : [])
}

/** Applies edited cells (property path → text or IRI) to a loaded node state. */
export function applyCells (state: NodeState, cells: Record<string, string>): NodeState {
  const values = { ...state.values }
  for (const [path, text] of Object.entries(cells)) {
    const p = state.shape.properties.find(x => x.path.value === path)
    if (!p) continue
    const kind = editorFor(p)
    if (text.trim() === '') {
      values[path] = []
      continue
    }
    const current = values[path]?.[0]
    if (kind === 'enum') {
      const term = p.in?.find(t => t.value === text)
      values[path] = term ? [{ id: newId(), text, term }] : []
    } else if (kind === 'instances') {
      values[path] = [{ id: newId(), text, term: namedNode(text) }]
    } else if (isLangEditor(kind)) {
      continue
    } else {
      // Keep the loaded term so an unchanged literal keeps its datatype.
      values[path] = [{ ...(current ?? { id: newId() }), text }]
    }
  }
  return { ...state, values }
}

export interface GridSaveResult {
  iri: string
  prepared?: PreparedSave
  error?: string
}

/**
 * Saves edited cells resource by resource through the ordinary save path, so the shapes
 * are checked and rdm:updateOnSave properties are bumped. A cell whose stored value has
 * changed since the grid was loaded is not overwritten; rows that do not conform are
 * reported and left unchanged.
 */
export async function saveGrid (
  repo: Repository, validator: ShapesValidator, model: ShapesModel, classIri: string,
  edits: Map<string, Record<string, string>>, loadedRows: Map<string, NodeState>
): Promise<GridSaveResult[]> {
  const shape = model.shapeForClass(classIri)
  if (!shape) return []
  const out: GridSaveResult[] = []
  for (const [iri, cells] of edits) {
    try {
      const loaded = await loadForEditing(repo, model, shape, iri)
      const before = loadedRows.get(iri)
      const stale = before && Object.keys(cells).some(path => {
        const p = shape.properties.find(x => x.path.value === path)
        return p && cellValue(loaded.initial, p) !== cellValue(before, p)
      })
      if (stale) {
        out.push({ iri, error: 'Changed by someone else since the table was loaded. Reload the table to see the current values.' })
        continue
      }
      const prepared = await prepareSave(repo, validator, { iri, current: applyCells(loaded.state, cells), loaded })
      if (!prepared.report.conforms) {
        out.push({ iri, prepared, error: prepared.report.issues.filter(i => i.severity === 'Violation').map(i => i.message).join(' ') })
        continue
      }
      if (prepared.diff.inserts.length || prepared.diff.deletes.length) await repo.update(prepared.update)
      out.push({ iri, prepared })
    } catch (e) {
      out.push({ iri, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return out
}
