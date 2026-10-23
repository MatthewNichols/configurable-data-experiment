import { sql, type RawBuilder } from 'kysely';
import { z } from 'zod';
import { defineServerModule, ValidationError } from '@cde/sdk/server';
import { flattenIssues } from '@cde/sdk';

const DEFAULT_INTERVAL = 12;

const recordInput = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mileage: z.number().int().min(0).nullable().optional(),
  description: z.string().trim().min(1).max(500),
  cost: z.number().min(0).nullable().optional(),
});

/** The slice of the install's generated Prisma client this module relies on. */
interface ServiceRecordClient {
  serviceRecord: {
    findMany(args: unknown): Promise<any[]>;
    create(args: unknown): Promise<any>;
    delete(args: unknown): Promise<any>;
  };
  car: { findUnique(args: unknown): Promise<any> };
}

const toJson = (r: any) => ({
  id: r.id,
  carId: r.carId,
  date: r.date.toISOString().slice(0, 10),
  mileage: r.mileage,
  description: r.description,
  cost: r.cost === null ? null : Number(r.cost),
  createdAt: r.createdAt.toISOString(),
});

export default defineServerModule({
  register({ router, db, enrich, search, logger, ...ctx }) {
    const prisma = ctx.prisma as ServiceRecordClient;
    const interval = sql`coalesce((t.ext #>> '{serviceHistory,intervalMonths}')::int, ${sql.lit(DEFAULT_INTERVAL)})`;
    const recentService = (carRef: RawBuilder<unknown>) =>
      sql`exists (select 1 from "ServiceRecord" s where s."carId" = ${carRef} and s."date" > now() - make_interval(months => ${interval}))`;

    // ?filter[serviceHistory.serviceDue]=true|false
    search.extend('Car', (qb, filters) => {
      if (filters.serviceDue === undefined) return qb;
      const due = String(filters.serviceDue) === 'true';
      return qb.where(due ? sql<boolean>`not ${recentService(sql.ref('t.id'))}` : sql<boolean>`${recentService(sql.ref('t.id'))}`);
    });

    // computed fields for list + detail responses, one query per batch
    enrich('Car', async (cars) => {
      if (!cars.length) return;
      const rows = await db
        .selectFrom('CarServiceSummary')
        .select(['carId', 'lastServiceDate', 'serviceCount'])
        .where('carId', 'in', cars.map((c) => c.id))
        .execute();
      const byCar = new Map(rows.map((r: any) => [r.carId, r]));
      for (const car of cars) {
        const s: any = byCar.get(car.id);
        const months = Number((car.ext.serviceHistory as any)?.intervalMonths ?? DEFAULT_INTERVAL);
        const last: string | undefined = s?.lastServiceDate; // 'YYYY-MM-DD'
        const dueAt = last ? new Date(`${last}T00:00:00Z`) : undefined;
        dueAt?.setUTCMonth(dueAt.getUTCMonth() + months);
        (car.computed ??= {}).serviceHistory = {
          lastServiceDate: last ?? null,
          serviceCount: s?.serviceCount ?? 0,
          due: !dueAt || dueAt < new Date(),
        };
      }
    });

    router.get('/cars/:carId/records', async (req, res) => {
      const records = await prisma.serviceRecord.findMany({ where: { carId: req.params.carId }, orderBy: { date: 'desc' } });
      res.json(records.map(toJson));
    });

    router.post('/cars/:carId/records', async (req, res) => {
      const parsed = recordInput.safeParse(req.body);
      if (!parsed.success) throw new ValidationError('Validation failed', flattenIssues(parsed.error));
      const car = await prisma.car.findUnique({ where: { id: req.params.carId }, select: { id: true } });
      if (!car) {
        res.status(404).json({ error: 'Car not found' });
        return;
      }
      const record = await prisma.serviceRecord.create({
        data: { ...parsed.data, date: new Date(parsed.data.date), carId: car.id },
      });
      logger.info(`service record ${record.id} added to car ${car.id}`);
      res.status(201).json(toJson(record));
    });

    router.delete('/records/:id', async (req, res) => {
      await prisma.serviceRecord.delete({ where: { id: req.params.id } });
      res.status(204).end();
    });

    // dashboard widget data
    router.get('/due', async (_req, res) => {
      const rows = await db
        .selectFrom('Car as t')
        .select(['t.id', 't.make', 't.model', 't.year', 't.vin'])
        .where(sql<boolean>`not ${recentService(sql.ref('t.id'))}`)
        .orderBy('t.year')
        .limit(5)
        .execute();
      const [{ count }] = await db
        .selectFrom('Car as t')
        .select(sql<string>`count(*)`.as('count'))
        .where(sql<boolean>`not ${recentService(sql.ref('t.id'))}`)
        .execute();
      res.json({ total: Number(count), cars: rows });
    });
  },
});
