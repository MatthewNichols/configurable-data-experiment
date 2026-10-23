import { sql } from 'kysely';
import { defineServerModule, ValidationError } from '@cde/sdk/server';

export default defineServerModule({
  register({ hooks, router, db }) {
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
