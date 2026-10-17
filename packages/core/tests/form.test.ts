import { Store } from 'n3'
import { describe, expect, it } from 'vitest'
import { buildShapesModel } from '../src/shapes/model'
import { editorFor, viewerFor } from '../src/form/kinds'
import {
  assignSubjects, emptyState, managedQuads, newNestedValue, stateFromQuads, touch, withLanguageSlots,
  type NodeState
} from '../src/form/state'
import { buildUpdate, diffQuads } from '../src/data/update'
import { blankNode, isValidIri, literal, namedNode, quad, quadKey } from '../src/rdf/terms'
import { readTurtle } from './helpers'

const BND = 'https://data.banenor.no/data/'
const BNO = 'https://data.banenor.no/ontology/'
const DCT = 'http://purl.org/dc/terms/'
const CSVW = 'http://www.w3.org/ns/csvw#'
const SCHEMA = 'http://schema.org/'
const model = buildShapesModel(readTurtle('shapes-dim/shapes/dim-metadata.shapes.ttl'))
const sample = new Store(readTurtle('shapes-dim/examples/dim-metadata.sample.ttl'))

function load (iri: string, cls: string): NodeState {
  return stateFromQuads(namedNode(iri), model.shapeForClass(cls)!, sample, model)
}

function setText (state: NodeState, path: string, match: (lang?: string) => boolean, text: string): NodeState {
  return {
    ...state,
    values: {
      ...state.values,
      [path]: state.values[path].map(v => match(v.lang) ? { ...v, text } : v)
    }
  }
}

describe('shapes model', () => {
  it('lists the menu classes in order and hides nested ones', () => {
    expect(model.classes.map(c => c.iri)).toEqual([
      'http://www.w3.org/ns/dcat#Dataset',
      `${BNO}KeyFigure`,
      `${BNO}KeyFigureTable`,
      `${BNO}KeyFigureSection`
    ])
  })

  it('merges node shapes that target the same class', () => {
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    expect(shape.uriStart).toBe(`${BND}_keyFigure_`)
    expect(shape.properties.map(p => p.path.value)).toContain(`${DCT}title`)
    expect(shape.properties.find(p => p.path.value === `${DCT}title`)!.languages).toEqual(['en', 'nb', 'nn'])
  })

  it('chooses editors from DASH hints and constraints', () => {
    const table = model.shapeForClass(`${BNO}KeyFigureTable`)!
    const byPath = (path: string) => table.properties.find(p => p.path.value === path)!
    expect(editorFor(byPath(`${DCT}title`))).toBe('langText')
    expect(editorFor(byPath(`${DCT}description`))).toBe('langTextarea')
    expect(editorFor(byPath(`${CSVW}tableSchema`))).toBe('details')
    expect(editorFor(byPath(`${BNO}usesManagedQuery`))).toBe('instances')
    expect(viewerFor(byPath('http://www.w3.org/ns/dcat#distribution'))).toBe('details')
  })
})

