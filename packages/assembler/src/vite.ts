import path from 'node:path';
import type { Plugin } from 'vite';
import { repoRoot } from './paths.ts';

/**
 * Wires a customer build into the core web app: `virtual:cde-modules` resolves to the
 * generated static import list of that customer's web modules.
 */
export function cdeCustomer({ outDir }: { outDir: string }): Plugin {
  const target = path.join(outDir, 'web-modules.ts');
  return {
    name: 'cde-customer',
    enforce: 'pre',
    config: () => ({ server: { fs: { allow: [repoRoot] } } }),
    resolveId(id) {
      if (id === 'virtual:cde-modules') return target;
    },
  };
}
