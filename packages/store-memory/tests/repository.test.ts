import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  Repository, ShapesValidator, buildShapesModel, checkImport, declaredPrefixes, loadTranslations, parseImport, saveTranslations,
  toCsv, toTable, toTurtle, translatableProperties, validateClass, writeImport, describeChanges, diffQuads, managedQuads,
  loadForEditing, applyTranslations, cellKey, prepareSave, withText
} from '@rdf-data-manager/core'
import { Parser } from 'n3'
import { MemoryClient, initMemoryStore } from '../src'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(join(here, '../../shapes-dim', p), 'utf8')
const BND = 'https://data.banenor.no/data/'
const BNO = 'https://data.banenor.no/ontology/'
const DCT = 'http://purl.org/dc/terms/'
const SHAPES_GRAPH = 'https://data.banenor.no/data/_shapes_metadata'

function setup () {
  const client = new MemoryClient()
  client.loadTurtle(read('shapes/dim-metadata.shapes.ttl'), SHAPES_GRAPH)
  client.loadTurtle(read('examples/dim-metadata.sample.ttl'))
  const repo = new Repository({ queryUrl: 'memory:', updateUrl: 'memory:', dataGraph: '', shapes: { source: 'endpoint', graph: SHAPES_GRAPH } }, client)
  const model = buildShapesModel(new Parser().parse(read('shapes/dim-metadata.shapes.ttl')))
  const validator = new ShapesValidator(model.quads)
  return { client, repo, model, validator }
}

beforeAll(() => initMemoryStore())

describe('Repository on the memory store', () => {
  it('loads the shapes from a graph and counts instances', async () => {
    const { repo, model } = setup()
    const loaded = await repo.loadShapes()
    expect(loaded.classes.map(c => c.iri)).toEqual(model.classes.map(c => c.iri))
    const counts = await repo.countInstances(model.classes.map(c => c.iri))
    expect(counts.get(`${BNO}KeyFigure`)).toBeGreaterThan(0)
  })

  it('searches across classes by label and IRI', async () => {
    const { repo, model } = setup()
    const hits = await repo.search(model.classes.map(c => c.iri), 'track')
    expect(hits.map(h => h.iri)).toContain(`${BND}_keyFigure_trackLength`)
    expect(hits.find(h => h.iri === `${BND}_keyFigure_trackLength`)?.classIri).toBe(`${BNO}KeyFigure`)
    expect(await repo.search(model.classes.map(c => c.iri), 'no such thing anywhere')).toEqual([])
  })

  it('lists what refers to a resource', async () => {
    const { repo } = setup()
    const refs = await repo.references(`${BND}_ws_keyFigures_mq_keyFigure_trackLength`, [])
    expect(refs.some(r => r.subject === `${BND}_keyFigure_trackLength` && r.predicate === `${BNO}usesManagedQuery`)).toBe(true)
    expect(refs.find(r => r.subject === `${BND}_keyFigure_trackLength`)?.classes).toContain(`${BNO}KeyFigure`)
  })

  it('reads query texts by path and previews a query', async () => {
    const { repo, model } = setup()
    const texts = await repo.texts(`${BND}_ws_keyFigures_mq_keyFigure_trackLength`, '^dcterms:isVersionOf/spin:text', declaredPrefixes(model))
    expect(texts).toHaveLength(1)
    expect(texts[0]).toContain('SELECT')
    const preview = await repo.preview(`SELECT ?s WHERE { ?s a <${BNO}KeyFigure> }`, 1)
    expect(preview.columns).toEqual(['s'])
    expect(preview.rows).toHaveLength(1)
  })
})

describe('validation overview', () => {
  it('reports the sample data as conforming and finds a planted problem', async () => {
    const { client, repo, model, validator } = setup()
    const before = await validateClass(repo, validator, model, `${BNO}KeyFigure`)
    expect(before.instances).toBeGreaterThan(0)
    expect(before.issues.filter(i => i.severity === 'Violation')).toEqual([])
    await client.update(`DELETE WHERE { <${BND}_keyFigure_trackLength> <${DCT}title> ?t }`)
    const after = await validateClass(repo, validator, model, `${BNO}KeyFigure`)
    const mine = after.issues.filter(i => i.instance === `${BND}_keyFigure_trackLength`)
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every(i => i.path === `${DCT}title`)).toBe(true)
  })
})

describe('export and import', () => {
  it('exports a class as Turtle with the declared prefixes and as a CSV table', async () => {
    const { repo, model } = setup()
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    const quads = await repo.loadClassData(`${BNO}KeyFigure`, shape, model)
    const prefixes = declaredPrefixes(model)
    expect(prefixes.bno).toBe(BNO)
    const turtle = toTurtle(quads, prefixes)
    expect(turtle).toContain('@prefix bno:')
    expect(turtle).toContain('bno:KeyFigure')
    const table = toTable(`${BNO}KeyFigure`, shape, quads, ['en'])
    expect(table.columns[0]).toBe('iri')
    expect(table.columns).toContain('Title@en')
    const row = table.rows.find(r => r[0] === `${BND}_keyFigure_trackLength`)!
    expect(row[table.columns.indexOf('Title@en')]).toBe('Total track length')
    expect(toCsv(table).split('\r\n')[0]).toContain('iri,')
  })

  it('round-trips an export through import, replacing the existing instance', async () => {
    const { client, repo, model, validator } = setup()
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    const quads = await repo.loadResource(`${BND}_keyFigure_trackLength`, shape, model)
    const turtle = toTurtle(quads, declaredPrefixes(model)).replace('"Total track length"@en', '"Track length, total"@en')
    const parsed = await parseImport(turtle, model, repo)
    expect(parsed.subjects).toEqual([{ iri: `${BND}_keyFigure_trackLength`, classIri: `${BNO}KeyFigure`, exists: true }])
    const check = await checkImport(parsed, model, repo, validator)
    expect(check.conforms).toBe(true)
    const sizeBefore = client.size
    await writeImport(parsed, model, repo)
    expect(client.size).toBe(sizeBefore)
    const titles = await client.select(`SELECT ?t WHERE { <${BND}_keyFigure_trackLength> <${DCT}title> ?t FILTER(lang(?t) = 'en') }`)
    expect(titles.map(r => r.t.value)).toEqual(['Track length, total'])
  })

  it('rejects an import that violates the shapes', async () => {
    const { repo, model, validator } = setup()
    const parsed = await parseImport(`<${BND}_keyFigure_new> a <${BNO}KeyFigure> .`, model, repo)
    expect(parsed.subjects[0].exists).toBe(false)
    const check = await checkImport(parsed, model, repo, validator)
    expect(check.conforms).toBe(false)
    expect(check.issues.get(`${BND}_keyFigure_new`)?.length).toBeGreaterThan(0)
  })
})

