import type { FieldDef, FilterDef, SearchMode } from './fields.ts';
import type { CustomerTheme } from './manifest.ts';

/**
 * The merged, serialisable description of an install: produced by the assembler at build
 * time, served at GET /api/meta, consumed by the server (validation/search) and the UI.
 */
export interface Registry {
  customer: { name: string; title: string; tagline?: string; theme: CustomerTheme };
  entityOrder: string[];
  entities: Record<string, RegistryEntity>;
  modules: RegistryModule[];
}

export interface RegistryModule {
  name: string;
  label: string;
  description?: string;
  server: boolean;
  web: boolean;
}

export interface RegistrySection {
  key: string;
  label: string;
  module?: string;
}

export interface RegistryEntity {
  name: string;
  label: string;
  pluralLabel: string;
  /** URL segment, e.g. 'customers' */
  path: string;
  /** SQL table name */
  table: string;
  /** Prisma client delegate, e.g. 'customer' */
  delegate: string;
  /** fields used to render a record title */
  titleFields: string[];
  fields: RegistryField[];
  filters: RegistryFilter[];
  sections: RegistrySection[];
}

export type FieldSource = 'core' | 'ext' | 'computed';

export interface RegistryField extends Omit<FieldDef, 'searchable'> {
  /** 'lastName' for core fields, 'loyalty.tier' for module fields */
  key: string;
  label: string;
  source: FieldSource;
  module?: string;
  /** core: SQL column */
  column?: string;
  /** ext / computed: [module, field] */
  path?: [string, string];
  searchable: SearchMode[];
  operators: string[];
  section: string;
  readOnly?: boolean;
}

export interface RegistryFilter extends FilterDef {
  key: string;
  label: string;
  module: string;
}

/** API record shape. */
export interface EntityRecord {
  id: string;
  ext: Record<string, Record<string, unknown>>;
  computed?: Record<string, Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
  [coreField: string]: unknown;
}

export function getFieldValue(record: Partial<EntityRecord>, field: RegistryField): unknown {
  if (field.source === 'core') return record[field.key];
  const [mod, key] = field.path!;
  const bag = field.source === 'ext' ? record.ext : record.computed;
  return bag?.[mod]?.[key];
}

export function setFieldValue(record: Partial<EntityRecord>, field: RegistryField, value: unknown): void {
  if (field.source === 'core') {
    record[field.key] = value;
    return;
  }
  const [mod, key] = field.path!;
  const bagName = field.source === 'ext' ? 'ext' : 'computed';
  const bag = (record[bagName] ??= {}) as Record<string, Record<string, unknown>>;
  (bag[mod] ??= {})[key] = value;
}

export function recordTitle(entity: RegistryEntity, record: Partial<EntityRecord>): string {
  return entity.titleFields
    .map((k) => record[k])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .join(' ');
}

export function findEntityByPath(registry: Registry, path: string): RegistryEntity | undefined {
  return Object.values(registry.entities).find((e) => e.path === path);
}
