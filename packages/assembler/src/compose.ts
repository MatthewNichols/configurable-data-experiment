import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { customerDir, repoRoot } from './paths.ts';

export interface ComposeTarget {
  customer: string;
  /** compose project name; e2e runs use a separate one so they never touch demo data */
  project?: string;
  env?: Record<string, string>;
}

export function composeArgs({ customer, project }: ComposeTarget): string[] {
  const override = path.join(customerDir(customer), 'compose.override.yml');
  if (!existsSync(override)) throw new Error(`Missing ${override}`);
  return ['compose', '-p', project ?? `cde-${customer}`, '-f', path.join(repoRoot, 'docker', 'compose.base.yml'), '-f', override];
}

export function compose(target: ComposeTarget, args: string[], stdio: 'inherit' | 'pipe' = 'inherit') {
  const res = spawnSync('docker', [...composeArgs(target), ...args], {
    stdio,
    encoding: 'utf8',
    cwd: repoRoot,
    env: { ...process.env, CUSTOMER: target.customer, ...target.env },
  });
  if (res.status !== 0) throw new Error(`docker compose ${args.join(' ')} failed (exit ${res.status})\n${res.stderr ?? ''}`);
  return res.stdout;
}

/** Like `compose`, but the command's stdout goes straight to `fd` (a file or the CLI's own stdout) — nothing is buffered. */
export function composeToFd(target: ComposeTarget, args: string[], fd: number): number {
  const res = spawnSync('docker', [...composeArgs(target), ...args], {
    stdio: ['ignore', fd, 'inherit'],
    cwd: repoRoot,
    env: { ...process.env, CUSTOMER: target.customer, ...target.env },
  });
  return res.status ?? 1;
}

/** Reads `x-cde: { appPort, dbPort }` from the customer's compose override. */
export function customerPorts(customer: string): { appPort: number; dbPort: number } {
  const text = readFileSync(path.join(customerDir(customer), 'compose.override.yml'), 'utf8');
  const app = /APP_PORT:-(\d+)/.exec(text)?.[1];
  const db = /DB_PORT:-(\d+)/.exec(text)?.[1];
  return { appPort: Number(app ?? 8080), dbPort: Number(db ?? 5433) };
}
