import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Project } from '@playwright/test';

/**
 * E2E for one customer install (CUSTOMER=acme). Run via `yarn test:e2e acme`, which assembles
 * the customer first. Global setup starts a *separate* compose project (cde-e2e-<customer>) on
 * offset ports so demo stacks are never touched; set E2E_BASE_URL to target a running stack.
 */
const customer = process.env.CUSTOMER ?? 'acme';
const root = path.dirname(new URL(import.meta.url).pathname);
const registryFile = path.join(root, 'customers', customer, '.cde', 'registry.json');
if (!existsSync(registryFile)) throw new Error(`Run \`yarn cde build ${customer}\` first (or use \`yarn test:e2e ${customer}\`)`);
const registry = JSON.parse(readFileSync(registryFile, 'utf8'));
process.env.CDE_REGISTRY = registryFile;

const override = readFileSync(path.join(root, 'customers', customer, 'compose.override.yml'), 'utf8');
const appPort = Number(/APP_PORT:-(\d+)/.exec(override)?.[1] ?? 8080) + 100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${appPort}`;
process.env.E2E_APP_PORT = String(appPort);

// module specs travel with the module: modules/<m>/e2e or customers/<c>/modules/<m>/e2e
const moduleProjects: Project[] = [];
const listDirs = (dir: string) => (existsSync(dir) ? readdirSync(dir).map((d) => path.join(dir, d)) : []);
const manifests = [...listDirs(path.join(root, 'modules')), ...listDirs(path.join(root, 'customers', customer, 'modules'))];
for (const dir of manifests) {
  const src = existsSync(path.join(dir, 'cde.module.ts')) ? readFileSync(path.join(dir, 'cde.module.ts'), 'utf8') : '';
  const name = /name:\s*'([^']+)'/.exec(src)?.[1];
  if (name && registry.modules.some((m: { name: string }) => m.name === name) && existsSync(path.join(dir, 'e2e')))
    moduleProjects.push({ name: `module:${name}`, testDir: path.join(dir, 'e2e') });
}

export default defineConfig({
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/${customer}` }]],
  outputDir: `test-results/${customer}`,
  globalSetup: process.env.E2E_BASE_URL ? undefined : './packages/testkit/src/e2e-global-setup.ts',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'shared', testDir: './packages/testkit/e2e' },
    ...moduleProjects,
    ...(existsSync(path.join(root, 'customers', customer, 'e2e')) ? [{ name: `customer:${customer}`, testDir: `./customers/${customer}/e2e` }] : []),
  ],
});
