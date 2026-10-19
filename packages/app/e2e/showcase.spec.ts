import { expect, test } from '@playwright/test'

const EX = 'https://example.org/showcase/'
const resource = (cls: string, iri: string) => `/?demo=showcase#/resource/${encodeURIComponent(EX + cls)}/${encodeURIComponent(EX + iri)}`

// The feature tour runs in the browser like the other demos; these check that its showcase
// pieces render: the widgets, nested sections, a stored query and the deliberate problems.
test('is the default demo in Settings and lists every class', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.getByLabel('Demo dataset')).toHaveValue('showcase')
  await page.getByRole('button', { name: 'Start demo' }).click()
  const nav = page.getByRole('navigation', { name: 'Classes' })
  for (const name of ['Station', 'Line', 'Area', 'Track closure', 'Organisation', 'Person', 'Report', 'Query']) {
    await expect(nav.getByRole('link', { name: new RegExp(`^${name}\\s*\\d*$`) })).toBeVisible()
  }
})

test('draws a line on the map and shows nested sections', async ({ page }) => {
  await page.goto(resource('Line', 'line/l1'))
  await expect(page.getByRole('heading', { name: 'Spikkestad–Lillestrøm' })).toBeVisible()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.getByLabel('WKT')).toHaveValue(/^LINESTRING/)
  await expect(page.locator('input[value="l1-03"]')).toBeVisible()
})

test('shows a closure period and duration with the time widget', async ({ page }) => {
  await page.goto(resource('Closure', 'closure/finse-summer-2026'))
  await expect(page.getByRole('heading', { name: 'Finse track renewal' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Interval' })).toBeVisible()
  await expect(page.getByText('PT6H30M')).toBeVisible()
})

test('runs the stored query of a report', async ({ page }) => {
  await page.goto(resource('Report', 'report/platforms'))
  await page.getByRole('button', { name: 'Preview query result' }).click()
  await expect(page.getByRole('cell', { name: 'Oslo Central' })).toBeVisible()
})

test('reports the deliberate problems when checking all data', async ({ page }) => {
  await page.goto('/?demo=showcase#/validation')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByText('2 problems, 3 warnings')).toBeVisible()
  await expect(page.getByText('A station code is two to five capital letters.')).toBeVisible()
  await expect(page.getByText('Predicate is not allowed (closed shape)')).toBeVisible()
})

test('saves an edited station with its nested geometry', async ({ page }) => {
  await page.goto(resource('Station', 'station/finse'))
  await page.locator('input[value="2"]').fill('3')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Review')
  await page.getByRole('status').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')
  await expect(page.getByLabel('WKT')).toHaveValue('POINT (7.5032 60.6014)')
})

test('shows the SHACL shape behind the page', async ({ page }) => {
  await page.goto(resource('Station', 'station/oslo-s'))
  await page.getByText(/^SHACL shape \(\d+ shapes\)$/).click()
  await expect(page.locator('.shape-source pre')).toContainText('ex:StationShape')
  await expect(page.locator('.shape-source pre')).toContainText('sh:targetClass ex:Station')
})
