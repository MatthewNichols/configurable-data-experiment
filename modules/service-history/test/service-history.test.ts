import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestInstall, type TestInstall } from '@cde/testkit';

describe('service-history module (code module with its own table)', () => {
  let t: TestInstall;
  beforeAll(async () => {
    t = await startTestInstall({ modules: ['@cde-module/service-history'] });
  });
  afterAll(() => t?.stop());

  const today = new Date().toISOString().slice(0, 10);

  it('records services and exposes computed fields + due filter', async () => {
    const fresh = await t.create('cars', { vin: 'SERVICED000000001', make: 'Volvo', model: '240', year: 1990 });
    const stale = await t.create('cars', { vin: 'NEVERSERVICED0001', make: 'Volvo', model: '740', year: 1988 });
    const tight = await t.create('cars', {
      vin: 'TIGHTINTERVAL0001',
      make: 'Volvo',
      model: '940',
      year: 1994,
      ext: { serviceHistory: { intervalMonths: 1 } },
    });

    const add = await t.api.post(`/api/modules/serviceHistory/cars/${fresh.id}/records`, {
      date: today,
      mileage: 120000,
      description: 'Oil change',
      cost: 89.5,
    });
    expect(add.status).toBe(201);
    await t.api.post(`/api/modules/serviceHistory/cars/${tight.id}/records`, { date: '2026-01-01', description: 'Brakes' });

    const bad = await t.api.post(`/api/modules/serviceHistory/cars/${fresh.id}/records`, { date: 'yesterday', description: '' });
    expect(bad.status).toBe(422);

    const detail = await t.api.get(`/api/cars/${fresh.id}`);
    expect(detail.body.computed.serviceHistory).toEqual({ lastServiceDate: today, serviceCount: 1, due: false });

    const due = await t.api.get('/api/cars?filter[serviceHistory.serviceDue]=true&sort=model&order=asc');
    expect(due.body.items.map((c: any) => c.model)).toEqual(['740', '940']);
    const notDue = await t.api.get('/api/cars?filter[serviceHistory.serviceDue]=false');
    expect(notDue.body.items.map((c: any) => c.model)).toEqual(['240']);

    const list = await t.api.get(`/api/modules/serviceHistory/cars/${fresh.id}/records`);
    expect(list.body).toMatchObject([{ description: 'Oil change', cost: 89.5, mileage: 120000, date: today }]);

    const widget = await t.api.get('/api/modules/serviceHistory/due');
    expect(widget.body.total).toBe(2);
    expect(stale.id).toBeDefined();
  });

  it('cascades records when a car is deleted', async () => {
    const car = await t.create('cars', { vin: 'DELETEME000000001', make: 'Saab', model: '99', year: 1975 });
    await t.api.post(`/api/modules/serviceHistory/cars/${car.id}/records`, { date: today, description: 'Check' });
    expect((await t.api.del(`/api/cars/${car.id}`)).status).toBe(204);
    expect(await t.install.prisma.serviceRecord.count({ where: { carId: car.id } })).toBe(0);
  });
});
