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

  it('serves fleet status counts', async () => {
    const res = await t.api.get('/api/modules/fleet/status');
    expect(res.body.available).toBeGreaterThanOrEqual(2);
  });
});
