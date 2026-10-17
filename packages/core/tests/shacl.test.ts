import { describe, expect, it } from 'vitest'
import { Parser } from 'n3'
import { parseShapes } from '../src/shapes/model'
import { editorFor } from '../src/form/kinds'
import { otherProperties } from '../src/data/other'

const EX = 'http://example.org/'
const shapes = parseShapes(`
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <${EX}> .

ex:ThingShape a sh:NodeShape ;
  sh:targetClass ex:Thing ;
  rdfs:label "Thing"@en ;
  sh:closed true ;
  sh:ignoredProperties ( rdfs:seeAlso ) ;
  sh:property [
    sh:path ex:when ;
    sh:or ( [ sh:datatype xsd:date ] [ sh:datatype xsd:dateTime ] )
  ] ;
  sh:property [
    sh:path ex:owner ;
    sh:xone ( [ sh:class ex:Person ] [ sh:class ex:Organisation ] )
  ] .

ex:ReferrerShape a sh:NodeShape ;
  sh:targetSubjectsOf ex:refersTo ;
  sh:property [ sh:path ex:refersTo ; sh:minCount 1 ] .
`)

describe('broader SHACL', () => {
  const shape = shapes.shapeForClass(`${EX}Thing`)!
  const prop = (local: string) => shape.properties.find(p => p.path.value === `${EX}${local}`)!

  it('merges sh:or datatypes into one field typed by the first branch', () => {
    expect(prop('when').datatype).toBe('http://www.w3.org/2001/XMLSchema#date')
    expect(prop('when').alternatives?.map(a => a.datatype)).toEqual([
      'http://www.w3.org/2001/XMLSchema#date', 'http://www.w3.org/2001/XMLSchema#dateTime'
    ])
    expect(editorFor(prop('when'))).toBe('date')
  })

  it('offers the classes of every sh:xone branch together', () => {
    expect(prop('owner').classes).toEqual([`${EX}Person`, `${EX}Organisation`])
    expect(editorFor(prop('owner'))).toBe('instances')
  })

  it('keeps sh:closed and sh:ignoredProperties on the shape', () => {
    expect(shape.closed).toBe(true)
    expect(shape.ignoredProperties).toEqual(['http://www.w3.org/2000/01/rdf-schema#seeAlso'])
  })

  it('lists the triples outside the shape and which ones a closed shape rejects', () => {
    const quads = new Parser().parse(`
      @prefix ex: <${EX}> . @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:a a ex:Thing ; ex:when "2026-01-01" ; ex:colour "red" ; rdfs:seeAlso ex:b .
      ex:b ex:colour "blue" .
    `)
    const other = otherProperties(quads, `${EX}a`, shape)
    expect(other.map(o => [o.predicate, o.object.value, o.violatesClosed])).toEqual([
      [`${EX}colour`, 'red', true],
      ['http://www.w3.org/2000/01/rdf-schema#seeAlso', `${EX}b`, false]
    ])
  })

  it('parses predicate targets without making them menu classes', () => {
    expect(shapes.nodeShapes.get(`${EX}ReferrerShape`)?.targetSubjectsOf).toEqual([`${EX}refersTo`])
    expect(shapes.classes.map(c => c.iri)).toEqual([`${EX}Thing`])
  })
})
