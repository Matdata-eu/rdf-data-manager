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
