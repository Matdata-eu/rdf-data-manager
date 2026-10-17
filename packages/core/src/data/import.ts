import { Parser, Store } from 'n3'
import { RDF_TYPE, quadKey, type Quad } from '../rdf/terms'
import type { ShapesModel } from '../shapes/model'
import type { Repository } from './repository'
import type { Issue, ShapesValidator } from '../validation/validate'
import { ownedSubjects, referencedIris, stateFromQuads } from '../form/state'
import { buildUpdate } from './update'

export interface ImportSubject {
  iri: string
  classIri: string
  /** True when the endpoint already has triples about this IRI. */
  exists: boolean
}

export interface ParsedImport {
  quads: Quad[]
  /** Subjects typed as a class the shapes manage. */
  subjects: ImportSubject[]
  /** Triples whose subject is neither a managed instance nor a node owned by one. */
  unmanaged: number
}

/** Parses Turtle (or N-Triples) and finds the managed instances in it. */
export async function parseImport (turtle: string, model: ShapesModel, repo: Repository): Promise<ParsedImport> {
  const quads = new Parser().parse(turtle)
  const store = new Store(quads)
  const managed = new Set(model.classes.map(c => c.iri))
  const subjects: ImportSubject[] = []
  const owned = new Set<string>()
  for (const q of quads) {
    if (!q.predicate.equals(RDF_TYPE) || q.subject.termType !== 'NamedNode' || !managed.has(q.object.value)) continue
    if (subjects.some(s => s.iri === q.subject.value)) continue
    const shape = model.shapeForClass(q.object.value)!
    for (const s of ownedSubjects(stateFromQuads(q.subject, shape, store, model))) owned.add(s.value)
    subjects.push({ iri: q.subject.value, classIri: q.object.value, exists: false })
  }
  const exists = await Promise.all(subjects.map(s => repo.exists(s.iri)))
  subjects.forEach((s, i) => { s.exists = exists[i] })
  return { quads, subjects, unmanaged: quads.filter(q => !owned.has(q.subject.value)).length }
}

export interface ImportCheck {
  conforms: boolean
  /** Issues keyed by the managed instance they belong to. */
  issues: Map<string, Issue[]>
}

/** Validates the parsed data as it would be stored, with context from the endpoint. */
export async function checkImport (parsed: ParsedImport, model: ShapesModel, repo: Repository, validator: ShapesValidator): Promise<ImportCheck> {
  const store = new Store(parsed.quads)
  const owner = new Map<string, string>()
  const referenced = new Set<string>()
  for (const s of parsed.subjects) {
    const state = stateFromQuads({ termType: 'NamedNode', value: s.iri } as never, model.shapeForClass(s.classIri)!, store, model)
    for (const o of ownedSubjects(state)) owner.set(o.value, s.iri)
    for (const r of referencedIris(state)) referenced.add(r)
  }
  const context = (await repo.contextQuads([...referenced].filter(i => !owner.has(i)))).filter(q => !owner.has(q.subject.value))
  const report = await validator.validate([...parsed.quads, ...context])
  const issues = new Map<string, Issue[]>()
  for (const i of report.issues) {
    const instance = owner.get(i.focusNode)
    if (!instance) continue
    issues.set(instance, [...(issues.get(instance) ?? []), i])
  }
  const conforms = ![...issues.values()].flat().some(i => i.severity === 'Violation')
  return { conforms, issues }
}

/**
 * Writes the import. Existing instances are replaced: their current tree (as the shapes
 * see it) is deleted first, so a re-import of an exported file is an exact update.
 */
export async function writeImport (parsed: ParsedImport, model: ShapesModel, repo: Repository): Promise<void> {
  const graph = repo.config.dataGraph || undefined
  for (const s of parsed.subjects.filter(x => x.exists)) {
    const current = await repo.loadResource(s.iri, model.shapeForClass(s.classIri)!, model)
    if (current.length) await repo.update(buildUpdate({ deletes: current, inserts: [] }, graph))
  }
  const seen = new Set<string>()
  await repo.insert(parsed.quads.filter(q => !seen.has(quadKey(q)) && seen.add(quadKey(q))))
}
