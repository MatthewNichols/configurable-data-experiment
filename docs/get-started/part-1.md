# Get started, part 1: a property management install

In this walkthrough you build a new install for a fictional customer, **Harbor Property Co.**, a company
that rents out apartments. By the end you will have:

- a new customer install running in Docker, with **Customers** renamed to **Tenants**
- a customer-only module, `property`, that adds two new entities with their own tables: **Units** and **Vendors**
- a dashboard widget that shows how many units are occupied, vacant, or being made ready

You won't touch any core code. Everything goes in `customers/harbor/`.

Part 2 picks up where this leaves off. The customer asks for a handful of small changes, and you make them
with extension fields (JSONB) instead of new tables.

> **Before you start:** you need Node 22+, Yarn, and Docker running. From the repo root, run `yarn install`
> once. You do **not** need Postgres installed. Everything database-related runs in containers.

---

## Step 1: Create the customer

A customer is a folder under `customers/` with two required files: a config that says which modules the install
uses, and a Compose override that gives the stack its own name and ports.

Create `customers/harbor/customer.config.ts`:

```ts
import { defineCustomer } from '@cde/sdk';

/** A residential property manager: units, vendors, and tenants (the core Customer, relabelled). */
export default defineCustomer({
  name: 'harbor',
  title: 'Harbor Property Co.',
  tagline: 'Property management',
  modules: [],
  theme: { primary: 'sky', surface: 'slate' },
  labels: { Customer: { label: 'Tenant', pluralLabel: 'Tenants' } },
});
```

`labels` is the only change you need to rename an entity. The table is still `Customer` and the API is still
`/api/customers`. Only what people see changes.

Create `customers/harbor/compose.override.yml`:

```yaml
# Harbor Property Co. install.
name: cde-harbor
services:
  db:
    ports: ["${DB_PORT:-5435}:5432"]
  migrate:
    build: { args: { CUSTOMER: harbor } }
    image: cde/harbor:latest
  app:
    build: { args: { CUSTOMER: harbor } }
    image: cde/harbor:latest
    ports: ["${APP_PORT:-8084}:3000"]
```

The demo installs already use ports 8081–8083 and 5432–5434, so Harbor gets 8084 and 5435.

Every install keeps its own migration history, so create its first migration:

```bash
yarn cde migrate harbor --name init
```

```
✔ built harbor → customers/harbor/.cde (no modules)
✔ created migration 20261026203009_init
```

That command assembled the install's schema (just the core for now), started a throwaway Postgres container,
and wrote the migration to `customers/harbor/prisma/migrations/`. Your timestamp will be different.

Now start it:

```bash
yarn cde up harbor
```

```
✔ harbor running at http://localhost:8084
```

Open http://localhost:8084. The sidebar shows **Tenants** and **Cars**. The tables are empty because Harbor
doesn't have a seed file yet. You'll add one in step 3.

> **Why are there Cars?** Customer and Car are the core entities, and every install has them. You can't
> remove a core entity, but you can give it a new purpose. For Harbor, a tenant's cars are the vehicles
> registered for parking permits. We'll leave the label as is for now.

---

## Step 2: Add a module with two new entities

Units and Vendors are real things in Harbor's business. They need their own rows, their own search, and
their own list and detail pages. That makes them **entities**, not extra fields on an existing entity.

A module declares entities in its manifest. The assembler gives each entity a real table, with one column per
field. It also gets the generic API, search, and list, form, and detail pages, just like the core entities.

Create `customers/harbor/modules/property/cde.module.ts`:

