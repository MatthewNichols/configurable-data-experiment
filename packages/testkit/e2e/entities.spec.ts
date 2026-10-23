import { expect, test } from '@playwright/test';
import { recordTitle, type EntityRecord } from '@cde/sdk';
import { apiCreate, displayText, editableFields, fillField, getFieldValue, loadRegistry, sampleInput, sampleValue } from '../src/e2e.ts';

/**
 * Registry-driven suite: runs unchanged against every install and exercises whatever fields
 * that install's modules add — create through the UI, check the detail page, edit, search,
 * filter, delete.
 */
const registry = loadRegistry();

test('shell shows the install title and every entity', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-title')).toHaveText(registry.customer.title);
  for (const name of registry.entityOrder) {
    await expect(page.getByTestId(`stat-${name}`)).toContainText(registry.entities[name].pluralLabel);
  }
});

for (const name of registry.entityOrder) {
  const entity = registry.entities[name];

  test.describe(`${entity.pluralLabel} (${name})`, () => {
    const refs: Record<string, string> = {};

    test.beforeAll(async ({ request }) => {
      // make sure every referenced entity has at least one record to pick
      for (const f of entity.fields.filter((x) => x.type === 'reference')) {
        const target = registry.entities[f.ref!];
        refs[target.name] = (await apiCreate(request, target, sampleInput(target))).id;
      }
    });

    test('create, view, edit, search, filter and delete through the UI', async ({ page }) => {
      const fields = editableFields(entity);
      const values = new Map(fields.map((f) => [f.key, sampleValue(f, refs)]));

      // --- create
      await page.goto(`/${entity.path}`);
      await page.getByTestId('btn-new').click();
      for (const s of entity.sections.filter((x) => fields.some((f) => f.section === x.key))) {
        await expect(page.getByTestId(`section-${s.key}`)).toContainText(s.label);
      }
      for (const f of fields) await fillField(page, f, values.get(f.key));
      await page.getByTestId('btn-save').click();
      await expect(page).toHaveURL(new RegExp(`/${entity.path}/[0-9a-f-]{36}$`));
      const id = page.url().split('/').pop()!;

      // --- detail shows every field, core and module
      const res = await page.request.get(`/api/${entity.path}/${id}`);
      const saved: EntityRecord = await res.json();
      for (const f of fields) {
        const cell = page.getByTestId(`detail-${f.key}`);
        if (f.type === 'reference') await expect(cell).not.toContainText('—');
        else if (f.type === 'decimal') await expect(cell).toContainText(/\d/);
        else await expect(cell).toContainText(displayText(f, getFieldValue(saved, f)));
      }
      await expect(page.getByTestId('record-title')).toHaveText(recordTitle(entity, saved));

      // --- edit a required core string
      const editable = fields.find((f) => f.source === 'core' && f.type === 'string' && f.required && f.maxLength !== 17)!;
      const renamed = `${values.get(editable.key)}x`;
      await page.getByTestId('btn-edit').click();
      await fillField(page, editable, renamed);
      await page.getByTestId('btn-save').click();
      await expect(page.getByTestId(`detail-${editable.key}`)).toContainText(renamed);

      // --- full-text search from the list page
      await page.goto(`/${entity.path}`);
      await page.getByTestId('search-q').fill(renamed);
      await expect(page.getByTestId('total')).toHaveText(new RegExp(`^1 `));
      await expect(page.locator('tbody tr')).toHaveCount(1);

      // --- every equality filter (core and module) finds the record via the URL-synced filter state
      for (const f of entity.fields.filter((x) => x.operators.includes('eq') && ['enum', 'bool'].includes(x.type))) {
        const v = getFieldValue(saved, f);
        await page.goto(`/${entity.path}?${encodeURIComponent(`filter[${f.key}]`)}=${encodeURIComponent(String(v))}&q=${encodeURIComponent(renamed)}`);
        await expect(page.getByTestId('total'), `filter ${f.key}=${v}`).toHaveText(/^1 /);
      }

      // --- delete
      await page.goto(`/${entity.path}/${id}`);
      await page.getByTestId('btn-delete').click();
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
      await expect(page).toHaveURL(new RegExp(`/${entity.path}$`));
      expect((await page.request.get(`/api/${entity.path}/${id}`)).status()).toBe(404);
    });

    test('client-side validation blocks an empty form', async ({ page }) => {
      await page.goto(`/${entity.path}/new`);
      await page.getByTestId('btn-save').click();
      for (const f of editableFields(entity).filter((x) => x.required && x.type !== 'bool')) {
        await expect(page.getByTestId(`error-${f.key}`)).toBeVisible();
      }
      await expect(page).toHaveURL(new RegExp(`/${entity.path}/new$`));
    });
  });
}
