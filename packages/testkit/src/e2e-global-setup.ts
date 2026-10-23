import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function compose(customer: string, args: string[]) {
  const appPort = Number(process.env.E2E_APP_PORT);
  const res = spawnSync(
    'docker',
    ['compose', '-p', `cde-e2e-${customer}`, '-f', 'docker/compose.base.yml', '-f', `customers/${customer}/compose.override.yml`, ...args],
    { cwd: root, stdio: 'inherit', env: { ...process.env, APP_PORT: String(appPort), DB_PORT: String(appPort - 3000 + 2000) } },
  );
  if (res.status !== 0) throw new Error(`docker compose ${args.join(' ')} failed`);
}

/** Fresh stack per run (empty volume → migrations + seed), torn down afterwards unless E2E_KEEP=1. */
export default async function globalSetup() {
  const customer = process.env.CUSTOMER ?? 'acme';
  compose(customer, ['down', '-v', '--remove-orphans']);
  compose(customer, ['up', '--build', '-d', '--wait']);
  return async () => {
    if (!process.env.E2E_KEEP) compose(customer, ['down', '-v']);
  };
}
