import path from 'node:path';
import { build, type Plugin } from 'esbuild';
import type { BuildResult } from './build.ts';

/** Bundle workspace TS (@cde/*, modules, customer code, Prisma client); leave npm packages to node_modules. */
const externalizeNpm: Plugin = {
  name: 'externalize-npm',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith('@cde/') ? undefined : { external: true }));
  },
};

/** Compiles `.cde/main.ts` to plain JS (`.cde/main.mjs`) so production runs on `node` without tsx. */
export async function bundleServer(b: BuildResult): Promise<string> {
  const outfile = path.join(b.outDir, 'main.mjs');
  await build({
    entryPoints: [path.join(b.outDir, 'main.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: true,
    logLevel: 'warning',
    plugins: [externalizeNpm],
  });
  return outfile;
}
