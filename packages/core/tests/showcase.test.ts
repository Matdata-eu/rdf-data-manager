import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Parser } from 'n3'
import { ShapesValidator } from '../src/validation/validate'
import { parseShapes } from '../src/shapes/model'
import { editorFor } from '../src/form/kinds'
import { readTurtle } from './helpers'

// The feature tour behind ?demo=showcase: its data breaks the shapes in exactly the ways
// examples/showcase/README.md describes, so the validation report has one of each.
const read = (file: string) => readFileSync(new URL(`../../../examples/showcase/${file}`, import.meta.url), 'utf8')
const shapesText = read('shapes.ttl')
const shapes = new Parser().parse(shapesText)
const data = new Parser().parse(read('data.ttl'))
const EX = 'https://example.org/showcase/'

describe('showcase example', () => {
  it('has valid SHACL shapes (checked against SHACL-SHACL)', async () => {
    const meta = new ShapesValidator(readTurtle('shapes-dim/tests/vendor/shacl-shacl.ttl'))
    expect((await meta.validate(shapes)).issues).toEqual([])
  })

  it('reports only the problems the data has on purpose', async () => {
    const report = await new ShapesValidator(shapes).validate(data)
    const found = report.issues.map(i => [i.severity, i.focusNode.replace(EX, ''), i.path?.replace(EX, '')]).sort()
    expect(found).toEqual([
      ['Violation', 'org/vy', 'legacyId'],
      ['Violation', 'station/skoyen', 'code'],
      ['Warning', 'station/brakeroya', 'status'],
      ['Warning', 'station/bryn', 'platforms'],
      ['Warning', 'station/drammen', 'http://www.w3.org/2000/01/rdf-schema#label']
    ].sort())
  })

  it('lists its classes in menu order and keeps nested sections out of the menu', () => {
    const model = parseShapes(shapesText)
    expect(model.classes.map(c => c.iri.replace(EX, '').replace('http://schema.org/', 'schema:'))).toEqual([
      'Station', 'Line', 'Switch', 'Area', 'Closure', 'schema:Organization', 'schema:Person', 'Report', 'Query'
    ])
  })

  it('gives each station field the editor it is meant to show', () => {
    const station = parseShapes(shapesText).shapeForClass(`${EX}Station`)!
    const editors = Object.fromEntries(station.properties.map(p => [p.path.value.replace(EX, '').split(/[#/]/).pop(), editorFor(p)]))
    expect(editors).toMatchObject({
      label: 'langText',
      comment: 'langTextarea',
      code: 'text',
      category: 'enum',
      status: 'enum',
      opened: 'date',
      homepage: 'uri',
      platforms: 'text',
      stepFree: 'boolean',
      replacedBy: 'instances',
      hasGeometry: 'details',
      hasDesignator: 'details'
    })
  })
})