```ts
import { defineModule } from '@cde/sdk';

export default defineModule({
  name: 'property',
  label: 'Property',
  description: 'Rental units and the vendors who maintain them',
  entities: {
    Unit: {
      label: 'Unit',
      icon: 'pi pi-home',
      titleFields: ['building', 'unitNumber'],
      fields: {
        building: { type: 'string', label: 'Building', required: true, searchable: ['text', 'filter'], list: true },
        unitNumber: { type: 'string', label: 'Unit #', required: true, example: '2B', searchable: ['text', 'filter'], list: true },
        bedrooms: { type: 'int', label: 'Bedrooms', required: true, min: 0, max: 10, searchable: ['filter', 'range'], list: true },
        rent: { type: 'decimal', label: 'Monthly rent', required: true, min: 0, example: 1450, searchable: 'range', list: true },
        status: { type: 'enum', label: 'Status', required: true, values: ['vacant', 'occupied', 'make-ready'], searchable: 'filter', list: true },
        tenant: { type: 'reference', ref: 'Customer', label: 'Tenant', searchable: 'filter', list: true },
      },
    },
    Vendor: {
      label: 'Vendor',
      icon: 'pi pi-wrench',
      titleFields: ['name'],
      fields: {
        name: { type: 'string', label: 'Name', required: true, searchable: ['text', 'filter'], list: true },
        trade: { type: 'enum', label: 'Trade', required: true, values: ['plumbing', 'electrical', 'hvac', 'cleaning', 'general'], searchable: 'filter', list: true },
        phone: { type: 'string', label: 'Phone', list: true },
        email: { type: 'string', label: 'Email', searchable: 'text' },
        notes: { type: 'text', label: 'Notes', searchable: 'text' },
      },
    },
  },
});
```

Each field option controls one thing:

| Option | Effect |
| --- | --- |
| `required`, `min`, `max`, `values` | API validation, using the same rules the form shows |
| `searchable: 'text'` | included in the entity's full-text search box |
| `searchable: 'filter'` / `'range'` | adds a filter to the list page and `?filter[...]` to the API |
| `list: true` | shown as a column on the list page |
| `example` | placeholder text in the form, and the value the shared e2e suite types in (see step 5) |

Notice `tenant: { type: 'reference', ref: 'Customer' }`. You reference the entity by its **name**,
`Customer`, not its label. The form still shows a Tenant picker because the label comes from the customer config.

Now add the module to Harbor's config:

```ts
  modules: ['./modules/property'],
```

The schema changed, so create a migration for it:

```bash
yarn cde migrate harbor --name property
```

```
✔ built harbor → customers/harbor/.cde (property)
✔ created migration 20261026203044_property
```

Open the new `migration.sql` and take a look. It has `CREATE TABLE "Unit"` and `CREATE TABLE "Vendor"`, with
typed columns, an index on `tenant`, and the same `ext` and `searchVector` columns the core tables have.
You didn't write any of it.

Rebuild and restart:

```bash
yarn cde up harbor
```

Refresh the browser. **Units** and **Vendors** are now in the sidebar, each with a list page, filters, a
create form, and a detail page.

---

## Step 3: Seed some data

Clicking through empty pages gets old fast. A customer can have a `seed.ts` that fills a new install with
sample data.

Create `customers/harbor/seed.ts`:

```ts
import type { SeedApi } from '@cde/core-server';

export default async function seed({ create }: SeedApi) {
  const tenants = [];
  for (const [firstName, lastName] of [['Maya', 'Patel'], ['Jordan', 'Lee'], ['Sam', 'Okafor']]) {
    tenants.push(await create('Customer', { firstName, lastName, email: `${firstName.toLowerCase()}@example.net` }));
  }
  for (const [building, unitNumber, bedrooms, rent, status, tenant] of [
    ['Harbor View', '1A', 1, 1250, 'occupied', 0],
    ['Harbor View', '1B', 2, 1600, 'occupied', 1],
    ['Harbor View', '2A', 2, 1650, 'vacant', null],
    ['Elm Court', '101', 3, 2100, 'occupied', 2],
    ['Elm Court', '102', 1, 1150, 'make-ready', null],
  ] as const) {
    await create('Unit', { building, unitNumber, bedrooms, rent, status, tenant: tenant === null ? null : tenants[tenant].id });
  }
  await create('Vendor', { name: 'Quick Drain Plumbing', trade: 'plumbing', phone: '555-0101' });
  await create('Vendor', { name: 'Bright Spark Electric', trade: 'electrical', phone: '555-0144' });
  await create('Vendor', { name: 'Fresh Start Cleaning', trade: 'cleaning', phone: '555-0177' });
}
```

