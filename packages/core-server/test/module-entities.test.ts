import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestInstall, type TestInstall } from '@cde/testkit';

const workshop = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'workshop');

/** An entity declared by a module gets a generated table and the same generic API as core ones. */
describe('module-declared entities', () => {
  let t: TestInstall;
  beforeAll(async () => {
    t = await startTestInstall({ modules: [workshop] });
  });
  afterAll(() => t?.stop());

  it('round-trips every column type', async () => {
    const keyholder = await t.create('customers', { firstName: 'Kay', lastName: 'Holder' });
    const bay = await t.create('bays', {
      code: 'B1', notes: 'Near the jet wash', lifts: 2, rate: 12.5, covered: true, opened: '2024-02-29', kind: 'wash', keyholder: keyholder.id,
    });
    expect(bay).toMatchObject({ code: 'B1', lifts: 2, rate: 12.5, covered: true, opened: '2024-02-29', kind: 'wash', keyholder: keyholder.id, ext: {} });

    const listed = (await t.api.get(`/api/bays?filter[code]=B1`)).body.items[0];
    expect(listed).toMatchObject({ rate: 12.5, opened: '2024-02-29', keyholder: keyholder.id });
  });

  it('searches by text, filter and range', async () => {
    await t.create('bays', { code: 'R7', notes: 'Hydraulic lifts', lifts: 4, opened: '2025-06-01', kind: 'repair', covered: false });
    expect((await t.api.get('/api/bays?q=hydraulic')).body.items.map((b: any) => b.code)).toEqual(['R7']);
    expect((await t.api.get('/api/bays?filter[kind]=repair')).body.total).toBe(1);
    expect((await t.api.get('/api/bays?filter[opened][gte]=2025-01-01')).body.items.map((b: any) => b.code)).toEqual(['R7']);
  });

  it('checks references that have no foreign key', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const bad = await t.api.post('/api/bays', { code: 'X1', keyholder: missing });
    expect(bad.status).toBe(422);
    expect(bad.body.fieldErrors).toEqual({ keyholder: 'Customer not found' });

    const car = await t.api.post('/api/cars', { vin: 'BAYTEST0000000001', make: 'A', model: 'B', year: 2020, ext: { workshop: { bay: missing } } });
    expect(car.body.fieldErrors).toEqual({ 'workshop.bay': 'Bay not found' });
  });

  it('updates and deletes', async () => {
    const bay = await t.create('bays', { code: 'U1', opened: '2020-01-01' });
    const upd = await t.api.put(`/api/bays/${bay.id}`, { code: 'U2' });
    expect(upd.body).toMatchObject({ code: 'U2', opened: null });
    expect((await t.api.del(`/api/bays/${bay.id}`)).status).toBe(204);
    expect((await t.api.get(`/api/bays/${bay.id}`)).status).toBe(404);
  });
});
