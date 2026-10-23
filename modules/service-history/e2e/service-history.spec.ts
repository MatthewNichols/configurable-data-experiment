import { expect, test } from '@playwright/test';
import { apiCreate, loadRegistry, sampleInput } from '@cde/testkit/e2e';

/** Ships with the module: runs for every install that includes service-history. */
const registry = loadRegistry();
const Car = registry.entities.Car;

test('records a service from the car tab and updates computed fields', async ({ page, request }) => {
  const input = sampleInput(Car);
  input.customerId = null;
  const car = await apiCreate(request, Car, input);
  await page.goto(`/cars/${car.id}`);
  await expect(page.getByTestId('detail-serviceHistory.due')).toContainText('Yes');

  await page.getByTestId('tab-service-history').click();
  await page.getByTestId('service-description').fill('Oil and filter change');
  await page.getByTestId('service-add').click();
  await expect(page.getByTestId('service-history').locator('tbody')).toContainText('Oil and filter change');

  await page.getByRole('tab', { name: 'Details' }).click();
  const today = new Date().toISOString().slice(0, 10);
  await expect(page.getByTestId('detail-serviceHistory.lastServiceDate')).toContainText(today);
  await expect(page.getByTestId('detail-serviceHistory.due')).toContainText('No');
});

test('dashboard widget links to the service-due filter', async ({ page }) => {
  await page.goto('/');
  const widget = page.getByTestId('widget-service-due');
  await expect(widget).toContainText('Due for service');
  await widget.locator('a').first().click();
  await expect(page).toHaveURL(/filter%5BserviceHistory\.serviceDue%5D=true|filter\[serviceHistory\.serviceDue\]=true/);
  await expect(page.getByTestId('filter-serviceHistory.serviceDue')).toContainText('Yes');
});
