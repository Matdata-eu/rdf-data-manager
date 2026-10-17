import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const dataset = (process.env.FUSEKI_DATASET ?? 'http://localhost:3030/metadata/').replace(/\/+$/, '')
const shapesGraph = 'https://data.banenor.no/data/_shapes_metadata'
const BND = 'https://data.banenor.no/data/'
const BNO = 'https://data.banenor.no/ontology/'
const DCT = 'http://purl.org/dc/terms/'

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

async function update (text: string): Promise<void> {
  const response = await fetch(`${dataset}/update`, { method: 'POST', headers: { 'Content-Type': 'application/sparql-update' }, body: text })
  if (!response.ok) throw new Error(`update: ${response.status} ${await response.text()}`)
}

test.beforeEach(async () => {
  await put(shapesGraph, fixture('shapes/dim-metadata.shapes.ttl'))
  await put(undefined, fixture('examples/dim-metadata.sample.ttl'))
})

const base = `/?dataset=${encodeURIComponent(dataset + '/')}&shapesGraph=${encodeURIComponent(shapesGraph)}`

test('checks all data and lists a planted problem with a link to the resource', async ({ page }) => {
  await page.goto(`${base}#/validation`)
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('status')).toContainText('Everything conforms')

  await update(`DELETE WHERE { <${BND}_keyFigure_trackLength> <${DCT}title> ?t }`)
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page.getByRole('status')).toContainText(/[1-9]\d* problem/)
  const card = page.locator('.issue-card').filter({ hasText: 'title' })
  await expect(card.first()).toBeVisible()
  await card.first().getByRole('link').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('_keyFigure_trackLength')
})

test('searches across classes from the top bar', async ({ page }) => {
  await page.goto(`${base}#/`)
  await page.getByRole('searchbox', { name: 'Search' }).fill('switch')
  await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Number of switches/ })).toBeVisible()
})

test('edits translations in the grid and saves them through the shapes', async ({ page }) => {
  await page.goto(`${base}#/translations/${encodeURIComponent(BNO + 'KeyFigure')}`)
  const cell = page.getByLabel(/^Total track length Title nn$/)
  await expect(cell).toHaveValue('Total sporlengd')
  await cell.fill('Samla sporlengd')
  await page.getByRole('button', { name: /Save 1 change/ }).click()
  await expect(page.getByRole('status')).toContainText('Saved 1 resource')
  const rows = await select(`SELECT ?t WHERE { <${BND}_keyFigure_trackLength> <${DCT}title> ?t FILTER(lang(?t) = 'nn') }`)
  expect(rows.map(r => r.t.value)).toEqual(['Samla sporlengd'])
})

test('imports Turtle after checking it against the shapes', async ({ page }) => {
  const turtle = `@prefix bno: <${BNO}> .
@prefix dcterms: <${DCT}> .
@prefix bnd: <${BND}> .
bnd:_keyFigure_e2eImported a bno:KeyFigure ;
  dcterms:title "Imported figure"@en, "Importert nøkkeltall"@nb, "Importert nøkkeltal"@nn ;
  dcterms:description "From the import page"@en, "Fra importsiden"@nb, "Frå importsida"@nn ;
  dcterms:isPartOf bnd:_keyFiguresSection_infrastructure ;
  bno:usesManagedQuery bnd:_ws_keyFigures_mq_keyFigure_switchCount .`
  await page.goto(`${base}#/import`)
  await page.getByLabel('Turtle').fill(turtle)
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('status')).toContainText('1 resource found')
  const importButton = page.getByRole('button', { name: /^Import( anyway)?$/ })
  await expect(importButton).toBeVisible()
  await importButton.click()
  await expect(page.getByRole('status')).toContainText('Imported 1 resource')
  const rows = await select(`SELECT ?t WHERE { <${BND}_keyFigure_e2eImported> <${DCT}title> ?t FILTER(lang(?t) = 'en') }`)
  expect(rows.map(r => r.t.value)).toEqual(['Imported figure'])
})

test('previews a managed query and lists what uses a resource', async ({ page }) => {
  await page.goto(`${base}#/resource/${encodeURIComponent(BNO + 'KeyFigure')}/${encodeURIComponent(BND + '_keyFigure_trackLength')}`)
  await page.getByRole('button', { name: 'Preview query result' }).click()
  await expect(page.locator('.query-result')).toContainText(/row|No rows/)

  await page.goto(`${base}#/resource/${encodeURIComponent(BNO + 'KeyFigureSection')}/${encodeURIComponent(BND + '_keyFiguresSection_infrastructure')}`)
  const usedBy = page.locator('.used-by')
  await expect(usedBy).toContainText(/Used by \d+ resource/)
  await usedBy.locator('summary').click()
  await expect(usedBy.getByRole('link', { name: /Number of switches/ })).toBeVisible()
})
