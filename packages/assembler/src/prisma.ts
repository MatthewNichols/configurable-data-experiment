import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { prismaBin, type BuildResult } from './build.ts';
import { PRE_SQL } from './sql.ts';

export function prisma(build: BuildResult, args: string[], env: Record<string, string> = {}) {
  const res = spawnSync(prismaBin, [...args, '--config', path.join(build.outDir, 'prisma.config.ts')], {
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1', ...env },
  });
  if (res.status !== 0) throw new Error(`prisma ${args.join(' ')} failed:\n${res.stdout}\n${res.stderr}`);
  return res.stdout;
}

export function generateClient(build: BuildResult) {
  return prisma(build, ['generate']);
}

/** DDL for the assembled schema from scratch (read-only Prisma command; no database needed). */
export function schemaSql(build: BuildResult): string {
  return prisma(build, ['migrate', 'diff', '--from-empty', '--to-schema', path.join(build.outDir, 'prisma'), '--script']);
}

/**
 * Tests / throwaway DBs: create the schema on an *empty* database without a migration
 * history (pre SQL + Prisma-generated DDL + idempotent extras).
 */
export async function pushSchema(build: BuildResult, databaseUrl: string) {
  await runSql(databaseUrl, PRE_SQL + schemaSql(build) + build.extras);
}

export async function runSql(databaseUrl: string, sql: string) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

const HASH_FILE = 'cde-extras.sha256';

/**
 * Creates a new migration for a customer:
 *  1. `prisma migrate dev --create-only` against a throwaway Postgres (Testcontainers)
 *  2. appends the idempotent extras SQL whenever the schema or the extras changed
 * Migrations are committed in customers/<name>/prisma/migrations.
 */
export async function createMigration(build: BuildResult, name: string): Promise<string | undefined> {
  const dir = path.join(build.customer.dir, 'prisma', 'migrations');
  mkdirSync(dir, { recursive: true });
  const before = new Set(readdirSync(dir));
  const lastHash = existsSync(path.join(dir, HASH_FILE)) ? readFileSync(path.join(dir, HASH_FILE), 'utf8').trim() : '';

  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  try {
    prisma(build, ['migrate', 'dev', '--create-only', '--name', name], { DATABASE_URL: container.getConnectionUri() });
  } finally {
    await container.stop();
  }

  let created = readdirSync(dir).find((d) => !before.has(d));
  const isEmpty = (d: string) => readFileSync(path.join(dir, d, 'migration.sql'), 'utf8').replace(/--.*$/gm, '').trim() === '';
  if (created && isEmpty(created) && lastHash === build.extrasHash) {
    rmSync(path.join(dir, created), { recursive: true });
    created = undefined;
  }
  if (!created && lastHash === build.extrasHash) return undefined;
  if (!created) {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    created = `${stamp}_${name}`;
    mkdirSync(path.join(dir, created));
    writeFileSync(path.join(dir, created, 'migration.sql'), '');
  }
  const file = path.join(dir, created, 'migration.sql');
  const body = readFileSync(file, 'utf8');
  writeFileSync(file, (body.includes(PRE_SQL) ? '' : PRE_SQL + '\n') + body + '\n' + build.extras);
  writeFileSync(path.join(dir, HASH_FILE), build.extrasHash + '\n');
  return created;
}
