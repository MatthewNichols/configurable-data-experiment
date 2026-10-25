import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCustomer, generateClient, prisma, repoRoot } from '../src/index.ts';
import { compose, composeArgs } from '../src/compose.ts';

/**
 * `cde dump` end to end, run through `yarn cde` exactly as an operator would, against a throwaway
 * db-only stack (cde-test-dump-acme on a free port) so the demo stacks are never touched.
 */
const customer = 'acme';
const project = 'cde-test-dump-acme';
const outDir = path.join(repoRoot, '.cde-test', 'dump-acme');

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });

const cde = (...args: string[]) => spawnSync('yarn', ['cde', ...args], { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024 });

let dbPort: number;
const dbUrl = (db: string) => `postgresql://cde:cde@localhost:${dbPort}/${db}`;

async function query<T = any>(db: string, sql: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: dbUrl(db) });
  await client.connect();
  try {
    return (await client.query(sql)).rows;
  } finally {
    await client.end();
  }
}

/** row count of every table in the public schema */
async function rowCounts(db: string): Promise<Record<string, number>> {
  const tables = await query<{ t: string }>(db, `select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`);
  const counts: Record<string, number> = {};
  for (const { t } of tables) counts[t] = Number((await query(db, `select count(*) from "${t}"`))[0].count);
  return counts;
}

beforeAll(async () => {
  dbPort = await freePort();
  const env = { DB_PORT: String(dbPort) };
  compose({ customer, project, env }, ['down', '-v', '--remove-orphans'], 'pipe');
  compose({ customer, project, env }, ['up', '-d', '--wait', 'db'], 'pipe');

  const b = await buildCustomer(customer, { outDir });
  generateClient(b);
  prisma(b, ['migrate', 'deploy'], { DATABASE_URL: dbUrl('cde') });
  const seed = spawnSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(outDir, 'main.ts'), 'seed'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: dbUrl('cde') },
  });
  if (seed.status !== 0) throw new Error(`seed failed:\n${seed.stderr}`);
  mkdirSync(outDir, { recursive: true });
});

afterAll(() => {
  compose({ customer, project }, ['down', '-v'], 'pipe');
  rmSync(outDir, { recursive: true, force: true });
});

describe('cde dump', () => {
  it('streams a custom-format dump on stdout that restores to the same data', async () => {
    const res = cde('dump', customer, '--project', project);
    expect(res.status, res.stderr.toString()).toBe(0);
    // custom-format dumps start with this magic; anything else (yarn/log noise) would corrupt the stream
    expect(res.stdout.subarray(0, 5).toString()).toBe('PGDMP');

    await query('cde', 'drop database if exists restore_check');
    await query('cde', 'create database restore_check');
    const restore = spawnSync('docker', [...composeArgs({ customer, project }), 'exec', '-T', 'db', 'pg_restore', '-U', 'cde', '-d', 'restore_check', '--no-owner'], {
      cwd: repoRoot,
      input: res.stdout,
    });
    expect(restore.status, restore.stderr.toString()).toBe(0);

    const original = await rowCounts('cde');
    expect(original.Customer).toBeGreaterThan(0);
    expect(await rowCounts('restore_check')).toEqual(original);
  });

  it('streams plain SQL with --format plain', () => {
    const res = cde('dump', customer, '--project', project, '--format', 'plain');
    expect(res.status, res.stderr.toString()).toBe(0);
    expect(res.stdout.toString()).toMatch(/^--\n-- PostgreSQL database dump/);
  });

  it('writes an owner-only file with --out', () => {
    const file = path.join(outDir, 'acme.dump');
    const res = cde('dump', customer, '--project', project, '--out', file);
    expect(res.status, res.stderr.toString()).toBe(0);
    expect(res.stdout.length).toBe(0);
    expect(readFileSync(file).subarray(0, 5).toString()).toBe('PGDMP');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(existsSync(`${file}.partial`)).toBe(false);
  });

  it('fails without leaving a file when the stack is not running', () => {
    const file = path.join(outDir, 'missing.dump');
    const res = cde('dump', customer, '--project', 'cde-test-dump-not-running', '--out', file);
    expect(res.status).not.toBe(0);
    expect(existsSync(file)).toBe(false);
    expect(existsSync(`${file}.partial`)).toBe(false);
  });

  it('rejects an unknown --format', () => {
    const res = cde('dump', customer, '--project', project, '--format', 'tar');
    expect(res.status).not.toBe(0);
    expect(res.stdout.length).toBe(0);
  });
});
