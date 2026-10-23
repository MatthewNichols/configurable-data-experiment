import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { buildCustomer, generateClient, loadCustomer, pushSchema, repoRoot } from '@cde/assembler';
import type { CustomerConfig, EntityRecord, Registry } from '@cde/sdk';

export interface TestInstallOptions {
  /** an existing customer folder name, e.g. 'acme' */
  customer?: string;
  /** or an ad-hoc install with just these modules (package names or absolute paths) */
  modules?: string[];
  config?: Partial<CustomerConfig>;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

export interface TestInstall {
  url: string;
  databaseUrl: string;
  registry: Registry;
  /** the in-process install (service layer, prisma, kysely) */
  install: any;
  api: {
    get<T = any>(p: string): Promise<ApiResponse<T>>;
    post<T = any>(p: string, body: unknown): Promise<ApiResponse<T>>;
    put<T = any>(p: string, body: unknown): Promise<ApiResponse<T>>;
    del<T = any>(p: string): Promise<ApiResponse<T>>;
  };
  /** POST that throws unless 201 */
  create(entityPath: string, body: unknown): Promise<EntityRecord>;
  stop(): Promise<void>;
}

/**
 * Assembles an install (an existing customer, or a minimal one with just the given modules),
 * generates its Prisma client, starts a throwaway Postgres with Testcontainers, pushes the
 * schema and starts the API on a random port.
 */
export async function startTestInstall(opts: TestInstallOptions = {}): Promise<TestInstall> {
  const loaded = opts.customer
    ? await loadCustomer(opts.customer)
    : await loadCustomer({
        dir: repoRoot,
        config: { name: 'test', title: 'Test install', modules: opts.modules ?? [], ...opts.config },
      });
  const outDir = path.join(repoRoot, '.cde-test', `${loaded.config.name}-${randomUUID().slice(0, 8)}`);
  const build = await buildCustomer(loaded, { outDir });
  generateClient(build);

  let container: StartedPostgreSqlContainer | undefined;
  try {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const databaseUrl = container.getConnectionUri();
    await pushSchema(build, databaseUrl);

    const { install: createInstall } = await import(pathToFileURL(path.join(outDir, 'install.ts')).href);
    const install = await createInstall(databaseUrl);
    const server = install.app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const call = async (method: string, p: string, body?: unknown): Promise<ApiResponse> => {
      const res = await fetch(url + p, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : undefined };
    };
    const api = {
      get: (p: string) => call('GET', p),
      post: (p: string, b: unknown) => call('POST', p, b),
      put: (p: string, b: unknown) => call('PUT', p, b),
      del: (p: string) => call('DELETE', p),
    } as TestInstall['api'];

    return {
      url,
      databaseUrl,
      registry: build.registry,
      install,
      api,
      async create(entityPath, body) {
        const res = await api.post(`/api/${entityPath}`, body);
        if (res.status !== 201) throw new Error(`create ${entityPath} failed: ${res.status} ${JSON.stringify(res.body)}`);
        return res.body;
      },
      async stop() {
        await new Promise((r) => server.close(r));
        await install.close();
        await container?.stop();
        rmSync(outDir, { recursive: true, force: true });
      },
    };
  } catch (err) {
    await container?.stop();
    rmSync(outDir, { recursive: true, force: true });
    throw err;
  }
}

/** Valid sample input for any registry entity, honouring field types (used by tests and e2e). */
export { sampleValue } from './samples.ts';