`create` goes through the same service layer as the API. Your seed data is validated against the field
rules from step 2, and any module hooks run on it. A typo in `status` fails here, not later in the UI.

The seed runs only when the database is empty, meaning there are no Tenants yet. If you created any records
while exploring step 2, remove the stack's data first:

```bash
yarn cde down harbor --volumes
```

Then start it again:

```bash
yarn cde up harbor
```

Refresh the browser. Units has five rows, and you can filter it by status, by bedrooms, or by tenant.

---

## Step 4: Add a dashboard widget

The generic pages cover most needs. The property manager's first question each morning is still "how many
units are empty?" That's a good fit for a widget on the dashboard.

A widget has two parts: a server route that does the counting, and a Vue component that shows the result.

### The server part

Create `customers/harbor/modules/property/src/server.ts`:

```ts
import { sql } from 'kysely';
import { defineServerModule } from '@cde/sdk/server';

export default defineServerModule({
  register({ router, db }) {
    // dashboard widget: units per status
    router.get('/occupancy', async (_req, res) => {
      const rows = await db
        .selectFrom('Unit')
        .select(['status', sql<string>`count(*)`.as('count')])
        .groupBy('status')
        .execute();
      res.json(Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])));
    });
  },
});
```

`router` is an Express router mounted at `/api/modules/property`, so this route is
`GET /api/modules/property/occupancy`. `db` is a Kysely instance that knows every table in the install, including
`Unit`. Kysely suits queries like this one, which the generic CRUD API doesn't cover.

### The web part

Create `customers/harbor/modules/property/src/OccupancyWidget.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { apiFetch } from '@cde/sdk/web';

const statuses = ['occupied', 'vacant', 'make-ready'] as const;
const counts = ref<Record<string, number>>({});
onMounted(async () => (counts.value = await apiFetch('/api/modules/property/occupancy')));
</script>

<template>
  <div class="card" data-testid="widget-occupancy">
    <div class="muted">Occupancy <span class="module-badge">property</span></div>
    <div class="row">
      <RouterLink
        v-for="s in statuses"
        :key="s"
        :to="{ path: '/units', query: { 'filter[status]': s } }"
        :class="['pill', s]"
        :data-testid="`occupancy-${s}`"
      >
        <strong>{{ counts[s] ?? 0 }}</strong> {{ s }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.row { display: flex; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap; }
.pill { padding: 0.4rem 0.7rem; border-radius: 8px; color: white; font-size: 0.9rem; }
.pill strong { font-size: 1.2rem; }
.occupied { background: var(--p-green-600); }
.vacant { background: var(--p-orange-600); }
.make-ready { background: var(--p-blue-600); }
</style>
```

Each pill links to the Units list with `?filter[status]=...` already set. The list page reads its filters from
the URL, so the widget doesn't need to know anything about it.

Then register the component in a slot. Create `customers/harbor/modules/property/src/web.ts`:

```ts
import { defineWebModule } from '@cde/sdk/web';
import OccupancyWidget from './OccupancyWidget.vue';

export default defineWebModule({
  slots: {
    'app.dashboard': [{ id: 'occupancy', component: OccupancyWidget, order: 1 }],
  },
});
```

`app.dashboard` is one of the named slots the core UI renders. Others include `<Entity>.detail.tabs` and
`<Entity>.detail.aside`. See the README diagram for the full list.

### Wire it up

Tell the manifest where the two entries are. Add these lines to `cde.module.ts`, under `description`:

```ts
  server: './src/server.ts',
  web: './src/web.ts',
```

No migration is needed this time, because the schema didn't change. The code is built into the image:

```bash
yarn cde up harbor
```

