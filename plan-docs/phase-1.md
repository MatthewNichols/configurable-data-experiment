# Plan: Configurable-data POC (Node/Express/Prisma/Vue/Postgres)

## Context
The repo is empty apart from a README. The goal is a POC showing that one core app (entities **Customer** and **Car**) can be installed per customer (single-tenant, one install each) and extended with extra data, UI and search **without forking the core**. Per-customer code (backend, frontend, tests) is allowed, as long as it plugs in through a defined contract. Docker Compose packages each customer's build.

Decisions so far:
- Customizations are made by **developers at build/deploy time** for the POC. The design should leave room for runtime admin-defined fields later (the JSONB path makes this possible).
- **Hybrid storage:** declared "simple" fields go in a JSONB `ext` column on the core tables; code modules can also ship their own Prisma models/tables.
- **Express + Prisma**, TypeScript throughout. Zod for validation, `prisma-json-types-generator` for typing JSONB, and **Kysely via `prisma-extension-kysely`** for dynamic search SQL, which Prisma's query API handles poorly.
- **Search uses Postgres only** (generated filters, `tsvector` full-text, `pg_trgm`).
- **Monorepo** (Yarn 1.22 workspaces) with a `customers/` folder. **PrimeVue** for UI.

## Status (2026-10-20): all milestones done
- Three installs are running and tested: `bare`, `acme` and `globex`. Vitest: 24 tests. Playwright: 6 for bare, 12 for acme, 10 for globex.
- What changed from the plan below, and why, is in [docs/findings.md](../docs/findings.md). In short:
  - Yarn 1.22 instead of Yarn 4. Testcontainers 11 instead of 12. PrimeVue 4.5 instead of 5. Prisma 7.10.
  - The assembler emits `ext-types.ts` itself instead of using `prisma-json-types-generator`.
  - Kysely runs on its own pool instead of through `prisma-extension-kysely`.
  - Ext equality filters use JSONB containment with the GIN index instead of expression indexes, because Prisma treats expression indexes as drift.
  - Tests build databases from `migrate diff --script` instead of `db push`.
- Instructions for running the demo and the commands are in the [README](../README.md).

