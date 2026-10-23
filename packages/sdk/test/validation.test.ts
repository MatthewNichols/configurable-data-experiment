import { describe, expect, it } from 'vitest';
import { entityInputSchema, flattenIssues, type RegistryEntity, type RegistryField } from '../src/index.ts';

const field = (f: Partial<RegistryField> & Pick<RegistryField, 'key' | 'type'>): RegistryField => ({
  label: f.key,
  source: 'core',
  section: 'core',
  searchable: [],
  operators: [],
  ...f,
});

const entity: RegistryEntity = {
  name: 'Car',
  label: 'Car',
  pluralLabel: 'Cars',
  path: 'cars',
  table: 'Car',
  delegate: 'car',
  titleFields: ['make'],
  sections: [],
  filters: [],
  fields: [
    field({ key: 'make', type: 'string', required: true, column: 'make' }),
    field({ key: 'year', type: 'int', min: 1900, column: 'year' }),
    field({ key: 'fleet.number', type: 'string', required: true, source: 'ext', path: ['fleet', 'number'], module: 'fleet' }),
    field({ key: 'fleet.depot', type: 'enum', values: ['north', 'south'], source: 'ext', path: ['fleet', 'depot'], module: 'fleet' }),
    field({ key: 'paint.when', type: 'date', source: 'ext', path: ['paint', 'when'], module: 'paint' }),
    field({ key: 'svc.last', type: 'date', source: 'computed', path: ['svc', 'last'], module: 'svc', readOnly: true }),
  ],
};

describe('entityInputSchema', () => {
  const schema = entityInputSchema(entity);
  const errors = (input: unknown) => {
    const r = schema.safeParse(input);
    return r.success ? {} : flattenIssues(r.error);
  };

  it('accepts valid core + ext input and normalises empty strings to null', () => {
    const r = schema.parse({ make: 'Saab', year: '' , ext: { fleet: { number: 'GX-1', depot: '' } } });
    expect(r).toEqual({ make: 'Saab', year: null, ext: { fleet: { number: 'GX-1', depot: null }, paint: {} } });
  });

  it('enforces required module fields even when the namespace is missing', () => {
    expect(errors({ make: 'Saab' })).toEqual({ 'fleet.number': expect.any(String) });
    expect(errors({ make: 'Saab', ext: {} })).toEqual({ 'fleet.number': expect.any(String) });
  });

  it('rejects bad values, unknown namespaces and computed fields', () => {
    const e = errors({ make: '', year: 1800, ext: { fleet: { number: 'x', depot: 'east' }, paint: { when: '1/2/2020' }, other: {}, svc: {} } });
    expect(Object.keys(e).sort()).toEqual(['_', 'fleet.depot', 'make', 'paint.when', 'year']);
  });
});
