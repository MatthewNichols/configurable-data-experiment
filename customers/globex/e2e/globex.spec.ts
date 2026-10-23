import { expect, test } from '@playwright/test';
import { loadRegistry, sampleInput, apiCreate } from '@cde/testkit/e2e';

const registry = loadRegistry();

test('relabelled core entity and fleet dashboard', async ({ page, request }) => {
  const count = async (status: string) =>
    (await (await request.get(`/api/cars?pageSize=1&filter[fleet.status]=${status}`)).json()).total as number;
  await page.goto('/');
  await expect(page.getByTestId('app-title')).toHaveText('Globex Rentals');
  await expect(page.getByTestId('nav-/customers')).toHaveText(/Renters/);
  const widget = page.getByTestId('widget-fleet-status');
  await expect(widget.getByTestId('fleet-maintenance')).toContainText(`${await count('maintenance')} maintenance`);
  const available = await count('available');
  await widget.getByTestId('fleet-available').click();
  await expect(page.getByTestId('total')).toHaveText(new RegExp(`^${available} car`));
});

test('fleet hook normalises fleet numbers and reports rule violations on the field', async ({ page }) => {
  await page.goto('/cars/new');
  await page.getByTestId('field-vin').locator('input').fill('GLBXE2E0000000001');
  await page.getByTestId('field-make').locator('input').fill('Mazda');
  await page.getByTestId('field-model').locator('input').fill('CX-5');
  await page.getByTestId('field-year').locator('input').fill('2024');
  await page.getByTestId('field-fleet.status').locator('.p-select').click();
  await page.getByRole('option', { name: 'available', exact: true }).click();

  await page.getByTestId('field-fleet.fleetNumber').locator('input').fill('ABC');
  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('error-fleet.fleetNumber')).toHaveText('Fleet numbers look like GX-0042');

  await page.getByTestId('field-fleet.fleetNumber').locator('input').fill('gx 0101');
  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('detail-fleet.fleetNumber')).toContainText('GX-0101');
});

test('odometer cannot go backwards', async ({ page, request }) => {
  const input = sampleInput(registry.entities.Car);
  input.customerId = null;
  (input.ext!.fleet as any).odometer = 5000;
  const car = await apiCreate(request, registry.entities.Car, input);
  await page.goto(`/cars/${car.id}/edit`);
  await page.getByTestId('field-fleet.odometer').locator('input').fill('4000');
  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('error-fleet.odometer')).toContainText('cannot go backwards');
});
