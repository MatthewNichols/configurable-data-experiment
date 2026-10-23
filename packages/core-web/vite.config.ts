import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { cdeCustomer } from '@cde/assembler/vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const customer = process.env.CDE_CUSTOMER;
if (!customer) throw new Error('Set CDE_CUSTOMER (e.g. CDE_CUSTOMER=acme) — or use `yarn cde web-build <customer>`');
const outDir = path.resolve(here, '../../customers', customer, '.cde');
if (!existsSync(path.join(outDir, 'web-modules.ts'))) throw new Error(`Run \`yarn cde build ${customer}\` first`);

export default defineConfig({
  root: here,
  plugins: [vue(), cdeCustomer({ outDir })],
  build: { outDir: path.join(outDir, 'web-dist'), emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 3000}` },
  },
});