describe('translations', () => {
  it('loads a grid and saves edited cells through the shapes', async () => {
    const { client, repo, model, validator } = setup()
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    const properties = translatableProperties(shape)
    expect(properties.map(p => p.path.value)).toContain(`${DCT}title`)
    const rows = await loadTranslations(repo, `${BNO}KeyFigure`, properties, ['en'])
    const row = rows.find(r => r.iri === `${BND}_keyFigure_trackLength`)!
    expect(row.texts[cellKey(`${DCT}title`, 'en')]).toBe('Total track length')
    const results = await saveTranslations(repo, validator, model, `${BNO}KeyFigure`, new Map([[row.iri, { [cellKey(`${DCT}title`, 'nn')]: 'Total sporlengd' }]]))
    expect(results[0].error).toBeUndefined()
    const nn = await client.select(`SELECT ?t WHERE { <${BND}_keyFigure_trackLength> <${DCT}title> ?t FILTER(lang(?t) = 'nn') }`)
    expect(nn.map(r => r.t.value)).toEqual(['Total sporlengd'])
    // clearing a required language is refused
    const refused = await saveTranslations(repo, validator, model, `${BNO}KeyFigure`, new Map([[row.iri, { [cellKey(`${DCT}title`, 'en')]: '' }]]))
    expect(refused[0].error).toBeTruthy()
  })

  it('describes a change in the words of the shapes', async () => {
    const { repo, model } = setup()
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    const loaded = await loadForEditing(repo, model, shape, `${BND}_keyFigure_trackLength`)
    const edited = applyTranslations(loaded.state, { [cellKey(`${DCT}title`, 'en')]: 'Track length' })
    const changes = describeChanges(diffQuads(managedQuads(loaded.initial), managedQuads(edited)), loaded.iri, shape, model, ['en'])
    expect(changes).toHaveLength(1)
    expect(changes[0].propertyLabel).toBe('Title')
    expect(changes[0].removed).toEqual(['Total track length@en'])
    expect(changes[0].added).toEqual(['Track length@en'])
  })
})

describe('memory store', () => {
  it('keeps derived datatypes that Oxigraph would replace with their base type', async () => {
    const XSD = 'http://www.w3.org/2001/XMLSchema#'
    const client = new MemoryClient()
    client.loadTurtle(`<https://example.org/a> <https://example.org/at> "2026-03-06T22:00:00+01:00"^^<${XSD}dateTimeStamp> .`)
    await client.update(`INSERT DATA { <https://example.org/a> <https://example.org/n> "5"^^<${XSD}int> }`)
    const rows = await client.select(`SELECT ?o WHERE { <https://example.org/a> ?p ?o FILTER(?o = "5"^^<${XSD}int> || isLiteral(?o)) } ORDER BY ?o`)
    expect(rows.map(r => (r.o as { datatype: { value: string } }).datatype.value).sort()).toEqual([`${XSD}dateTimeStamp`, `${XSD}int`])
    expect(await client.ask(`ASK { ?s ?p "5"^^<${XSD}int> }`)).toBe(true)
    expect(client.dump().map(q => (q.object as { datatype: { value: string } }).datatype.value).sort()).toEqual([`${XSD}dateTimeStamp`, `${XSD}int`])
  })

  it('saves an edited geo-time event without problems on its xsd:dateTimeStamp instants', async () => {
    const geo = (p: string) => readFileSync(join(here, '../../../examples/geo-time', p), 'utf8')
    const client = new MemoryClient()
    client.loadTurtle(geo('data.ttl'))
    const repo = new Repository({ queryUrl: 'memory:', updateUrl: 'memory:', dataGraph: '', shapes: { source: 'inline', turtle: geo('shapes.ttl'), name: 'geo-time.ttl' } }, client)
    const model = buildShapesModel(new Parser().parse(geo('shapes.ttl')))
    const shape = model.shapeForClass('https://example.org/geo-time/Event')!
    const iri = 'https://example.org/geo-time/event/maintenance-window'
    const loaded = await loadForEditing(repo, model, shape, iri)
    const current = withText(loaded.state, 'https://example.org/geo-time/duration', 'PT10H')
    const prepared = await prepareSave(repo, new ShapesValidator(model.quads), { iri, current, loaded })
    expect(prepared.diff.inserts).toHaveLength(1)
    expect(prepared.report.issues).toEqual([])
  })
})
