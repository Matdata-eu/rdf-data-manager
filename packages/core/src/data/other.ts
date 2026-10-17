import { RDF_TYPE, type Quad, type Term } from '../rdf/terms'
import type { NodeShape } from '../shapes/model'

/** A triple of a resource that no property shape manages. The form leaves such triples alone. */
export interface OtherProperty {
  predicate: string
  object: Term
  /** True when a closed shape does not allow this predicate, so a check reports it. */
  violatesClosed: boolean
}

/**
 * The triples of `iri` outside the shape: not rdf:type and not a property shape's path.
 * They come from the quads a resource was loaded with, which carry every triple of the root.
 */
export function otherProperties (quads: Quad[], iri: string, shape: NodeShape): OtherProperty[] {
  const managed = new Set(shape.properties.map(p => p.path.value))
  const ignored = new Set(shape.ignoredProperties)
  return quads
    .filter(q => q.subject.value === iri && q.predicate.value !== RDF_TYPE.value && !managed.has(q.predicate.value))
    .map(q => ({ predicate: q.predicate.value, object: q.object, violatesClosed: shape.closed && !ignored.has(q.predicate.value) }))
}