The dashboard now shows an **Occupancy** card: 3 occupied, 1 vacant, 1 make-ready. Click **vacant** and you
land on the Units list, filtered to Harbor View 2A.

> **Faster loop:** rebuilding the image takes a while. While you're working on UI, `yarn dev harbor` runs the
> API and the Vite dev server with hot reload at http://localhost:5173. It still uses the install's Postgres
> container. Stop it with Ctrl+C.

---

## Step 5: Check your work

Three commands catch most mistakes.

**Types.** Your module code is type-checked along with everything else:

```bash
yarn typecheck
```

**Migrations.** This confirms the committed migrations match what the config now assembles. CI runs it for
every customer, so a forgotten `yarn cde migrate` fails there instead of in production:

```bash
yarn cde migrate-check harbor
```

```
✔ built harbor → customers/harbor/.cde (property)
✔ harbor migrations are up to date
```

**End-to-end.** The shared e2e suite is generated from the registry. You haven't written a test yet, but it
already creates, views, edits, searches, filters and deletes Units and Vendors through the UI:

```bash
yarn test:e2e harbor
```

It runs against a fresh, separate stack (`cde-e2e-harbor`, on port 8184), so your demo data is safe.

> **Keep `example` values distinct from your seed data.** The suite creates a record with each field's
> `example`, then searches for it and expects exactly one match. If a Unit's `building` had
> `example: 'Harbor View'`, the search would also match the three seeded Harbor View units, and the test would
> fail. That's why `building` has no example. Without one, the suite generates a unique value.

The suite doesn't know about your widget, so add a customer spec for it. Create
`customers/harbor/e2e/harbor.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('tenants label and occupancy widget', async ({ page, request }) => {
  const count = async (status: string) =>
    (await (await request.get(`/api/units?pageSize=1&filter[status]=${status}`)).json()).total as number;
  await page.goto('/');
  await expect(page.getByTestId('nav-/customers')).toHaveText(/Tenants/);

  const widget = page.getByTestId('widget-occupancy');
  await expect(widget.getByTestId('occupancy-occupied')).toContainText(`${await count('occupied')} occupied`);
  const vacant = await count('vacant');
  await widget.getByTestId('occupancy-vacant').click();
  await expect(page.getByTestId('total')).toHaveText(new RegExp(`^${vacant} unit`));
});
```

The spec asks the API for the expected numbers instead of hard-coding them, so it still passes after someone
edits the seed. Run `yarn test:e2e harbor` again, and the run now includes a `customer:harbor` project:

```
  1 skipped
  13 passed (1.0m)
```

The skipped test is the column-chooser test for Units. It needs a field that isn't already a list column, and
every Unit field has `list: true`.

---

## Recap

You built an install for a new customer without changing any core code:

```
customers/harbor/
├── customer.config.ts            title, theme, Customer → Tenant, module list
├── compose.override.yml          stack name and ports
├── seed.ts                       sample data
├── prisma/migrations/            init + property (generated)
├── e2e/harbor.spec.ts            widget test
└── modules/property/
    ├── cde.module.ts             Unit and Vendor entities
    └── src/
        ├── server.ts             GET /api/modules/property/occupancy
        ├── web.ts                puts the widget in the app.dashboard slot
        └── OccupancyWidget.vue
```

When to run what:

| You changed… | Run |
| --- | --- |
| fields or entities (anything that changes the schema) | `yarn cde migrate harbor --name <change>`, then `yarn cde up harbor` |
| server or web code, seed, theme, labels | `yarn cde up harbor` (or keep `yarn dev harbor` running) |
| anything, before you push | `yarn typecheck`, `yarn cde migrate-check harbor`, `yarn test:e2e harbor` |

In the README's extensibility diagram, you used `customer.config.ts` (labels and theme), module `entities`, a
`defineServerModule` router, and a `defineWebModule` slot.

**Next:** [Part 2: the customer wants a few tweaks](part-2.md). Harbor asks for move-in dates, pet details,
and parking permits. None of those need new tables.
