import { expect, test } from '@playwright/test';

test('Acme branding and installed modules', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-title')).toHaveText('Acme Motors');
  await expect(page.getByTestId('installed-modules')).toContainText('Loyalty');
  await expect(page.getByTestId('installed-modules')).toContainText('Service history');
  await expect(page.getByTestId('installed-modules')).toContainText('Sales');
  // emerald theme from customer.config.ts
  const bg = await page.getByTestId('topbar').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(4, 120, 87)');
});

test('customer module restyles a shared module field (loyalty tier badge)', async ({ page }) => {
  await page.goto('/customers?sort=loyalty.points&order=desc');
  await expect(page.getByTestId('tier-badge').first()).toHaveText(/PLATINUM/);
});

test('filter by loyalty tier from the UI', async ({ page }) => {
  await page.goto('/customers');
  await page.getByTestId('filter-loyalty.tier').locator('.p-select').click();
  await page.getByRole('option', { name: 'gold', exact: true }).click();
  await expect(page).toHaveURL(/loyalty\.tier/);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Gonzalez');
});

test('price range filter and currency renderer on cars', async ({ page }) => {
  await page.goto('/cars');
  const price = page.getByTestId('filter-sales.listPrice');
  await price.getByTestId('gte').fill('30000');
  await price.getByTestId('lte').fill('40000');
  await expect(page.getByTestId('total')).toHaveText(/^2 cars/);
  await expect(page.getByTestId('money').first()).toHaveText(/^\$3\d,\d{3}$/);
});

test('a customer detail page lists their cars (reverse reference)', async ({ page }) => {
  await page.goto('/customers?q=Raman');
  await page.locator('tbody tr').first().click();
  await page.getByRole('tab', { name: 'Cars' }).click();
  await expect(page.getByTestId('entity-table-Car')).toContainText('Model 3');
});