describe('form state', () => {
  it('round-trips loaded data without changes', () => {
    const state = load(`${BND}_keyFigureTable_switchesByType`, `${BNO}KeyFigureTable`)
    const managed = managedQuads(state)
    expect(diffQuads(managed, managedQuads(withLanguageSlots(state)))).toEqual({ deletes: [], inserts: [] })
    // nested schema and columns are managed, distributions (read-only) are not
    const keys = managed.map(quadKey)
    expect(keys.some(k => k.includes('_keyFigureTable_col_switchesByType_type'))).toBe(true)
    expect(keys.some(k => k.includes('_dist_'))).toBe(false)
  })

  it('turns an edited translation into one delete and one insert', () => {
    const state = load(`${BND}_keyFigure_trackLength`, `${BNO}KeyFigure`)
    const edited = setText(state, `${DCT}title`, lang => lang === 'nn', 'Samla sporlengd')
    const diff = diffQuads(managedQuads(state), managedQuads(edited))
    expect(diff.deletes.map(q => q.object.value)).toEqual(['Total sporlengd'])
    expect(diff.inserts.map(q => q.object)).toEqual([literal('Samla sporlengd', 'nn')])
    const update = buildUpdate(diff)
    expect(update).toContain('DELETE DATA')
    expect(update).toContain('"Samla sporlengd"@nn')
  })

  it('mints IRIs for new nested nodes from dash:uriStart and rdm:localNameProperty', () => {
    const shape = model.shapeForClass(`${BNO}KeyFigureTable`)!
    let state = withLanguageSlots(emptyState(shape, model, `${BNO}KeyFigureTable`))
    const schemaProp = shape.properties.find(p => p.path.value === `${CSVW}tableSchema`)!
    const schema = newNestedValue(schemaProp, model)!
    const columnProp = schema.node!.shape.properties.find(p => p.path.value === `${CSVW}column`)!
    const column = newNestedValue(columnProp, model)!
    column.node!.values[`${CSVW}name`] = [{ id: 'n', text: 'type' }]
    column.node!.values[`${SCHEMA}position`] = [{ id: 'p', text: '1' }]
    schema.node!.values[`${CSVW}column`] = [column]
    state = { ...state, values: { ...state.values, [`${CSVW}tableSchema`]: [schema] } }

    const assigned = assignSubjects(state, `${BND}_keyFigureTable_newTable`)
    const keys = managedQuads(assigned).map(quadKey)
    expect(keys).toContain(`<${BND}_keyFigureTable_newTable> <${CSVW}tableSchema> <${BND}_keyFigureTable_schema_newTable_1>`)
    expect(keys).toContain(`<${BND}_keyFigureTable_schema_newTable_1> <${CSVW}column> <${BND}_keyFigureTable_col_newTable_type>`)
    expect(keys).toContain(`<${BND}_keyFigureTable_col_newTable_type> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${CSVW}Column>`)
    expect(keys).toContain(`<${BND}_keyFigureTable_col_newTable_type> <${SCHEMA}position> "1"^^<http://www.w3.org/2001/XMLSchema#integer>`)
  })

  it('pre-fills defaults and updates the modified date on save', () => {
    const shape = model.shapeForClass('http://www.w3.org/ns/dcat#Dataset')!
    const state = emptyState(shape, model, 'http://www.w3.org/ns/dcat#Dataset')
    const today = new Date().toISOString().slice(0, 10)
    expect(state.values[`${DCT}modified`][0].text).toBe(today)
    expect(state.values[`${DCT}title`].map(v => v.lang)).toEqual(['en', 'nb', 'nn'])

    const loaded = load(`${BND}_dataset_signals`, 'http://www.w3.org/ns/dcat#Dataset')
    expect(touch(loaded).values[`${DCT}modified`][0].text).toBe(today)
  })
})

describe('update builder', () => {
  it('deletes blank-node triples with a pattern and wraps a data graph', () => {
    const b = blankNode('x1')
    const diff = {
      deletes: [quad(namedNode('urn:a'), namedNode('urn:p'), b), quad(b, namedNode('urn:q'), literal('v'))],
      inserts: [quad(namedNode('urn:a'), namedNode('urn:p'), literal('w', 'en'))]
    }
    const update = buildUpdate(diff, 'urn:g')
    expect(update).toContain('DELETE {\nGRAPH <urn:g> {\n  <urn:a> <urn:p> ?b_x1 .')
    expect(update).toContain('INSERT DATA {\nGRAPH <urn:g> {\n  <urn:a> <urn:p> "w"@en .')
  })
})

describe('isValidIri', () => {
  it('accepts absolute IRIs and rejects what cannot be written as <iri>', () => {
    expect(isValidIri('https://data.banenor.no/data/_keyFigure_x')).toBe(true)
    expect(isValidIri('urn:uuid:123')).toBe(true)
    expect(isValidIri('_keyFigure_x')).toBe(false)
    expect(isValidIri('https://example.org/a b')).toBe(false)
    expect(isValidIri('https://example.org/a>')).toBe(false)
    expect(isValidIri('https://example.org/a"')).toBe(false)
  })
})
