import { Store } from 'n3'
import { namedNode, quadKey, type Quad } from '../rdf/terms'
import type { NodeShape, ShapesModel } from '../shapes/model'
import type { ShapesValidator, Report } from '../validation/validate'
import type { Repository } from './repository'
import { buildUpdate, diffQuads, type Diff } from './update'
import {
  assignSubjects, managedQuads, ownedSubjects, referencedIris, stateFromQuads, touch,
  withLanguageSlots, type NodeState
} from '../form/state'

export interface LoadedResource {
  iri: string
  shape: NodeShape
  /** Every triple loaded for the resource and its nested nodes. */
  quads: Quad[]
  /** State as loaded (before language slots are added), the baseline for diffs. */
  initial: NodeState
  /** State to start editing from. */
  state: NodeState
}

export async function loadForEditing (repo: Repository, model: ShapesModel, shape: NodeShape, iri: string): Promise<LoadedResource> {
  const quads = await repo.loadResource(iri, shape, model)
  const initial = stateFromQuads(namedNode(iri), shape, new Store(quads), model)
  return { iri, shape, quads, initial, state: withLanguageSlots(initial) }
}

export interface PreparedSave {
  iri: string
  state: NodeState
  diff: Diff
  update: string
  report: Report
}

/**
 * Turns the edited state into a SPARQL Update and validates the result as it would be
 * stored: the loaded triples with the managed ones replaced, plus the neighbourhood of
 * every resource the form refers to.
 */
export async function prepareSave (
  repo: Repository,
  validator: ShapesValidator,
  args: { iri: string; current: NodeState; loaded?: LoadedResource }
): Promise<PreparedSave> {
  const { iri, loaded } = args
  const taken = new Set((loaded?.quads ?? []).map(q => q.subject.value))
  const before = loaded ? managedQuads(loaded.initial) : []
  // Only bump rdm:updateOnSave properties (e.g. a modified date) when something changed.
  const untouched = assignSubjects(args.current, iri, new Set(taken))
  const changed = diffQuads(before, managedQuads(untouched))
  const state = changed.deletes.length || changed.inserts.length
    ? assignSubjects(touch(args.current), iri, taken)
    : untouched
  const diff = diffQuads(before, managedQuads(state))

  const removed = new Set(diff.deletes.map(quadKey))
  const stored = [...(loaded?.quads ?? []).filter(q => !removed.has(quadKey(q))), ...diff.inserts]
  const owned = new Set(ownedSubjects(state).map(t => t.value))
  const context = (await repo.contextQuads([...referencedIris(state)].filter(i => !owned.has(i))))
    .filter(q => !owned.has(q.subject.value))
  const ownedBefore = new Set((loaded ? ownedSubjects(loaded.initial) : []).map(t => t.value))
  const report = await validator.validate([...stored, ...context.filter(q => !ownedBefore.has(q.subject.value))])
  const issues = report.issues.filter(i => owned.has(i.focusNode))

  return {
    iri,
    state,
    diff,
    update: buildUpdate(diff, repo.config.dataGraph || undefined),
    report: { conforms: !issues.some(i => i.severity === 'Violation'), issues }
  }
}

/** Removes the resource with all nested nodes that were loaded with it. */
export function buildDelete (repo: Repository, loaded: LoadedResource): string {
  return buildUpdate({ deletes: loaded.quads, inserts: [] }, repo.config.dataGraph || undefined)
}

export function ownedOf (loaded: LoadedResource): string[] {
  return ownedSubjects(loaded.initial).filter(t => t.termType === 'NamedNode').map(t => t.value)
}
