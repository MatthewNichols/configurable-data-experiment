import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { buildCustomer, bundleServer, customerDir, generateClient, prisma, repoRoot, runSql } from '../src/index.ts';

/**
 * Production-path check: each customer's server compiled with `--bundle` runs on plain `node`
 * (no tsx) against its committed migrations — the same steps as docker/migrate.sh + the image CMD.
 */
const customers = readdirSync(path.join(repoRoot, 'customers')).filter((c) => existsSync(path.join(customerDir(c), 'customer.config.ts')));

let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
});
afterAll(() => container?.stop());

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });

describe.each(customers)('%s bundled server', (name) => {
  const outDir = path.join(repoRoot, '.cde-test', `bundle-${name}`);
  let entry: string;
  let databaseUrl: string;
  let server: ChildProcess | undefined;
  let output = '';

  beforeAll(async () => {
    const b = await buildCustomer(name, { outDir });
    generateClient(b);
    entry = await bundleServer(b);

    await runSql(container.getConnectionUri(), `create database "bundle_${name}"`);
    const url = new URL(container.getConnectionUri());
    url.pathname = `/bundle_${name}`;
    databaseUrl = url.toString();
    prisma(b, ['migrate', 'deploy'], { DATABASE_URL: databaseUrl });
  });
  afterAll(() => {
    server?.kill();
    rmSync(outDir, { recursive: true, force: true });
  });

  it('seeds with node', () => {
    const res = spawnSync('node', [entry, 'seed'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: databaseUrl } });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/Seeded demo data|No seed\.ts/);
  });

  it('serves the API with node', async () => {
    const port = await freePort();
    server = spawn('node', [entry, 'serve'], { env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port) } });
    server.stdout!.on('data', (d) => (output += d));
    server.stderr!.on('data', (d) => (output += d));

    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 15_000;
    let health: Response | undefined;
    while (Date.now() < deadline && server.exitCode === null) {
      health = await fetch(`${base}/api/health`).catch(() => undefined);
      if (health?.ok) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(health?.ok, `server did not become healthy:\n${output}`).toBe(true);
    expect(await health!.json()).toMatchObject({ ok: true, customer: name });

    const meta = await (await fetch(`${base}/api/meta`)).json();
    for (const entity of meta.entityOrder) {
      const res = await fetch(`${base}/api/${meta.entities[entity].path}`);
      expect(res.status, `GET /api/${meta.entities[entity].path}`).toBe(200);
    }
  });
});
