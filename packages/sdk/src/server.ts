import type { Router } from 'express';
import type { Kysely, SelectQueryBuilder } from 'kysely';
import type { EntityRecord, Registry, RegistryEntity } from './registry.ts';
import type { FieldErrors } from './validation.ts';

export interface SaveContext {
  op: 'create' | 'update';
  entity: RegistryEntity;
  /** Validated input; hooks may mutate it before it is persisted. */
  input: Record<string, unknown> & { ext: Record<string, Record<string, unknown>> };
  existing?: EntityRecord;
}

export type SearchExtension = (
  qb: SelectQueryBuilder<any, any, any>,
  /** this module's filter values, e.g. { serviceDue: 'true' } */
  filters: Record<string, unknown>,
  ctx: { entity: RegistryEntity; db: Kysely<any> },
) => SelectQueryBuilder<any, any, any>;

export interface Logger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export interface ServerContext {
  module: string;
  registry: Registry;
  /**
   * The install's generated Prisma client. Typed loosely because each customer build
   * generates its own client; modules may narrow it with a local interface.
   */
  prisma: any;
  db: Kysely<any>;
  /** Mounted at /api/modules/<module name> */
  router: Router;
  logger: Logger;
  hooks: {
    beforeSave(entity: string, fn: (ctx: SaveContext) => void | Promise<void>): void;
    afterSave(entity: string, fn: (record: EntityRecord, ctx: SaveContext) => void | Promise<void>): void;
    beforeDelete(entity: string, fn: (record: EntityRecord) => void | Promise<void>): void;
  };
  search: {
    extend(entity: string, fn: SearchExtension): void;
  };
  /** Populate `record.computed[module]` for list and detail responses (batched). */
  enrich(entity: string, fn: (records: EntityRecord[]) => void | Promise<void>): void;
}

export interface ServerModule {
  register(ctx: ServerContext): void | Promise<void>;
}

export function defineServerModule(mod: ServerModule): ServerModule {
  return mod;
}

/** Throw from hooks to reject a save with a 422 and per-field messages. */
export class ValidationError extends Error {
  readonly status = 422;
  constructor(
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}