## Core idea: one contract, a metadata registry, assembled at build time
Every extension is a **module**: an npm workspace package that default-exports a `defineModule({...})` manifest from `@cde/sdk`. A **customer** is just a config that lists the modules it uses plus its own local modules. At build time a small **assembler** script reads the customer config and:
1. Merges the core and module **Prisma schema fragments** into one schema folder (Prisma multi-file schema, `prismaSchemaFolder`). It then runs `prisma generate` and applies migrations.
2. Generates a **server module index** (static imports of each module's server entry).
3. Generates a **web module index** (a Vite virtual module `virtual:cde-modules`).
4. Produces a merged **metadata registry** JSON (entities → fields → UI/search hints).

Nothing is discovered at runtime. Everything is static imports, so the bundles stay type-checked and tree-shaken, and each customer's Docker image is immutable and reproducible.

## Repo layout
```
packages/
  sdk/            # @cde/sdk – types + defineModule/defineField/defineEntityExtension, zero runtime deps
  core-server/    # Express app, Prisma core schema, registry, generic CRUD + search
  core-web/       # Vue 3 + PrimeVue shell, metadata-driven forms/grids/filters, slot registry
  assembler/      # CLI: `cde build --customer acme` → generated/ for server + web + prisma
  testkit/        # helpers: spin up app against a customer config, factories honoring ext fields
modules/          # reusable optional modules shared across customers
  service-history/   # code module: own table ServiceRecord (Car 1-n), API routes, Car tab UI
  loyalty/           # declarative-only: ext fields on Customer (tier, points)
customers/
  acme/           # customer.config.ts, local-modules/, tests/, compose.override.yml, migrations/
  globex/         # second customer, different module set, proves isolation
docker/
  Dockerfile      # multi-stage, ARG CUSTOMER=acme → runs assembler, builds server+web
  compose.base.yml
```

## The module contract (`@cde/sdk`)
```ts
defineModule({
  name: 'loyalty',
  extends: {
    Customer: {
      fields: {
        tier:   { type: 'enum', values: ['bronze','silver','gold'], label: 'Tier', searchable: 'filter', list: true },
        points: { type: 'int', min: 0, searchable: 'range' },
      },
    },
  },
  prisma?: './schema/*.prisma',          // optional own models (code modules)
  server?: () => import('./server'),     // optional: (ctx) => { router, hooks }
  web?:    () => import('./web'),        // optional: components for named slots, routes
  migrations?: './sql/*.sql',            // optional raw SQL (GIN/expression indexes, triggers)
});
```
- **Field types** (POC set): string, text, int, decimal, bool, date, enum, reference (to an entity id). Each type maps to a Zod schema, a PrimeVue editor component, a list renderer and a search operator set. A **field-type registry** lives in the SDK, so modules can register new types too.
- **Server hooks:** `beforeValidate`, `beforeSave`, `afterSave` and `beforeDelete` per entity. Hooks also get `extendSearch(qb, params)` and `extendSerialize(entity)` so a code module can inject joins or computed fields. Server entries also get `ctx = { prisma, kysely, registry, logger }` and may mount an Express router under `/api/modules/<name>`.
- **Web contributions:** components for **named slots** (`customer.detail.tabs`, `car.detail.sidebar`, `customer.list.actions`, …), additional routes, and override renderers for specific fields. The core web app renders `<ModuleSlot name="car.detail.tabs" :entity="car"/>`.
- **Namespacing:** each module's ext keys are stored as `ext.<module>.<field>`, so two modules can't collide. The assembler fails the build on any collision or invalid manifest.

## Data layer
- Core Prisma models `Customer` and `Car` (Customer 1-n Car) have typed core columns plus `ext Json @default("{}")` with a GIN index.
- `prisma-json-types-generator` gives `ext` a generated TS type built from the merged registry (the assembler emits `ext-types.d.ts`).
- Validation: the registry builds a Zod schema per entity (core + ext), used by the API and shared with the web app for client-side form validation.
- Code-module tables (for example `ServiceRecord`) are normal Prisma models in the module's `.prisma` fragment. They relate to core models and can extend them with relation fields, because multi-file schema allows this.
- **Migrations:** each **customer owns its migration history** (`customers/acme/migrations/`), generated with `prisma migrate dev` against that customer's assembled schema. A core or module upgrade means re-running the assembler and creating a new migration in each customer folder. This is the main trade-off of using Prisma; the POC will evaluate it. Module `sql/` files (expression indexes on `ext->>'tier'`, `tsvector` triggers) are added into the generated migration by the assembler.

## Search
- `GET /api/customers?q=...&filter[loyalty.tier]=gold&filter[core.lastName][like]=smi&sort=...`
- A generic search builder in core-server uses Kysely. It reads the registry to see which fields are filterable and with which operators, then maps each one to a core column or to `ext->'loyalty'->>'tier'` with the correct cast.
- Full-text: a generated `search_vector` column, maintained by a trigger that the assembler produces from fields marked `searchable: 'text'`, plus `pg_trgm` for fuzzy name search.
- The web app builds its filter panel and DataTable columns from the same registry (`GET /api/meta`).
- Code modules can add joins or filters through the `extendSearch` hook (for example "cars with service due").

## Frontend (core-web)
- Vue 3 + Vite + PrimeVue + Pinia + vue-router.
- `GET /api/meta` (the registry) drives `<EntityList>` (PrimeVue DataTable, columns and filters), `<EntityForm>` (core and ext fields grouped into sections) and `<EntityDetail>` (tabs, including slot contributions).
- `virtual:cde-modules` is created by a Vite plugin in the assembler. It imports each module's `web` entry and registers its slot components, routes and custom field renderers before the app mounts.
- Customer theming and branding live in `customers/<x>/web/theme.ts`, as PrimeVue preset overrides.

## Packaging and testing
- `docker/Dockerfile` is multi-stage with `ARG CUSTOMER`: install → `cde build --customer $CUSTOMER` → build server and web → slim runtime image (the server also serves the static web build).
- `compose.base.yml` has postgres + app + a migrate job. `customers/<x>/compose.override.yml` sets the build arg, env and seed data. Run with `docker compose -f docker/compose.base.yml -f customers/acme/compose.override.yml up`.
- Each customer's Postgres publishes a distinct host port (acme 5433, globex 5434) so stacks can run side by side. No local Postgres install is needed.
- Tooling: **Vite** (web build and the `virtual:cde-modules` plugin), **Vitest** (unit and integration), **Testcontainers** (throwaway Postgres for integration tests), **Playwright** (e2e).
- Tests. **E2E is first-class.** Every milestone ships with Playwright specs, not just unit tests.
  - **Core:** Vitest unit tests (registry, Zod generation, search builder SQL). Vitest integration tests run the API against a Testcontainers Postgres migrated with the "bare" customer schema (no modules).
  - **Module:** each module has its own Vitest tests, run through `@cde/testkit`. Testkit assembles a minimal customer config containing just that module and starts a Testcontainers Postgres for it. Module-provided Playwright specs, for example "Service History tab appears and saves a record", can be reused by any customer that includes the module.
  - **Customer e2e:** `customers/<x>/e2e/` holds Playwright specs run against that customer's full compose stack: the built image plus Postgres plus seed data. A Playwright `globalSetup` runs `docker compose up --wait`, with teardown removing volumes. Each spec file gets its own data so tests are independent of each other.
  - **Shared e2e suite:** `packages/testkit/e2e/` contains registry-driven specs that run against **every** customer: for each entity, create → edit every ext field → search by each filterable field → delete. These specs read `/api/meta`, so they cover each customer's custom fields with no extra code.
  - **CI:** a matrix over customers (`_bare`, `acme`, `globex`). Each job runs Vitest, then the shared and customer Playwright suites against that customer's compose stack, so a core change is verified against every install.
  - **Contract tests:** the assembler validates manifests, and a snapshot of the generated registry per customer catches accidental changes.

## Build order (milestones)
1. **Skeleton:** Yarn workspace, TS config, `@cde/sdk` types, core-server with Prisma Customer/Car and plain CRUD, compose with postgres. Bare customer `customers/bare`. Test harness in place from day one: Vitest + Testcontainers integration test, and Playwright `globalSetup` against the compose stack with a first CRUD e2e spec.
2. **Registry and JSONB ext:** `defineModule` with declarative fields, assembler v1 (registry + server index), Zod validation, the `loyalty` module, and `acme` using it.
3. **Metadata UI:** core-web with `/api/meta`-driven list, form and detail. Ext fields appear automatically.
4. **Search:** Kysely search builder over core and ext fields, full-text vector trigger, filter panel.
5. **Code module:** `service-history` with its own Prisma fragment, migration, router, `extendSearch` and a Car tab slot component. Covers per-customer migrations.
6. **Second customer:** `globex` with a different module set, a local customer-only module, a theme override and its own tests. CI matrix.
7. **Write-up:** `docs/` notes on trade-offs found (Prisma migrate per customer, JSONB vs. table, upgrade story) and next steps toward runtime admin-defined fields (field definitions stored in a DB table that feeds the same registry, using the JSONB storage path).

## Critical files to create
- `packages/sdk/src/index.ts`: the module contract (the most important artifact)
- `packages/assembler/src/build.ts`: schema/index/registry generation
- `packages/core-server/src/registry.ts`, `src/search/builder.ts`, `src/crud/entityRouter.ts`
- `packages/core-web/src/components/{EntityList,EntityForm,ModuleSlot}.vue`
- `customers/acme/customer.config.ts`, `docker/Dockerfile`, `docker/compose.base.yml`

## Verification
- `yarn cde build --customer acme && docker compose -f docker/compose.base.yml -f customers/acme/compose.override.yml up --build`. Then open the UI: Customer shows the Loyalty fields, Car shows the Service History tab, and filtering by tier works.
- Do the same for `globex`. Confirm it lacks the acme modules, its schema has no `ServiceRecord` table (if it doesn't use that module), and its UI differs.
- `yarn test` runs core, module and testkit Vitest suites; Testcontainers starts Postgres automatically.
- `yarn test:e2e --customer acme` brings up the acme compose stack and runs the shared registry-driven Playwright suite plus acme's own specs.
- Negative check: two modules declaring the same ext key, or an invalid field type, makes `cde build` fail with a clear error.
