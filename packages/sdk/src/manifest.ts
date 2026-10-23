import type { FieldDef, FilterDef } from './fields.ts';

/** How a module extends one core entity. */
export interface EntityExtension {
  /** Stored in the entity's JSONB `ext` column under `ext.<module>.<field>`. */
  fields?: Record<string, FieldDef>;
  /** Extra search filters implemented by the module's server `search.extend` hook. */
  filters?: Record<string, FilterDef>;
  /** Read-only values the module's server `enrich` hook computes (e.g. from its own tables). */
  computed?: Record<string, FieldDef>;
  /**
   * Raw Prisma field lines injected into the core model, needed for back-relations to
   * module-owned models, e.g. `serviceRecords ServiceRecord[]`.
   */
  prismaFields?: string[];
}

export interface ModuleManifest {
  /** camelCase; doubles as the JSONB namespace and API mount point. */
  name: string;
  label?: string;
  description?: string;
  extends?: Record<string, EntityExtension>;
  /** Path (relative to the manifest) of a Prisma schema fragment with module-owned models. */
  prismaSchema?: string;
  /** Path of an idempotent SQL file appended to migrations (indexes, triggers, views...). */
  sql?: string;
  /** Path of the server entry (default export: `defineServerModule(...)`). */
  server?: string;
  /** Path of the web entry (default export: `defineWebModule(...)`). */
  web?: string;
}

export function defineModule<const M extends ModuleManifest>(manifest: M): M {
  return manifest;
}

export interface CustomerTheme {
  /** PrimeVue palette name: emerald, indigo, amber, rose, sky, violet, ... */
  primary?: string;
  /** PrimeVue surface palette: slate, zinc, stone, ... */
  surface?: string;
}

export interface CustomerConfig {
  /** folder name under customers/ */
  name: string;
  /** product title shown in the UI */
  title: string;
  tagline?: string;
  /**
   * Module references: a package name (`@cde-module/loyalty`) or a path relative to the
   * customer folder for customer-only modules (`./modules/fleet`).
   */
  modules: string[];
  theme?: CustomerTheme;
  /** Override core labels per entity, e.g. { Customer: { label: 'Driver' } } */
  labels?: Record<string, { label?: string; pluralLabel?: string }>;
}

export function defineCustomer<const C extends CustomerConfig>(config: C): C {
  return config;
}
