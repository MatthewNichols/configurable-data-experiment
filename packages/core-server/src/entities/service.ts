import type { Kysely } from 'kysely';
import { entityInputSchema, type EntityRecord, type Registry, type RegistryEntity, type RegistryField } from '@cde/sdk';
import { ValidationError, type SaveContext } from '@cde/sdk/server';
import { HttpError } from '../errors.ts';
import type { ExtensionPoints } from '../extensions.ts';
import { buildSearch, type SearchParams } from '../search/builder.ts';

export interface ListResult {
  items: EntityRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

/** Column value → API value. Prisma gives Date / Decimal, Kysely gives strings; normalise both. */
function fromColumn(f: RegistryField, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (f.type === 'date') return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  if (f.type === 'decimal') return Number(v);
  return iso(v);
}

/** Generic CRUD + search for any registry entity. Prisma for writes/reads by id, Kysely for search. */
export class EntityService {
  private schemas = new Map<string, ReturnType<typeof entityInputSchema>>();

  constructor(
    private registry: Registry,
    private prisma: any,
    private db: Kysely<any>,
    private ext: ExtensionPoints,
  ) {}

  entity(name: string): RegistryEntity {
    const e = this.registry.entities[name];
    if (!e) throw new HttpError(404, `Unknown entity ${name}`);
    return e;
  }

  private schema(entity: RegistryEntity) {
    if (!this.schemas.has(entity.name)) this.schemas.set(entity.name, entityInputSchema(entity));
    return this.schemas.get(entity.name)!;
  }

  private delegate(entity: RegistryEntity) {
    return this.prisma[entity.delegate];
  }

  toRecord(entity: RegistryEntity, row: Record<string, unknown>): EntityRecord {
    const rec: EntityRecord = { id: String(row.id), ext: (row.ext as EntityRecord['ext']) ?? {}, computed: {} };
    for (const f of entity.fields) if (f.source === 'core') rec[f.key] = fromColumn(f, row[f.column!]);
    rec.createdAt = iso(row.createdAt) as string;
    rec.updatedAt = iso(row.updatedAt) as string;
    return rec;
  }

  async list(entityName: string, params: SearchParams): Promise<ListResult> {
    const entity = this.entity(entityName);
    const { rows, count, page, pageSize } = buildSearch(this.db, entity, params, this.ext.search.get(entity.name));
    const [data, [{ count: total }]] = await Promise.all([rows.execute(), count.execute()]);
    const items = data.map((r) => this.toRecord(entity, r));
    await this.ext.run('enrich', entity.name, items);
    return { items, total: Number(total), page, pageSize };
  }

  async get(entityName: string, id: string): Promise<EntityRecord> {
    const entity = this.entity(entityName);
    const row = await this.delegate(entity).findUnique({ where: { id } }).catch(() => null);
    if (!row) throw new HttpError(404, `${entity.label} ${id} not found`);
    const rec = this.toRecord(entity, row);
    await this.ext.run('enrich', entity.name, [rec]);
    return rec;
  }

  /**
   * ext references live in JSONB, and module-entity columns have no foreign key, so the
   * database cannot enforce them; check here. Core FK columns are left to the database.
   */
  private async checkReferences(entity: RegistryEntity, input: SaveContext['input']) {
    for (const f of entity.fields) {
      if (f.type !== 'reference' || f.source === 'computed' || (f.source === 'core' && !entity.module)) continue;
      const v = f.source === 'core' ? input[f.key] : input.ext?.[f.path![0]]?.[f.path![1]];
      if (!v) continue;
      const target = this.entity(f.ref!);
      const found = await this.delegate(target).findUnique({ where: { id: String(v) }, select: { id: true } });
      if (!found) throw new ValidationError('Validation failed', { [f.key]: `${target.label} not found` });
    }
  }

  /** Validated input → Prisma data: `date` columns need Date objects. */
  private toData(entity: RegistryEntity, input: SaveContext['input']) {
    const data: Record<string, unknown> = { ...input };
    for (const f of entity.fields)
      if (f.source === 'core' && f.type === 'date' && typeof data[f.key] === 'string') data[f.key] = new Date(`${data[f.key]}T00:00:00Z`);
    return data;
  }

  async create(entityName: string, body: unknown): Promise<EntityRecord> {
    const entity = this.entity(entityName);
    const input = this.schema(entity).parse(body) as SaveContext['input'];
    const ctx: SaveContext = { op: 'create', entity, input };
    await this.ext.run('beforeSave', entity.name, ctx);
    await this.checkReferences(entity, ctx.input);
    const row = await this.delegate(entity).create({ data: this.toData(entity, ctx.input) });
    const rec = await this.get(entity.name, row.id);
    await this.ext.run('afterSave', entity.name, rec, ctx);
    return rec;
  }

  async update(entityName: string, id: string, body: unknown): Promise<EntityRecord> {
    const entity = this.entity(entityName);
    const existing = await this.get(entity.name, id);
    const input = this.schema(entity).parse(body) as SaveContext['input'];
    // PUT replaces: optional core fields that were omitted are cleared...
    for (const f of entity.fields) if (f.source === 'core' && !(f.key in input)) input[f.key] = null;
    // ...but data of modules that are not (or no longer) installed is kept: only replace namespaces we know.
    input.ext = { ...existing.ext, ...input.ext };
    const ctx: SaveContext = { op: 'update', entity, input, existing };
    await this.ext.run('beforeSave', entity.name, ctx);
    await this.checkReferences(entity, ctx.input);
    await this.delegate(entity).update({ where: { id }, data: this.toData(entity, ctx.input) });
    const rec = await this.get(entity.name, id);
    await this.ext.run('afterSave', entity.name, rec, ctx);
    return rec;
  }

  async remove(entityName: string, id: string): Promise<void> {
    const entity = this.entity(entityName);
    const existing = await this.get(entity.name, id);
    await this.ext.run('beforeDelete', entity.name, existing);
    await this.delegate(entity).delete({ where: { id } });
  }
}
