import { Store } from 'n3'
import { RDF_TYPE, type Quad } from '../rdf/terms'
import type { ShapesModel } from '../shapes/model'
import type { Repository } from '../data/repository'
import { ownedSubjects, referencedIris, stateFromQuads } from '../form/state'
import type { Issue, ShapesValidator } from './validate'

export interface InstanceIssue extends Issue {
  /** The instance the issue belongs to: the focus node itself, or the root of a nested node. */
  instance: string
}

export interface ClassReport {
  classIri: string
  instances: number
  issues: InstanceIssue[]
}

/**
 * Validates every instance of a class as stored, with the same context the form uses
 * when saving: the instances' own trees plus the neighbourhood of what they refer to.
 * Issues on nested nodes are attributed to their root instance.
 */
export async function validateClass (repo: Repository, validator: ShapesValidator, model: ShapesModel, classIri: string): Promise<ClassReport> {
  const shape = model.shapeForClass(classIri)
  if (!shape) return { classIri, instances: 0, issues: [] }
  const quads = await repo.loadClassData(classIri, shape, model)
  const store = new Store(quads)
  const instances = store.getSubjects(RDF_TYPE, model.classes.find(c => c.iri === classIri) ? { termType: 'NamedNode', value: classIri } as never : null, null)
    .filter(s => s.termType === 'NamedNode' && store.countQuads(s, RDF_TYPE, { termType: 'NamedNode', value: classIri } as never, null) > 0)
    .map(s => s.value)

  // Which node belongs to which instance, and what the instances refer to.
  const owner = new Map<string, string>()
  const referenced = new Set<string>()
  for (const iri of instances) {
    const state = stateFromQuads({ termType: 'NamedNode', value: iri } as never, shape, store, model)
    for (const s of ownedSubjects(state)) owner.set(s.value, iri)
    for (const r of referencedIris(state)) referenced.add(r)
  }
  const owned = new Set(owner.keys())
  const context = (await repo.contextQuads([...referenced].filter(i => !owned.has(i))))
    .filter(q => !owned.has(q.subject.value))
  const report = await validator.validate([...quads, ...context])
  const issues = report.issues
    .filter(i => owner.has(i.focusNode))
    .map(i => ({ ...i, instance: owner.get(i.focusNode)! }))
  return { classIri, instances: instances.length, issues }
}

export function countBySeverity (issues: Issue[]): Record<'Violation' | 'Warning' | 'Info', number> {
  const out = { Violation: 0, Warning: 0, Info: 0 }
  for (const i of issues) out[i.severity]++
  return out
}

export type { Quad }
