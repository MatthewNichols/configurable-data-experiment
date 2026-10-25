#!/usr/bin/env tsx
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { buildCustomer } from './build.ts';
import { bundleServer } from './bundle.ts';
import { compose, composeToFd, customerPorts } from './compose.ts';
import { customersDir, repoRoot } from './paths.ts';
import { createMigration, generateClient, prisma } from './prisma.ts';
import { AssemblyError } from './registry.ts';

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Map<string, string | true>();
const positional: string[] = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) flags.set(a.slice(2), (i++, next));
    else flags.set(a.slice(2), true);
  } else positional.push(a);
}
const customer = (flags.get('customer') as string) ?? positional[0] ?? process.env.CUSTOMER;

const allCustomers = () =>
  readdirSync(customersDir).filter((d) => existsSync(path.join(customersDir, d, 'customer.config.ts')));

function need() {
  if (!customer) throw new Error(`Usage: cde ${cmd} <customer>   (customers: ${allCustomers().join(', ')})`);
  return customer;
}

/** compose target for up/down/dump; --project picks a stack other than the default cde-<customer> (tests use this) */
const target = () => ({ customer: need(), project: flags.get('project') as string | undefined });

function run(bin: string, args: string[], env: Record<string, string> = {}) {
  const res = spawnSync(bin, args, { stdio: 'inherit', cwd: repoRoot, env: { ...process.env, ...env } });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

async function build(name: string) {
  const b = await buildCustomer(name);
  generateClient(b);
  console.log(`✔ built ${name} → ${path.relative(repoRoot, b.outDir)} (${b.registry.modules.map((m) => m.name).join(', ') || 'no modules'})`);
  return b;
}

function webBuild(name: string) {
  run(path.join(repoRoot, 'node_modules/.bin/vite'), ['build', '--config', 'packages/core-web/vite.config.ts'], {
    CDE_CUSTOMER: name,
  });
}

const commands: Record<string, () => Promise<void>> = {
  /** assemble generated sources + Prisma client (--bundle: compile server to JS, --web: Vite bundle) */
  async build() {
    const b = await build(need());
    if (flags.has('bundle')) console.log(`✔ bundled server → ${path.relative(repoRoot, await bundleServer(b))}`);
    if (flags.has('web')) webBuild(need());
  },
  /** validate every customer config (fast, no codegen side effects beyond .cde/) */
  async check() {
    for (const c of allCustomers()) {
      await buildCustomer(c);
      console.log(`✔ ${c}`);
    }
  },
  async 'web-build'() {
    webBuild(need());
  },
  /** create a new migration for the customer from its assembled schema */
  async migrate() {
    const b = await build(need());
    const name = (flags.get('name') as string) ?? 'update';
    const created = await createMigration(b, name);
    console.log(created ? `✔ created migration ${created}` : '✔ no schema changes');
  },
  /** CI guard: fail if the customer's committed migrations don't match its assembled schema */
  async 'migrate-check'() {
    const b = await build(need());
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const pgc = await new PostgreSqlContainer('postgres:17-alpine').start();
    try {
      prisma(b, ['migrate', 'deploy'], { DATABASE_URL: pgc.getConnectionUri() });
      prisma(b, ['migrate', 'diff', '--from-config-datasource', '--to-schema', path.join(b.outDir, 'prisma'), '--exit-code'], {
        DATABASE_URL: pgc.getConnectionUri(),
      });
      console.log(`✔ ${b.customer.config.name} migrations are up to date`);
    } finally {
      await pgc.stop();
    }
  },
  /** run the customer's full stack in Docker */
  async up() {
    compose(target(), ['up', '--build', '-d', '--wait']);
    const { appPort } = customerPorts(need());
    console.log(`✔ ${need()} running at http://localhost:${appPort}`);
  },
  async down() {
    compose(target(), flags.has('volumes') ? ['down', '-v'] : ['down']);
  },
  /**
   * pg_dump of the customer's running database, executed inside its db container (no host client needed).
   * Streams to stdout (pipe it into age/gpg) unless --out <file>; --format custom (default, for pg_restore) | plain (SQL).
   */
  async dump() {
    const name = need();
    const format = (flags.get('format') as string) ?? 'custom';
    if (format !== 'custom' && format !== 'plain') throw new Error('--format must be custom or plain');
    const out = flags.get('out');
    if (out === true) throw new Error('--out needs a file path');
    if (!out && process.stdout.isTTY) throw new Error('Refusing to write a dump to the terminal: pipe it somewhere or use --out <file>');

    const args = ['exec', '-T', 'db', 'sh', '-c', `pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=${format}`];
    if (!out) {
      const status = composeToFd(target(), args, 1);
      if (status !== 0) throw new Error(`pg_dump failed (exit ${status}); is the ${name} stack running?`);
      return;
    }
    // write to a temp file and rename, so a failed dump never leaves a truncated file behind
    const file = path.resolve(out);
    const tmp = `${file}.partial`;
    const fd = openSync(tmp, 'w', 0o600);
    let status: number;
    try {
      status = composeToFd(target(), args, fd);
    } finally {
      closeSync(fd);
    }
    if (status !== 0) {
      rmSync(tmp, { force: true });
      throw new Error(`pg_dump failed (exit ${status}); is the ${name} stack running?`);
    }
    renameSync(tmp, file);
    console.error(`✔ dumped ${name} → ${file}`);
  },
  /** local dev: Postgres from compose, API with tsx watch, Vite dev server with HMR */
  async dev() {
    const name = need();
    const b = await build(name);
    const { dbPort } = customerPorts(name);
    compose({ customer: name }, ['up', '-d', '--wait', 'db']);
    const DATABASE_URL = `postgresql://cde:cde@localhost:${dbPort}/cde`;
    prisma(b, ['migrate', 'deploy'], { DATABASE_URL });
    run(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(b.outDir, 'main.ts'), 'seed'], { DATABASE_URL });
    const env = { ...process.env, DATABASE_URL, PORT: '3000', CDE_CUSTOMER: name };
    spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['watch', path.join(b.outDir, 'main.ts')], { stdio: 'inherit', env });
    spawn(path.join(repoRoot, 'node_modules/.bin/vite'), ['--config', 'packages/core-web/vite.config.ts'], {
      stdio: 'inherit',
      env,
      cwd: repoRoot,
    });
  },
  /** Playwright against the customer's compose stack (shared + module + customer specs) */
  async e2e() {
    const name = need();
    const extra = positional.slice(1);
    await buildCustomer(name); // registry.json drives test generation
    run(path.join(repoRoot, 'node_modules/.bin/playwright'), ['test', ...extra], { CUSTOMER: name });
  },
};

const fn = commands[cmd];
if (!fn) {
  console.log(`Usage: cde <${Object.keys(commands).join('|')}> <customer>`);
  process.exit(cmd ? 1 : 0);
}
try {
  await fn();
} catch (err) {
  console.error(err instanceof AssemblyError ? err.message : err);
  process.exit(1);
}
