import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestInstall, type TestInstall } from '@cde/testkit';

/** The "bare" install: core entities only, real Postgres via Testcontainers. */
describe('core API (no modules)', () => {
  let t: TestInstall;
  beforeAll(async () => {
    t = await startTestInstall({ modules: [] });
  });
  afterAll(() => t?.stop());

  it('serves the registry', async () => {
    const { status, body } = await t.api.get('/api/meta');
    expect(status).toBe(200);
    expect(body.entityOrder).toEqual(['Customer', 'Car']);
    expect(body.entities.Customer.fields.map((f: any) => f.key)).toEqual(['firstName', 'lastName', 'email', 'phone', 'notes']);
  });

  it('creates, reads, updates and deletes', async () => {
    const c = await t.create('customers', { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' });
    expect(c).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', ext: {} });

    const car = await t.create('cars', { vin: 'VIN00000000000001', make: 'Morris', model: 'Minor', year: 1956, customerId: c.id });
    expect(car.customerId).toBe(c.id);

    const upd = await t.api.put(`/api/customers/${c.id}`, { firstName: 'Augusta', lastName: 'Lovelace' });
    expect(upd.status).toBe(200);
    expect(upd.body.firstName).toBe('Augusta');
    expect(upd.body.email).toBeNull();

    expect((await t.api.del(`/api/cars/${car.id}`)).status).toBe(204);
    expect((await t.api.get(`/api/cars/${car.id}`)).status).toBe(404);
  });

  it('validates input and rejects unknown ext namespaces', async () => {
    const bad = await t.api.post('/api/customers', { firstName: '', ext: { nope: { x: 1 } } });
    expect(bad.status).toBe(422);
    expect(bad.body.fieldErrors).toMatchObject({ firstName: expect.any(String), lastName: expect.any(String) });
    expect(Object.keys(bad.body.fieldErrors).some((k) => k.startsWith('nope') || k === '_')).toBe(true);
  });

  it('reports unique violations as 409', async () => {
    await t.create('cars', { vin: 'DUPLICATE00000001', make: 'A', model: 'B', year: 2000 });
    const dup = await t.api.post('/api/cars', { vin: 'DUPLICATE00000001', make: 'A', model: 'B', year: 2000 });
    expect(dup.status).toBe(409);
  });

  it('searches with full text, fuzzy title match, filters, ranges and sorting', async () => {
    await t.create('customers', { firstName: 'Grace', lastName: 'Hopper', notes: 'Compiler pioneer' });
    await t.create('customers', { firstName: 'Alan', lastName: 'Turing' });
    await t.create('cars', { vin: 'RANGE000000000001', make: 'Saab', model: '900', year: 1985 });
    await t.create('cars', { vin: 'RANGE000000000002', make: 'Saab', model: '9-3', year: 2003 });

    const text = await t.api.get('/api/customers?q=compil');
    expect(text.body.items.map((c: any) => c.lastName)).toEqual(['Hopper']);

    const fuzzy = await t.api.get('/api/customers?q=Hoper');
    expect(fuzzy.body.items.map((c: any) => c.lastName)).toContain('Hopper');

    const like = await t.api.get('/api/customers?filter[lastName][like]=tur');
    expect(like.body.items.map((c: any) => c.lastName)).toEqual(['Turing']);

    const range = await t.api.get('/api/cars?filter[make]=Saab&filter[year][gte]=1990&sort=year&order=asc');
    expect(range.body.items.map((c: any) => c.model)).toEqual(['9-3']);
    expect(range.body.total).toBe(1);

    const bad = await t.api.get('/api/customers?filter[notes]=x');
    expect(bad.status).toBe(400);
  });
});
