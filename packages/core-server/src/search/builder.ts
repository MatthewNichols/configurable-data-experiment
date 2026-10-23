import { sql, type Kysely, type RawBuilder, type SelectQueryBuilder } from 'kysely';
import type { RegistryEntity, RegistryField } from '@cde/sdk';
import type { SearchExtension } from '@cde/sdk/server';
import { HttpError } from '../errors.ts';

export interface SearchParams {
  q?: string;
  /** filter[key]=v | filter[key][op]=v */
  filter?: Record<string, unknown>;
  /** comma-separated ids (batched reference lookups) */
  ids?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SAFE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ident(name: string): string {
  if (!SAFE.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return name;
}

/** SQL expression for a stored field; ext paths become `t.ext #>> '{module,field}'` (matches generated expression indexes). */
export function fieldExpr(field: RegistryField): RawBuilder<unknown> {
  if (field.source === 'core') return sql.ref(`t.${ident(field.column!)}`);
  if (field.source !== 'ext') throw new HttpError(400, `Field ${field.key} is not stored and cannot be searched`);
  const [mod, key] = field.path!;
  const text = `(t.ext #>> '{${ident(mod)},${ident(key)}}')`;
  switch (field.type) {
    case 'int':
    case 'decimal':
      return sql.raw(`${text}::numeric`);
    case 'bool':
      return sql.raw(`${text}::boolean`);
    case 'date':
      return sql.raw(`${text}::date`);
    default:
      return sql.raw(text);
  }
}

function contains(field: RegistryField, value: unknown) {
  const [mod, key] = field.path!;
  return sql<boolean>`t.ext @> ${JSON.stringify({ [mod]: { [key]: value } })}::jsonb`;
}

function coerce(field: RegistryField, raw: unknown): unknown {
  const v = String(raw);
  switch (field.type) {
    case 'int':
    case 'decimal': {
      const n = Number(v);
      if (Number.isNaN(n)) throw new HttpError(400, `Filter ${field.key} expects a number`);
      return n;
    }
    case 'bool':
      return v === 'true' || v === '1';
    default:
      return v;
  }
}

/** `filter[x]=v` means eq; `filter[x][op]=v` picks the operator. */
function normaliseOps(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { eq: value };
}

export interface BuiltSearch {
  rows: SelectQueryBuilder<any, any, any>;
  count: SelectQueryBuilder<any, any, any>;
  page: number;
  pageSize: number;
}

export function buildSearch(
  db: Kysely<any>,
  entity: RegistryEntity,
  params: SearchParams,
  extensions: Map<string, SearchExtension> = new Map(),
): BuiltSearch {
  let qb: SelectQueryBuilder<any, any, any> = db.selectFrom(`${ident(entity.table)} as t`);
  const moduleFilters = new Map<string, Record<string, unknown>>();
  if (params.ids) {
    const ids = String(params.ids).split(',').filter((v) => /^[0-9a-f-]{36}$/i.test(v));
    qb = ids.length ? qb.where(sql<boolean>`t.id in (${sql.join(ids.map((id) => sql`${id}::uuid`))})`) : qb.where(sql<boolean>`false`);
  }

  for (const [key, value] of Object.entries(params.filter ?? {})) {
    if (value === '' || value === undefined) continue;
    const field = entity.fields.find((f) => f.key === key);
    if (field && field.operators.length) {
      for (const [op, raw] of Object.entries(normaliseOps(value))) {
        if (!field.operators.includes(op)) throw new HttpError(400, `Operator ${op} not allowed on ${key}`);
        const expr = fieldExpr(field);
        const cast = field.type === 'date' ? sql`::date` : sql``;
        switch (op) {
          case 'eq':
            // ext equality uses JSONB containment so the GIN (jsonb_path_ops) index applies
            qb = qb.where(field.source === 'ext' ? contains(field, coerce(field, raw)) : sql<boolean>`${expr} = ${coerce(field, raw)}${cast}`);
            break;
          case 'like':
            qb = qb.where(sql<boolean>`${expr} ilike ${'%' + String(raw) + '%'}`);
            break;
          case 'in': {
            const list = String(raw).split(',').filter(Boolean);
            if (list.length)
              qb = qb.where(
                field.source === 'ext'
                  ? sql<boolean>`(${sql.join(list.map((v) => contains(field, v)), sql` or `)})`
                  : sql<boolean>`${expr} in (${sql.join(list)})`,
              );
            break;
          }
          case 'gte':
            qb = qb.where(sql<boolean>`${expr} >= ${coerce(field, raw)}${cast}`);
            break;
          case 'lte':
            qb = qb.where(sql<boolean>`${expr} <= ${coerce(field, raw)}${cast}`);
            break;
        }
      }
      continue;
    }
    const filter = entity.filters.find((f) => f.key === key);
    if (filter) {
      const local = key.slice(filter.module.length + 1);
      if (!moduleFilters.has(filter.module)) moduleFilters.set(filter.module, {});
      moduleFilters.get(filter.module)![local] = value;
      continue;
    }
    throw new HttpError(400, `Unknown or non-filterable field: ${key}`);
  }

  for (const [mod, filters] of moduleFilters) {
    const ext = extensions.get(mod);
    if (!ext) throw new HttpError(400, `Module ${mod} declared filters but registered no search extension`);
    qb = ext(qb, filters, { entity, db });
  }

  const words = (params.q ?? '')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length) {
    const tsquery = words.map((w) => `${w}:*`).join(' & ');
    const q = words.join(' ');
    const fuzzy = entity.titleFields
      .map((k) => entity.fields.find((f) => f.key === k))
      .filter((f): f is RegistryField => !!f && f.source === 'core' && f.type === 'string')
      .map((f) => sql<boolean>`${q} <% ${sql.ref(`t.${ident(f.column!)}`)}`);
    qb = qb.where((eb) => eb.or([sql<boolean>`t."searchVector" @@ to_tsquery('simple', ${tsquery})`, ...fuzzy]));
  }

  const count = qb.select(sql<string>`count(*)`.as('count'));

  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 25));
  const coreCols = entity.fields.filter((f) => f.source === 'core').map((f) => `t.${ident(f.column!)}`);
  let rows = qb.select(['t.id', ...coreCols, 't.ext', 't.createdAt', 't.updatedAt'] as any);

  const order = params.order === 'asc' ? 'asc' : 'desc';
  if (params.sort && params.sort !== 'createdAt' && params.sort !== 'updatedAt') {
    const field = entity.fields.find((f) => f.key === params.sort);
    if (!field || field.source === 'computed') throw new HttpError(400, `Cannot sort by ${params.sort}`);
    rows = rows.orderBy(sql`${fieldExpr(field)} ${sql.raw(order)} nulls last`);
  } else {
    rows = rows.orderBy(sql.ref(`t.${params.sort ?? 'createdAt'}`), order);
  }
  rows = rows.orderBy('t.id').limit(pageSize).offset((page - 1) * pageSize);
  return { rows, count, page, pageSize };
}
