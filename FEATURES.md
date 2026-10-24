# Features

**Give every customer the app they asked for, while you keep maintaining one codebase.**

CDE is a Node + Vue platform where every customer install can add its own data, screens, search and business
rules, all without forking the core. You describe a field once and the platform turns it into storage,
validation, search, forms, list columns, TypeScript types and end-to-end tests.

> Status: proof of concept. Everything below is built and covered by tests; see
> [docs/findings.md](docs/findings.md) for the rough edges.

---

## Declare a field once, get the whole stack

```ts
export default defineModule({
  name: 'loyalty',
  extends: {
    Customer: {
      fields: {
        tier: { type: 'enum', values: ['bronze', 'silver', 'gold'], searchable: 'filter', list: true },
        points: { type: 'int', min: 0, searchable: 'range' },
      },
    },
  },
});
```

These few lines give you:

- **Storage.** The field lives in a namespaced JSONB column (`ext.loyalty.tier`), so no migration is needed
  and modules can't collide.
- **Validation.** One zod schema is generated from the registry and runs on both the server and the client.
- **Search.** You get equality and contains filters, `gte`/`lte` ranges, and full-text search through `?q=`.
  Equality filters on ext fields use a GIN index.
- **UI.** The field appears in the form, the detail page, the list grid and the filter bar, in the right
  section, with the right control for its type.
- **Types.** The assembler generates `ext-types.ts`, so ext data is typed in your code.
- **Tests.** The registry-driven Playwright suite picks up the new field automatically.

Supported types are `string`, `text`, `int`, `decimal`, `bool`, `date`, `enum` and `reference`.

## Escalate to code only when you need it

Declarative modules cover the common cases. When you need more, a code module can use the same contract:

| Need | Hook |
| --- | --- |
| Your own tables | `prismaSchema` fragments, with relation fields injected into core models |
| Views, triggers, raw SQL | `sql`: idempotent extras, tracked by hash |
| API endpoints | an Express router mounted at `/api/modules/<name>` |
| Business rules | `beforeSave` / `afterSave` / `beforeDelete` hooks; thrown `ValidationError`s show up as per-field form errors |
| Custom filters | `search.extend` with Kysely |
| Derived values | `enrich`, which adds batched computed fields to list and detail responses |
| UI | components for named slots (`Car.detail.tabs`, `app.dashboard`, `<Entity>.list.actions`…), field renderers and routes |

```ts
hooks.beforeSave('Car', ({ input, existing }) => {
  const before = existing?.ext.fleet?.odometer;
  if (before != null && input.ext.fleet?.odometer < before)
    throw new ValidationError('Validation failed', { 'fleet.odometer': `Odometer cannot go backwards (was ${before})` });
});
```

A customer's own module can even restyle a field that belongs to a *shared* module (for example, Acme's
`TierBadge` for `loyalty.tier`). You don't need to fork or patch the shared module.

## Per-customer installs that stay reproducible

- **`defineCustomer`** sets the title, theme, module list and entity relabelling (for example,
  Customer → Renter for Globex).
- **Assembled at build time.** `cde build` writes static imports and a registry, so nothing is discovered at
  runtime and every image is reproducible.
- **One Docker image and Compose stack per customer**, from a single `Dockerfile` with `ARG CUSTOMER`.
- **Theming** comes from PrimeVue presets, with primary and surface palettes set per customer.

## A UI generated from metadata, not hand-written per entity

The Vue app reads `GET /api/meta` at runtime and builds the dashboard, the list grids, the filter bar, the
forms and the detail pages from it.

- **Configurable grid columns.** Users can choose which fields appear in any grid and put them in the order
  they want, in a dialog with Shown and Available lists. The choice is saved per install and per entity.
  If it matches the defaults, nothing is stored, so columns a module adds later still show up.
- **Filter state lives in the URL**, so you can share and bookmark a filtered list.
- **Related records** show up as embedded tables on detail pages.
- **Reference fields** are resolved to readable titles, with lookups batched into one request per entity.

## Testing that grows with every install

- **The registry-driven e2e suite runs unchanged against every install.** It creates, views, edits, searches,
  filters and deletes every entity through the real UI, using whatever fields that install's modules add.
  It has already caught a real validation bug.
- **Module specs travel with the module**, so a module's e2e tests run for every install that uses it.
- **Testcontainers** gives you real Postgres for integration tests. No local database is needed.
- **E2E runs on an isolated compose project** on offset ports, so your demo stacks are never touched.
- **CI** runs a matrix over the customers, with migration drift checks and e2e.

## Developer experience

```bash
yarn cde up acme          # build + run a customer stack
yarn dev acme             # Postgres in Docker, API with tsx watch, Vite with hot reload
yarn cde migrate acme --name add-thing
yarn cde migrate-check acme
yarn test && yarn test:e2e acme
```

The stack is TypeScript from end to end: Express 5, Prisma 7, Kysely, Vue 3, PrimeVue 4 and Vite.

## Try it

```bash
yarn install
yarn cde up acme     # http://localhost:8081  (loyalty, service history, sales, emerald theme)
yarn cde up globex   # http://localhost:8082  (fleet rules, Renters, dashboard widget, amber theme)
yarn cde up bare     # http://localhost:8083  (core only, the baseline)
```

To write your first module, see the [README](README.md#writing-a-module).
