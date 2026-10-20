import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Parser, Store } from 'n3'
import { buildShapesModel, parseShapes } from '../src/shapes/model'
import { shapeIdsForClass, shapeSource } from '../src/shapes/source'
import type { Quad } from '../src/rdf/terms'
import { readTurtle } from './helpers'

const BNO = 'https://data.banenor.no/ontology/'
const EX = 'https://example.org/showcase/'
const dim = buildShapesModel(readTurtle('shapes-dim/shapes/dim-metadata.shapes.ttl'))
const showcase = parseShapes(readFileSync(new URL('../../../examples/showcase/shapes.ttl', import.meta.url), 'utf8'))

/** Triples reachable from the named subjects, following blank nodes: what the source should hold. */
function described (quads: Quad[], ids: string[]): number {
  const store = new Store(quads)
  const seen = new Set<string>()
  let count = 0
  const visit = (s: string, blank: boolean) => {
    if (seen.has(s)) return
    seen.add(s)
    for (const q of store.getQuads({ termType: blank ? 'BlankNode' : 'NamedNode', value: s } as never, null, null, null)) {
      count++
      if (q.object.termType === 'BlankNode') visit(q.object.value, true)
    }
  }
  for (const id of ids) visit(id, false)
  return count
}

describe('shape source', () => {
  it('writes the shapes of a class, with the property shapes they point to', () => {
    const ids = shapeIdsForClass(dim, `${BNO}KeyFigure`)
    expect(ids).toContain('https://data.banenor.no/data/_shape_KeyFigure')
    expect(ids).toContain('https://data.banenor.no/data/_shape_position')
    const parsed = new Parser().parse(shapeSource(dim, `${BNO}KeyFigure`))
    expect(new Set(parsed.filter(q => q.subject.termType === 'NamedNode').map(q => q.subject.value))).toEqual(new Set(ids))
    expect(parsed.length).toBe(described(dim.quads, ids))
  })

  it('writes inline property shapes and lists as nested Turtle', () => {
    const turtle = shapeSource(showcase, `${EX}Station`)
    expect(turtle).toContain('sh:property [\n')
    expect(turtle).toMatch(/\( .+ \)/)
    expect(turtle).not.toContain('_:')
    const ids = shapeIdsForClass(showcase, `${EX}Station`)
    expect(new Parser().parse(turtle).length).toBe(described(showcase.quads, ids))
  })

  it('is empty for a class no shape targets', () => {
    expect(shapeSource(dim, 'https://example.org/Nothing')).toBe('')
  })
})
