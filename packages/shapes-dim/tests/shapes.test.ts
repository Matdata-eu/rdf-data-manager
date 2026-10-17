import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ShapesValidator } from '@rdf-data-manager/core'
import { readText, readTurtle } from './helpers'

const SHAPES = 'shapes/dim-metadata.shapes.ttl'
const BND = 'https://data.banenor.no/data/'
const shapes = readTurtle(SHAPES)
const validator = new ShapesValidator(shapes)

describe('dim-metadata shapes', () => {
  it('are valid SHACL (checked against SHACL-SHACL)', async () => {
    const meta = new ShapesValidator(readTurtle('tests/vendor/shacl-shacl.ttl'))
    const report = await meta.validate(shapes)
    expect(report.issues).toEqual([])
  })

  it('accept the sample data without warnings', async () => {
    const report = await validator.validate(readTurtle('examples/dim-metadata.sample.ttl'))
    expect(report.issues).toEqual([])
  })

  const cases = readdirSync(new URL('./data/invalid/', import.meta.url)).filter(f => f.endsWith('.ttl')).sort()

  it.each(cases)('report %s', async file => {
    const path = `tests/data/invalid/${file}`
    const header = Object.fromEntries(
      readText(path).split('\n')
        .filter(line => line.startsWith('# expect-'))
        .map(line => line.slice(2).split(': ').map(s => s.trim()))
    )
    const report = await validator.validate(readTurtle(path))
    const match = report.issues.filter(i =>
      (i.sourceShape === BND + header['expect-shape'] || i.sourceConstraint === BND + header['expect-shape']) &&
      i.severity === header['expect-severity'])
    expect(match, JSON.stringify(report.issues, null, 2)).not.toHaveLength(0)
  })
})
