import { describe, expect, it } from 'vitest';
import { Kysely, PostgresDialect } from 'kysely';
import { buildRegistry, loadCustomer } from '@cde/assembler';
import { buildSearch } from '../src/search/builder.ts';

const db = new Kysely<any>({ dialect: new PostgresDialect({ pool: {} as any }) });

describe('search builder SQL', async () => {
  const registry = buildRegistry(await loadCustomer('acme'));
  const Customer = registry.entities.Customer;
  const Car = registry.entities.Car;

  it('compiles core + ext filters, ranges, full text and ext sorting', () => {
    const { rows } = buildSearch(db, Customer, {
      q: 'mar gonz',
      filter: { 'loyalty.tier': { in: 'gold,silver' }, 'loyalty.points': { gte: '100' }, lastName: { like: 'z' } },
      sort: 'loyalty.points',
      order: 'asc',
    });
    const { sql, parameters } = rows.compile();
    expect(sql).toContain(`t.ext @> $1::jsonb or t.ext @> $2::jsonb`);
    expect(sql).toContain(`(t.ext #>> '{loyalty,points}')::numeric >= $3`);
    expect(sql).toContain(`"t"."lastName" ilike $4`);
    expect(sql).toContain(`t."searchVector" @@ to_tsquery('simple', $5)`);
    expect(sql).toContain(`order by (t.ext #>> '{loyalty,points}')::numeric asc nulls last`);
    expect(parameters).toEqual(['{"loyalty":{"tier":"gold"}}', '{"loyalty":{"tier":"silver"}}', 100, '%z%', 'mar:* & gonz:*', 'mar gonz', 'mar gonz', 25, 0]);
  });

  it('rejects unknown fields, disallowed operators and computed sorts', () => {
    expect(() => buildSearch(db, Customer, { filter: { nope: 'x' } })).toThrow(/Unknown/);
    expect(() => buildSearch(db, Customer, { filter: { 'loyalty.tier': { gte: 'a' } } })).toThrow(/not allowed/);
    expect(() => buildSearch(db, Car, { sort: 'serviceHistory.lastServiceDate' })).toThrow(/Cannot sort/);
  });

  it('hands module filters to the module search extension', () => {
    const seen: unknown[] = [];
    buildSearch(db, Car, { filter: { 'serviceHistory.serviceDue': 'true' } }, new Map([['serviceHistory', (qb: any, f: unknown) => (seen.push(f), qb)]]));
    expect(seen).toEqual([{ serviceDue: 'true' }]);
  });
});
