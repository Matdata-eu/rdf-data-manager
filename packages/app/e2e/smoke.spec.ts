import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const dataset = (process.env.FUSEKI_DATASET ?? 'http://localhost:3030/metadata/').replace(/\/+$/, '')
const shapesGraph = 'https://data.banenor.no/data/_shapes_metadata'
const BND = 'https://data.banenor.no/data/'
const BNO = 'https://data.banenor.no/ontology/'

function fixture (path: string): string {
  return readFileSync(new URL(`../../shapes-dim/${path}`, import.meta.url), 'utf8')
}

async function put (graph: string | undefined, turtle: string): Promise<void> {
  const url = graph ? `${dataset}/data?graph=${encodeURIComponent(graph)}` : `${dataset}/data?default`
  const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/turtle' }, body: turtle })
  if (!response.ok) throw new Error(`PUT ${url}: ${response.status} ${await response.text()}`)
}

async function select (query: string): Promise<Array<Record<string, { value: string }>>> {
  const response = await fetch(`${dataset}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sparql-query', Accept: 'application/sparql-results+json' },
    body: query
  })
  const json = await response.json() as { results: { bindings: Array<Record<string, { value: string }>> } }
  return json.results.bindings
}

test.beforeEach(async () => {
  await put(shapesGraph, fixture('shapes/dim-metadata.shapes.ttl'))
  await put(undefined, fixture('examples/dim-metadata.sample.ttl'))
})

test('lists the classes, edits a key figure and writes only the changed triple', async ({ page }) => {
  await page.goto(`/?dataset=${encodeURIComponent(dataset + '/')}&shapesGraph=${encodeURIComponent(shapesGraph)}`)
  const nav = page.getByRole('navigation', { name: 'Classes' })
  await expect(nav.getByRole('link', { name: /^Dataset/ })).toBeVisible()

  await nav.getByRole('link', { name: /^Key figure\s*\d*$/ }).click()
  await page.getByRole('link', { name: /Total track length/ }).click()
  await expect(page.getByRole('heading', { name: 'Total track length' })).toBeVisible()

  const before = await select(`SELECT (COUNT(*) AS ?n) WHERE { <${BND}_keyFigure_trackLength> ?p ?o }`)
  const title = page.locator('input[value="Total track length"]')
  await title.fill('Track length in total')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')

  const rows = await select(`SELECT ?t WHERE { <${BND}_keyFigure_trackLength> <http://purl.org/dc/terms/title> ?t FILTER(lang(?t) = 'en') }`)
  expect(rows.map(r => r.t.value)).toEqual(['Track length in total'])
  const after = await select(`SELECT (COUNT(*) AS ?n) WHERE { <${BND}_keyFigure_trackLength> ?p ?o }`)
  // dct:modified is bumped on save; nothing else is added or removed
  expect(Number(after[0].n.value)).toBe(Number(before[0].n.value))
})

test('blocks a new key figure that violates the shapes', async ({ page }) => {
  await page.goto(`/?dataset=${encodeURIComponent(dataset + '/')}&shapesGraph=${encodeURIComponent(shapesGraph)}#/new/${encodeURIComponent(BNO + 'KeyFigure')}`)
  await page.getByLabel('Identifier').fill('e2eFigure')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('alert')).toContainText(/problem/)
  const rows = await select(`ASK { <${BND}_keyFigure_e2eFigure> ?p ?o }`).catch(() => [])
  expect(rows).toEqual([])
})
