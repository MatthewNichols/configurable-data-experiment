import { expect, test } from '@playwright/test';

test('core-only install has no module UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-title')).toHaveText('CDE Core');
  await expect(page.getByText('Core data only, no modules installed.')).toBeVisible();
  await expect(page.locator('[data-testid^=widget-]')).toHaveCount(0);

  await page.goto('/cars');
  await page.locator('tbody tr').first().click();
  await expect(page.getByTestId('section-core')).toBeVisible();
  await expect(page.locator('[data-testid^=section-]')).toHaveCount(1);
  await expect(page.locator('[data-testid^=tab-]')).toHaveCount(0);
});
