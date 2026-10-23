import type { EntityRecord } from '@cde/sdk';
import type { Install } from './app.ts';

export interface SeedApi {
  create(entity: string, data: Record<string, unknown>): Promise<EntityRecord>;
  prisma: any;
}

export type SeedFn = (api: SeedApi) => Promise<void>;

/** Runs a customer's seed through the normal service layer (validation + module hooks) if the DB is empty. */
export async function runSeed(install: Install, seed: SeedFn): Promise<boolean> {
  const first = install.registry.entityOrder[0];
  const { total } = await install.service.list(first, { pageSize: 1 });
  if (total > 0) return false;
  await seed({ create: (e, d) => install.service.create(e, d), prisma: install.prisma });
  return true;
}
