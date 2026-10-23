import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { getFieldValue, type EntityRecord, type Registry, type RegistryEntity, type RegistryField } from '@cde/sdk';
import { sampleValue } from './samples.ts';

/** The registry of the install under test (written by `cde build`). */
export function loadRegistry(): Registry {
  return JSON.parse(readFileSync(process.env.CDE_REGISTRY!, 'utf8'));
}

export const editableFields = (e: RegistryEntity) => e.fields.filter((f) => !f.readOnly && f.source !== 'computed');

/** Sets a field in the generic entity form, whatever its type. */
export async function fillField(page: Page, field: RegistryField, value: unknown) {
  const w = page.getByTestId(`field-${field.key}`);
  switch (field.type) {
    case 'text':
      await w.locator('textarea').fill(String(value ?? ''));
      break;
    case 'bool': {
      const input = w.locator('input[type=checkbox]');
      if ((await input.isChecked()) !== !!value) await w.locator('.p-toggleswitch').click();
      break;
    }
    case 'enum':
    case 'reference': {
      await w.locator('.p-select').click();
      const option =
        field.type === 'enum' ? page.getByRole('option', { name: String(value), exact: true }) : page.locator('.p-select-overlay [role=option]').first();
      await option.click();
      break;
    }
    default:
      await w.locator('input').fill(value === null || value === undefined ? '' : String(value));
  }
}

/** What the generic FieldDisplay shows for a value (custom renderers are only checked for presence). */
export function displayText(field: RegistryField, value: unknown): string | RegExp {
  if (field.type === 'bool') return value ? 'Yes' : 'No';
  if (field.type === 'enum') return new RegExp(String(value), 'i');
  return String(value);
}

export async function apiCreate(request: APIRequestContext, entity: RegistryEntity, data: unknown): Promise<EntityRecord> {
  const res = await request.post(`/api/${entity.path}`, { data });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

/** Valid API input for an entity with every editable field populated. */
export function sampleInput(entity: RegistryEntity, refs: Record<string, string> = {}): Partial<EntityRecord> {
  const rec: Partial<EntityRecord> = { ext: {} };
  for (const f of editableFields(entity)) {
    const v = sampleValue(f, refs);
    if (f.source === 'core') rec[f.key] = v;
    else ((rec.ext![f.path![0]] ??= {}) as Record<string, unknown>)[f.path![1]] = v;
  }
  return rec;
}

export { getFieldValue, sampleValue };
