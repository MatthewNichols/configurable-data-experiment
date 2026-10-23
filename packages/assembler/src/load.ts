import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CustomerConfig, ModuleManifest } from '@cde/sdk';
import { customerDir } from './paths.ts';

export interface LoadedModule {
  manifest: ModuleManifest;
  /** directory containing cde.module.ts */
  dir: string;
  /** the reference used in the customer config */
  ref: string;
}

export interface LoadedCustomer {
  config: CustomerConfig;
  dir: string;
  modules: LoadedModule[];
}

const MANIFEST = 'cde.module.ts';

async function importDefault<T>(file: string): Promise<T> {
  const mod = await import(pathToFileURL(file).href);
  return (mod.default ?? mod) as T;
}

export function resolveModuleDir(ref: string, fromDir: string): string {
  if (ref.startsWith('.') || path.isAbsolute(ref)) return path.resolve(fromDir, ref);
  const require = createRequire(path.join(fromDir, 'noop.js'));
  return path.dirname(require.resolve(`${ref}/package.json`));
}

export async function loadModule(ref: string, fromDir: string): Promise<LoadedModule> {
  const dir = resolveModuleDir(ref, fromDir);
  const file = path.join(dir, MANIFEST);
  if (!existsSync(file)) throw new Error(`Module "${ref}" has no ${MANIFEST} (looked in ${dir})`);
  return { manifest: await importDefault<ModuleManifest>(file), dir, ref };
}

/** Loads a customer by folder name, or an in-memory config (used by @cde/testkit). */
export async function loadCustomer(nameOrConfig: string | { config: CustomerConfig; dir: string }): Promise<LoadedCustomer> {
  let config: CustomerConfig;
  let dir: string;
  if (typeof nameOrConfig === 'string') {
    dir = customerDir(nameOrConfig);
    const file = path.join(dir, 'customer.config.ts');
    if (!existsSync(file)) throw new Error(`No customer config at ${file}`);
    config = await importDefault<CustomerConfig>(file);
  } else {
    ({ config, dir } = nameOrConfig);
  }
  const modules = [];
  for (const ref of config.modules) modules.push(await loadModule(ref, dir));
  return { config, dir, modules };
}
