import { expect, test } from '@playwright/test'

// The demo needs no Fuseki: the data lives in an Oxigraph store running in the page.
test('runs the DIM demo in the browser and saves an edit there', async ({ page }) => {
  await page.goto('/?demo=dim')
  await expect(page.getByText('Demo: changes stay in this tab')).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Classes' })
  await nav.getByRole('link', { name: /^Key figure\s*\d*$/ }).click()
  await page.getByRole('link', { name: /Total track length/ }).click()
  await page.locator('input[value="Total track length"]').fill('Track length in total')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Review')
  await page.getByRole('status').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')
  await expect(page.getByRole('heading', { name: 'Track length in total' })).toBeVisible()
})

test('starts the places demo from Settings with the map widget', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Demo dataset').selectOption('geo-time')
  await page.getByRole('button', { name: 'Start demo' }).click()
  await page.getByRole('navigation', { name: 'Classes' }).getByRole('link', { name: /^Place/ }).click()
  await page.getByRole('link', { name: /Oslo S/ }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.getByLabel('WKT')).toHaveValue('POINT (10.7522 59.9108)')
})

test('shows the interface in Norwegian when the language is nb', async ({ page }) => {
  await page.goto('/?demo=dim&lang=nb')
  await expect(page.getByText('Demo: endringer blir i denne fanen')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Innstillinger' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Klasser' })).toBeVisible()
})

test('saves an edited event in the places demo without false problems on its interval', async ({ page }) => {
  await page.goto('/?demo=geo-time#/resource/https%3A%2F%2Fexample.org%2Fgeo-time%2FEvent/https%3A%2F%2Fexample.org%2Fgeo-time%2Fevent%2Fmaintenance-window')
  await expect(page.getByRole('heading', { name: 'Maintenance window' })).toBeVisible()
  await page.getByRole('group', { name: 'Duration' }).getByRole('spinbutton', { name: 'hours' }).fill('10')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Review')
})

test('reorders key figures in the table view of the DIM demo', async ({ page }) => {
  await page.goto('/?demo=dim')
  await page.getByRole('navigation', { name: 'Classes' }).getByRole('link', { name: /^Key figure\s*\d*$/ }).click()
  await page.getByRole('navigation', { name: 'View' }).getByRole('link', { name: 'Table' }).click()
  const position = page.getByRole('textbox', { name: 'Total track length Position' })
  await expect(position).toHaveValue('1')
  await position.fill('3')
  await page.getByRole('button', { name: 'Save 1 change' }).click()
  await expect(page.getByRole('status')).toContainText('Saved 1 resource.')
  await expect(page.getByRole('textbox', { name: 'Total track length Position' })).toHaveValue('3')
})
