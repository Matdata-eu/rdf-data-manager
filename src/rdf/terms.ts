import { DataFactory } from 'n3'
import type * as RDF from '@rdfjs/types'

export const { namedNode, literal, blankNode, quad, defaultGraph, variable } = DataFactory

export type Term = RDF.Term
export type Quad = RDF.Quad
export type NamedNode = RDF.NamedNode
export type Literal = RDF.Literal
export type BlankNode = RDF.BlankNode
export type Subject = RDF.Quad_Subject

function namespace (base: string) {
  return (local: string): NamedNode => namedNode(base + local)
}

export const ns = {
  rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
  rdfs: namespace('http://www.w3.org/2000/01/rdf-schema#'),
  xsd: namespace('http://www.w3.org/2001/XMLSchema#'),
  sh: namespace('http://www.w3.org/ns/shacl#'),
  dash: namespace('http://datashapes.org/dash#'),
  rdm: namespace('https://matdata.eu/ns/rdf-data-manager#'),
  dcterms: namespace('http://purl.org/dc/terms/'),
  skos: namespace('http://www.w3.org/2004/02/skos/core#'),
  schema: namespace('http://schema.org/'),
  owl: namespace('http://www.w3.org/2002/07/owl#')
}

export const RDF_TYPE = ns.rdf('type')
export const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
export const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string'

/** Properties tried, in order, to find a human-readable label for a resource. */
export const LABEL_PROPERTIES = [
  ns.dcterms('title').value,
  ns.rdfs('label').value,
  ns.skos('prefLabel').value,
  ns.schema('name').value
]

function escapeString (value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/** Serialises a term in N-Triples / SPARQL syntax. */
export function toNT (term: Term): string {
  switch (term.termType) {
    case 'NamedNode':
      return `<${term.value}>`
    case 'BlankNode':
      return `_:${term.value}`
    case 'Variable':
      return `?${term.value}`
    case 'Literal': {
      const lexical = `"${escapeString(term.value)}"`
      if (term.language) return `${lexical}@${term.language}`
      if (term.datatype && term.datatype.value !== XSD_STRING) return `${lexical}^^<${term.datatype.value}>`
      return lexical
    }
    case 'DefaultGraph':
      return ''
    default:
      throw new Error(`Cannot serialise term type ${(term as Term).termType}`)
  }
}

export function quadKey (q: Quad): string {
  return `${toNT(q.subject)} ${toNT(q.predicate)} ${toNT(q.object)}`
}

export function termKey (term: Term): string {
  return toNT(term)
}

/** Picks the literal that best matches the preferred languages. */
export function pickByLanguage (literals: Term[], preferred: string[]): Term | undefined {
  const lits = literals.filter(t => t.termType === 'Literal') as Literal[]
  for (const lang of preferred) {
    const hit = lits.find(l => l.language === lang)
    if (hit) return hit
  }
  return lits.find(l => !l.language) ?? lits[0] ?? literals[0]
}

/** Short, readable form of an IRI: the part after the last '#' or '/'. */
export function localName (iri: string): string {
  const m = /[^#/]*$/.exec(iri)
  return m && m[0] ? m[0] : iri
}

export function preferredLanguages (language: string): string[] {
  const list = [language]
  if (language === 'nb' || language === 'nn') list.push('no')
  if (!list.includes('en')) list.push('en')
  return list
}
