import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestInstall, type TestInstall } from '@cde/testkit';

describe('loyalty module (declarative)', () => {
  let t: TestInstall;
  beforeAll(async () => {
    t = await startTestInstall({ modules: ['@cde-module/loyalty'] });
  });
  afterAll(() => t?.stop());

  it('adds namespaced fields to the Customer registry entry', () => {
    const keys = t.registry.entities.Customer.fields.filter((f) => f.module === 'loyalty').map((f) => f.key);
    expect(keys).toEqual(['loyalty.tier', 'loyalty.points', 'loyalty.memberSince', 'loyalty.marketingOptIn']);
    expect(t.registry.entities.Customer.sections.map((s) => s.label)).toEqual(['Details', 'Loyalty']);
  });

  it('stores, validates and filters ext data', async () => {
    await t.create('customers', { firstName: 'Gold', lastName: 'One', ext: { loyalty: { tier: 'gold', points: 900, marketingOptIn: true } } });
    await t.create('customers', { firstName: 'Silver', lastName: 'Two', ext: { loyalty: { tier: 'silver', points: 120, memberSince: '2020-01-02' } } });
    await t.create('customers', { firstName: 'No', lastName: 'Tier' });

    const bad = await t.api.post('/api/customers', { firstName: 'X', lastName: 'Y', ext: { loyalty: { tier: 'diamond', points: -1 } } });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.fieldErrors).sort()).toEqual(['loyalty.points', 'loyalty.tier']);

    const gold = await t.api.get('/api/customers?filter[loyalty.tier]=gold');
    expect(gold.body.items.map((c: any) => c.firstName)).toEqual(['Gold']);

    const several = await t.api.get('/api/customers?filter[loyalty.tier][in]=gold,silver&sort=loyalty.points&order=asc');
    expect(several.body.items.map((c: any) => c.firstName)).toEqual(['Silver', 'Gold']);

    const range = await t.api.get('/api/customers?filter[loyalty.points][gte]=500');
    expect(range.body.items.map((c: any) => c.firstName)).toEqual(['Gold']);

    const since = await t.api.get('/api/customers?filter[loyalty.memberSince][lte]=2021-01-01');
    expect(since.body.items.map((c: any) => c.firstName)).toEqual(['Silver']);

    const optIn = await t.api.get('/api/customers?filter[loyalty.marketingOptIn]=true');
    expect(optIn.body.items.map((c: any) => c.firstName)).toEqual(['Gold']);
  });

  it('keeps ext data of modules that are not installed when updating', async () => {
    const c = await t.install.service.create('Customer', { firstName: 'Keep', lastName: 'Me' });
    // simulate data left behind by a module this install no longer has
    await t.install.prisma.customer.update({ where: { id: c.id }, data: { ext: { legacyCrm: { id: 'L-1' } } } });
    const upd = await t.api.put(`/api/customers/${c.id}`, { firstName: 'Kept', lastName: 'Me', ext: { loyalty: { tier: 'bronze' } } });
    expect(upd.body.ext).toEqual({ legacyCrm: { id: 'L-1' }, loyalty: { tier: 'bronze' } });
  });
});
