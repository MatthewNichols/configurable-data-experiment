import { sql } from 'kysely';
import { defineServerModule, ValidationError } from '@cde/sdk/server';

export default defineServerModule({
  register({ hooks, router, db }) {
    const carsAt = (garageId: string) =>
      db.selectFrom('Car').where(sql<boolean>`ext @> ${JSON.stringify({ fleet: { garage: garageId } })}::jsonb`);

    // Business rules that a declarative field can't express live in hooks.
    hooks.beforeSave('Car', ({ input, existing }) => {
      const fleet = (input.ext.fleet ??= {}) as Record<string, any>;
      if (typeof fleet.fleetNumber === 'string') {
        fleet.fleetNumber = fleet.fleetNumber.trim().toUpperCase().replace(/^GX\s*(\d)/, 'GX-$1');
        if (!/^GX-\d{4}$/.test(fleet.fleetNumber))
          throw new ValidationError('Validation failed', { 'fleet.fleetNumber': 'Fleet numbers look like GX-0042' });
      }
      const before = (existing?.ext.fleet as any)?.odometer;
      if (before != null && fleet.odometer != null && fleet.odometer < before)
        throw new ValidationError('Validation failed', { 'fleet.odometer': `Odometer cannot go backwards (was ${before})` });
    });

    // Car.fleet.garage lives in JSONB (no foreign key), so keep garages with cars from being deleted.
    hooks.beforeDelete('Garage', async (garage) => {
      const { count } = await carsAt(garage.id).select(sql<string>`count(*)`.as('count')).executeTakeFirstOrThrow();
      if (Number(count) > 0)
        throw new ValidationError(`${garage.name} still has ${count} car${Number(count) === 1 ? '' : 's'} assigned; move them first`);
    });

    // garage detail page: bays in use, by rental status
    router.get('/garages/:id/occupancy', async (req, res) => {
      const garage = await db.selectFrom('Garage').select('bays').where('id', '=', req.params.id).executeTakeFirst();
      if (!garage) return void res.status(404).json({ error: 'Garage not found' });
      const rows = await carsAt(req.params.id)
        .select([sql<string>`ext #>> '{fleet,status}'`.as('status'), sql<string>`count(*)`.as('count')])
        .groupBy(sql`ext #>> '{fleet,status}'`)
        .execute();
      const byStatus = Object.fromEntries(rows.map((r) => [r.status ?? 'unknown', Number(r.count)]));
      res.json({ bays: garage.bays, cars: rows.reduce((n, r) => n + Number(r.count), 0), byStatus });
    });

    // dashboard widget: cars per rental status
    router.get('/status', async (_req, res) => {
      const rows = await db
        .selectFrom('Car')
        .select([sql<string>`ext #>> '{fleet,status}'`.as('status'), sql<string>`count(*)`.as('count')])
        .groupBy(sql`ext #>> '{fleet,status}'`)
        .execute();
      res.json(Object.fromEntries(rows.map((r) => [r.status ?? 'unknown', Number(r.count)])));
    });
  },
});
