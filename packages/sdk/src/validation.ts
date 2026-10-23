import { z } from 'zod';
import type { RegistryEntity, RegistryField } from './registry.ts';

const emptyToNull = (v: unknown) => (v === '' ? null : v);

export function fieldSchema(field: RegistryField): z.ZodType {
  let s: z.ZodType;
  switch (field.type) {
    case 'string':
    case 'text': {
      let str = z.string().trim().max(field.maxLength ?? (field.type === 'string' ? 255 : 10_000));
      if (field.required) str = str.min(1, 'Required');
      s = str;
      break;
    }
    case 'int':
    case 'decimal': {
      let n = field.type === 'int' ? z.number().int() : z.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      s = n;
      break;
    }
    case 'bool':
      s = z.boolean();
      break;
    case 'date':
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
      break;
    case 'enum':
      s = z.enum(field.values as [string, ...string[]]);
      break;
    case 'reference':
      s = z.uuid();
      break;
  }
  return field.required ? z.preprocess(emptyToNull, s) : z.preprocess(emptyToNull, s.nullable().optional());
}

/**
 * Builds the input schema for an entity: core fields at the top level, module fields nested
 * under `ext.<module>`. Unknown keys are rejected so typos in extension data surface early.
 */
export function entityInputSchema(entity: RegistryEntity) {
  const core: Record<string, z.ZodType> = {};
  const ext: Record<string, Record<string, z.ZodType>> = {};
  for (const field of entity.fields) {
    if (field.readOnly || field.source === 'computed') continue;
    if (field.source === 'core') core[field.key] = fieldSchema(field);
    else {
      const [mod, key] = field.path!;
      (ext[mod] ??= {})[key] = fieldSchema(field);
    }
  }
  // a missing namespace is validated as `{}` (not skipped) so required module fields are enforced
  const orEmpty = (s: z.ZodType) => z.preprocess((v) => v ?? {}, s);
  const extShape = Object.fromEntries(Object.entries(ext).map(([mod, shape]) => [mod, orEmpty(z.strictObject(shape))]));
  return z.strictObject({
    ...core,
    ext: orEmpty(z.strictObject(extShape)),
  });
}

export type FieldErrors = Record<string, string>;

/** Flattens zod issues to `{ 'lastName': 'Required', 'loyalty.tier': 'Invalid option' }`. */
export function flattenIssues(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const p = issue.path.map(String);
    const key = p[0] === 'ext' ? p.slice(1).join('.') : p.join('.');
    out[key || '_'] ??= issue.message;
  }
  return out;
}
