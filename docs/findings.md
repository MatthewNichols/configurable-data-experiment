# Phase 1 findings

What the POC showed, where it was awkward, and what to do next. Written after building the three demo installs
(`bare`, `acme`, `globex`); all Vitest (24) and Playwright (28 across the three installs) tests pass.

## What worked well

**One contract, assembled at build time.** `defineModule` / `defineCustomer` in `@cde/sdk` were enough to express
everything the demos needed: declarative fields, module-owned tables, raw SQL, API routes, save hooks, search
filters, computed fields, UI slots and field renderers. The assembler turns a customer config into static
imports plus a registry, so a customer image never discovers code at runtime.

**The registry is the hub.** One JSON document (`/api/meta`) drives the zod validator (the same one on server and
client), the search builder, the full-text trigger, the form/list/detail/filter UI, the TS types for ext data
and the generic e2e suite. Adding a field to a module manifest lights up all of these with no other change.

**JSONB for declarative fields is cheap and flexible.** Fields are namespaced (`ext.<module>.<field>`), so
modules can't collide. Equality filters use JSONB containment (`ext @> '{"loyalty":{"tier":"gold"}}'`) and hit
the `jsonb_path_ops` GIN index. Data from modules that are not installed is preserved on update, so removing a
module doesn't destroy data.

**Customer code without forking.** Acme's `sales` module restyles a field owned by the shared `loyalty`
module (a field renderer). Globex's `fleet` module enforces business rules through `beforeSave` hooks, and
those errors come back as per-field form errors. Neither touches core or shared module code.

**The registry-driven e2e suite pays for itself.** It runs unchanged against every install and exercises
whatever fields that install has. It found a real bug: an omitted `ext` namespace skipped validation of
*required* module fields. Module specs travel with the module, and customer specs cover the customer's rules.

**Docker Compose per customer** works well for demos and tests. E2E uses a separate compose project on offset
ports with a fresh volume each run, so it never touches demo data.

## Where it was awkward

**Prisma and per-customer schemas.**
- Each customer owns its migration history (`customers/<c>/prisma/migrations`). A core or shared-module schema
  change therefore needs one new migration *per customer*: `cde migrate <c>` for each, and CI's
  `cde migrate-check` catches anything missed. This works, but it is N× the work and N× the review as
  customers grow.
- Prisma can't express triggers or views. These go in idempotent "extras" SQL that is appended to every new
  migration and tracked by hash. Expression indexes (e.g. on `ext #>> '{loyalty,points}'`) are worse: Prisma
  sees them as drift and generates `DROP INDEX`. We avoided them; only equality on ext fields is indexed
  (via GIN containment), while ranges and `like` on ext fields are unindexed.
- Prisma relations need fields on *both* models, so a module that relates to `Car` must inject
  `serviceRecords ServiceRecord[]` into the core model (`prismaFields`, injected at a `// @cde:extend` marker).
- The generated Prisma client differs per customer, so a module can't import a typed client. Modules receive
  `prisma: any` and declare the slice they use (see `ServiceRecordClient` in service-history).
  Kysely (`ctx.db`) is the more natural fit for module SQL.
- Prisma 7 refuses `db push --accept-data-loss` when it detects an AI agent. The testkit builds throwaway
  databases from `prisma migrate diff --from-empty --script` instead, which is read-only and arguably cleaner.

**Express 5 + `send`** refuses to serve files under a dot-directory (`.cde/web-dist`) unless `root` is passed.
A small trap, but every customer image hit it.

**Version/tooling notes.** The plan's choices held, with these swaps:

| Planned | Used | Why |
| --- | --- | --- |
| Yarn 4 | Yarn 1.22 workspaces | the version already installed; switching later is trivial |
| Testcontainers 12 | 11.14 | v12 requires Node ≥ 22.22 (machine has 22.18) |
| PrimeVue latest (5) | 4.5 | v5 adds a license-manager dependency |
| Prisma latest tag | 7.10 | `latest` points at an 8.0 RC |
| `prisma-json-types-generator` | assembler emits `ext-types.ts` | simpler; no generator coupling |
| `prisma-extension-kysely` | separate Kysely `pg` pool | peer range mismatch; one less moving part |

## Recommendations for phase 2

1. **Decide the long-term schema story.** Options:
   (a) keep Prisma and accept N migrations per change, automated with a bot that runs `cde migrate` for each
   customer;
   (b) keep Prisma for the client but generate migrations per *module* (core and each module own their own
   ordered SQL, which the assembler concatenates per install). This needs a migration runner that understands
   module ordering;
   (c) switch to Kysely migrations + `kysely-codegen`, which handles expression indexes, views and per-module
   migrations naturally. We'd lean to (b) or (c) if the number of customers will grow.
2. **Runtime admin-defined fields** (the path the design left open): store field definitions in a table and
   merge them into the registry at startup or on change. The server already builds validation and search from
   the registry, and the web app already fetches it at runtime, so storage and UI need no changes. Two pieces
   are needed: regenerating the search-vector trigger at runtime, and an admin UI.
3. **Indexing for heavy ext filters:** let a field opt into `indexed: true`. That would promote it to a
   generated column plus a B-tree index via module SQL, and teach drift checks to ignore those objects.
4. **Per-record permissions and auth** (not in scope here) would add a server hook point
   (`beforeRead` / `filterQuery`) alongside the others.
5. **Production image:** compile with `tsc`/`tsup`, prune dev dependencies in a multi-stage build, and drop
   `tsx` at runtime. The current image is not slim.
6. **Separate customer repos:** publish `@cde/*` and shared modules as packages; a customer repo then holds
   only `customers/<c>` plus a lockfile. The CLI already resolves modules by package name or path.
