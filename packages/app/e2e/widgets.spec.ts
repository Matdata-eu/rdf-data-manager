import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const dataset = (process.env.FUSEKI_DATASET ?? 'http://localhost:3030/metadata/').replace(/\/+$/, '')
const shapesGraph = 'https://example.org/geo-time/shapes'
const EX = 'https://example.org/geo-time/'

function fixture (path: string): string {
  return readFileSync(new URL(`../../../examples/geo-time/${path}`, import.meta.url), 'utf8')
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
  await put(shapesGraph, fixture('shapes.ttl'))
  await put(undefined, fixture('data.ttl'))
})

const base = `/?dataset=${encodeURIComponent(dataset + '/')}&shapesGraph=${encodeURIComponent(shapesGraph)}&widgets=map,time`

test('the map widget edits a geometry node and saves the WKT', async ({ page }) => {
  await page.goto(`${base}#/resource/${encodeURIComponent(EX + 'Place')}/${encodeURIComponent(EX + 'place/oslo-s')}`)
  await expect(page.getByRole('heading', { name: 'Oslo S' })).toBeVisible()
  const wkt = page.getByLabel('WKT')
  await expect(wkt).toHaveValue('POINT (10.7522 59.9108)')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await wkt.fill('POINT (10.75 59.91)')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')
  const rows = await select(`SELECT ?w WHERE { <${EX}geometry/oslo-s> <http://www.opengis.net/ont/geosparql#asWKT> ?w }`)
  expect(rows.map(r => r.w.value)).toEqual(['POINT (10.75 59.91)'])
})

test('the time widget edits an interval and a duration', async ({ page }) => {
  await page.goto(`${base}#/resource/${encodeURIComponent(EX + 'Event')}/${encodeURIComponent(EX + 'event/maintenance-window')}`)
  await expect(page.getByRole('heading', { name: 'Maintenance window' })).toBeVisible()
  const interval = page.getByRole('group', { name: 'Interval' })
  await expect(interval.locator('input[type="datetime-local"]').first()).toHaveValue('2026-03-06T22:00')
  await interval.locator('input[type="datetime-local"]').nth(1).fill('2026-03-07T05:00')
  const duration = page.getByRole('group', { name: 'Duration' })
  await duration.locator('input[type="number"]').nth(3).fill('7')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')
  const rows = await select(`SELECT ?d ?end WHERE {
    <${EX}event/maintenance-window> <${EX}duration> ?d ;
      <http://www.w3.org/2006/time#hasTime> / <http://www.w3.org/2006/time#hasEnd> / <http://www.w3.org/2006/time#inXSDDateTimeStamp> ?end }`)
  expect(rows.map(r => [r.d.value, r.end.value])).toEqual([['PT7H', '2026-03-07T05:00:00+01:00']])
})
