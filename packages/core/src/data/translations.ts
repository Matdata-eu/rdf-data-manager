import { LABEL_PROPERTIES, pickByLanguage, type Literal, type Term } from '../rdf/terms'
import { isLangEditor, editorFor } from '../form/kinds'
import { newId, type NodeState } from '../form/state'
import type { NodeShape, PropertyShape, ShapesModel } from '../shapes/model'
import type { Repository } from './repository'
import { loadForEditing, prepareSave, type PreparedSave } from './editing'
import type { ShapesValidator } from '../validation/validate'

/** Top-level properties edited as language-tagged text. */
export function translatableProperties (shape: NodeShape): PropertyShape[] {
  return shape.properties.filter(p => !p.hidden && !p.readOnly && isLangEditor(editorFor(p)))
}

export interface TranslationRow {
  iri: string
  label: string
  /** Texts keyed by `${path} ${lang}`. */
  texts: Record<string, string>
}

export function cellKey (path: string, lang: string): string {
  return `${path} ${lang}`
}

/** The current texts of the translatable properties of every instance of a class. */
export async function loadTranslations (repo: Repository, classIri: string, properties: PropertyShape[], languages: string[]): Promise<TranslationRow[]> {
  if (properties.length === 0) return []
  const rows = await repo.client.select(`
    SELECT ?s ?p ?o
    WHERE { ${repo.g(`?s a <${classIri}> . ?s ?p ?o . FILTER (?p IN (${[...properties.map(p => `<${p.path.value}>`), ...LABEL_PROPERTIES.map(p => `<${p}>`)].join(', ')}))`)} }`)
  const byIri = new Map<string, { labels: Term[]; texts: Record<string, string> }>()
  const paths = new Set(properties.map(p => p.path.value))
  for (const row of rows) {
    if (row.s.termType !== 'NamedNode' || row.o.termType !== 'Literal') continue
    const entry = byIri.get(row.s.value) ?? { labels: [], texts: {} }
    if (LABEL_PROPERTIES.includes(row.p.value)) entry.labels.push(row.o)
    const lang = (row.o as Literal).language
    if (paths.has(row.p.value) && lang) entry.texts[cellKey(row.p.value, lang)] = row.o.value
    byIri.set(row.s.value, entry)
  }
  return [...byIri].map(([iri, e]) => ({ iri, label: pickByLanguage(e.labels, languages)?.value ?? iri, texts: e.texts }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Applies edited cells (`${path} ${lang}` → text) to a loaded node state. */
export function applyTranslations (state: NodeState, edits: Record<string, string>): NodeState {
  const values = { ...state.values }
  for (const [key, text] of Object.entries(edits)) {
    const at = key.lastIndexOf(' ')
    const path = key.slice(0, at)
    const lang = key.slice(at + 1)
    const current = (values[path] ?? []).filter(v => v.lang !== lang)
    values[path] = text.trim() ? [...current, { id: newId(), text, lang }] : current
  }
  return { ...state, values }
}

export interface TranslationSaveResult {
  iri: string
  prepared?: PreparedSave
  error?: string
}

/**
 * Saves edited cells resource by resource through the ordinary save path, so the
 * shapes are checked and rdm:updateOnSave properties are bumped. Rows that do not
 * conform are reported and left unchanged.
 */
export async function saveTranslations (
  repo: Repository, validator: ShapesValidator, model: ShapesModel, classIri: string,
  edits: Map<string, Record<string, string>>
): Promise<TranslationSaveResult[]> {
  const shape = model.shapeForClass(classIri)
  if (!shape) return []
  const out: TranslationSaveResult[] = []
  for (const [iri, cells] of edits) {
    try {
      const loaded = await loadForEditing(repo, model, shape, iri)
      const prepared = await prepareSave(repo, validator, { iri, current: applyTranslations(loaded.state, cells), loaded })
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
