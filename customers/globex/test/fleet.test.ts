import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestInstall, type TestInstall } from '@cde/testkit';

/** Customer-level integration test: the full globex install on a throwaway database. */
describe('globex fleet rules', () => {
  let t: TestInstall;
  beforeAll(async () => {
    t = await startTestInstall({ customer: 'globex' });
  });
  afterAll(() => t?.stop());

  const car = (fleetNumber: string, odometer?: number) => ({
    vin: `GLBXTEST${Math.random().toString().slice(2, 11)}`,
    make: 'Kia',
    model: 'Niro',
    year: 2024,
    ext: { fleet: { fleetNumber, status: 'available', odometer } },
  });

  it('requires and normalises fleet numbers', async () => {
    expect((await t.api.post('/api/cars', { ...car('x'), ext: {} })).body.fieldErrors).toHaveProperty(['fleet.fleetNumber']);
    expect((await t.api.post('/api/cars', car('nope'))).body.fieldErrors).toEqual({ 'fleet.fleetNumber': 'Fleet numbers look like GX-0042' });
    expect((await t.create('cars', car('gx 0042'))).ext.fleet.fleetNumber).toBe('GX-0042');
  });

  it('refuses odometer roll-back', async () => {
    const c = await t.create('cars', car('GX-0100', 1000));
    const back = await t.api.put(`/api/cars/${c.id}`, { ...car('GX-0100', 900), vin: c.vin });
    expect(back.status).toBe(422);
    expect(back.body.fieldErrors['fleet.odometer']).toMatch(/backwards/);
  });

  it('keeps a car at no garage or one, and reports occupancy', async () => {
    const g = await t.create('garages', { name: 'Test yard', depot: 'north', bays: 3 });
    const at = (n: string) => ({ ...car(n), ext: { fleet: { ...car(n).ext.fleet, garage: g.id } } });
    const parked = await t.create('cars', at('GX-0201'));
    await t.create('cars', { ...at('GX-0202'), ext: { fleet: { ...at('GX-0202').ext.fleet, status: 'rented' } } });
    const loose = await t.create('cars', car('GX-0203'));
    expect(loose.ext.fleet.garage).toBeUndefined();

    const here = await t.api.get(`/api/cars?filter[fleet.garage]=${g.id}`);
    expect(here.body.items.map((c: any) => c.ext.fleet.fleetNumber).sort()).toEqual(['GX-0201', 'GX-0202']);
    expect((await t.api.get(`/api/modules/fleet/garages/${g.id}/occupancy`)).body).toEqual({ bays: 3, cars: 2, byStatus: { available: 1, rented: 1 } });

    const unknown = await t.api.post('/api/cars', { ...car('GX-0204'), ext: { fleet: { ...car('GX-0204').ext.fleet, garage: '00000000-0000-4000-8000-000000000000' } } });
    expect(unknown.body.fieldErrors).toEqual({ 'fleet.garage': 'Garage not found' });

    // move a car out (garage cleared), then the delete guard still sees the other one
    const moved = await t.api.put(`/api/cars/${parked.id}`, { ...car('GX-0201'), vin: parked.vin, ext: { fleet: { ...car('GX-0201').ext.fleet, garage: null } } });
    expect(moved.body.ext.fleet.garage).toBeNull();
    const blocked = await t.api.del(`/api/garages/${g.id}`);
    expect(blocked.status).toBe(422);
    expect(blocked.body.error).toMatch(/Test yard still has 1 car assigned/);
  });

  it('serves fleet status counts', async () => {
    const res = await t.api.get('/api/modules/fleet/status');
    expect(res.body.available).toBeGreaterThanOrEqual(2);
  });
});
