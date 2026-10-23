import { describe, expect, it } from 'vitest';
import { defineModule } from '@cde/sdk';
import { AssemblyError, buildRegistry, extrasSql, loadCustomer, type LoadedCustomer } from '../src/index.ts';

const customer = (modules: LoadedCustomer['modules']): LoadedCustomer => ({
  config: { name: 't', title: 'T', modules: modules.map((m) => m.ref) },
  dir: '/tmp',
  modules,
});
const mod = (manifest: Parameters<typeof defineModule>[0]) => ({ manifest, dir: '/tmp', ref: manifest.name });

describe('registry validation', () => {
  it('rejects colliding module names, bad types, unknown entities and refs', () => {
    const c = customer([
      mod({ name: 'loyalty', extends: { Customer: { fields: { tier: { type: 'enum' } as any } } } }),
      mod({ name: 'loyalty', extends: { Customer: { fields: { other: { type: 'string' } } } } }),
      mod({ name: 'Bad-Name' }),
      mod({ name: 'x', extends: { Boat: { fields: {} }, Car: { fields: { owner: { type: 'reference', ref: 'Person' }, n: { type: 'money' as any } } } } }),
      mod({ name: 'y', extends: { Car: { fields: { s: { type: 'string', searchable: 'range' } }, filters: { due: { type: 'bool' } } } } }),
    ]);
    expect(() => buildRegistry(c)).toThrow(AssemblyError);
    try {
      buildRegistry(c);
    } catch (e) {
      expect((e as AssemblyError).problems).toEqual([
        'loyalty: Customer.tier: enum fields need "values"',
        'loyalty: module name "loyalty" is already used by loyalty (ext namespaces would collide)',
        'Bad-Name: module name "Bad-Name" must be camelCase (it is the JSONB namespace)',
        'x: extends unknown entity "Boat"',
        'x: Car.owner: reference to unknown entity "Person"',
        'x: Car.n: unknown field type "money"',
        'y: Car.s: "range" search needs an int, decimal or date field',
        'y: filter Car.due needs a server entry to implement it',
      ]);
    }
  });
});

describe('customer builds', () => {
  for (const name of ['bare', 'acme', 'globex']) {
    it(`${name}: registry snapshot (catches accidental contract changes)`, async () => {
      const registry = buildRegistry(await loadCustomer(name));
      await expect(JSON.stringify(registry, null, 2)).toMatchFileSnapshot(`./__snapshots__/${name}.registry.json`);
    });
  }

  it('generates search-vector triggers that include module text fields', async () => {
    const registry = buildRegistry(await loadCustomer('globex'));
    const sql = extrasSql(registry, []);
    expect(sql).toContain(`NEW.ext #>> '{fleet,fleetNumber}'`);
    expect(sql).toContain(`NEW.ext #>> '{fleet,licenseNumber}'`);
  });
});
