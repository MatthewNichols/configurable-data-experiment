import {
  FIELD_TYPES,
  filterOperators,
  humanize,
  searchModes,
  type FieldDef,
  type Registry,
  type RegistryEntity,
  type RegistryField,
} from '@cde/sdk';
import { coreEntities } from '@cde/core-server/core-entities';
import type { LoadedCustomer } from './load.ts';

export class AssemblyError extends Error {
  constructor(readonly problems: string[]) {
    super(`Customer build failed:\n  - ${problems.join('\n  - ')}`);
  }
}

const MODULE_NAME = /^[a-z][a-zA-Z0-9]*$/;
const FIELD_NAME = /^[a-z][a-zA-Z0-9]*$/;

function checkField(where: string, def: FieldDef, entityNames: Set<string>, problems: string[]) {
  if (!FIELD_TYPES.includes(def.type)) problems.push(`${where}: unknown field type "${def.type}"`);
  if (def.type === 'enum' && !def.values?.length) problems.push(`${where}: enum fields need "values"`);
  if (def.type === 'reference' && (!def.ref || !entityNames.has(def.ref)))
    problems.push(`${where}: reference to unknown entity "${def.ref}"`);
  for (const m of searchModes(def)) {
    if (!['text', 'filter', 'range'].includes(m)) problems.push(`${where}: unknown searchable mode "${m}"`);
    if (m === 'range' && !['int', 'decimal', 'date'].includes(def.type))
      problems.push(`${where}: "range" search needs an int, decimal or date field`);
  }
}

function toField(key: string, def: FieldDef, extra: Partial<RegistryField> & Pick<RegistryField, 'source' | 'section'>): RegistryField {
  const { searchable: _s, ...rest } = def;
  return {
    ...rest,
    key,
    label: def.label ?? humanize(key.split('.').pop()!),
    searchable: searchModes(def),
    operators: extra.source === 'computed' ? [] : filterOperators(def),
    ...extra,
  };
}

/** Merges core entities with every module's declarations, validating as it goes. */
export function buildRegistry(customer: LoadedCustomer): Registry {
  const problems: string[] = [];
  const { config } = customer;
  const entities: Record<string, RegistryEntity> = {};
  const entityNames = new Set(coreEntities.map((e) => e.name));

  for (const core of coreEntities) {
    const labels = config.labels?.[core.name] ?? {};
    entities[core.name] = {
      name: core.name,
      label: labels.label ?? core.label,
      pluralLabel: labels.pluralLabel ?? core.pluralLabel,
      path: core.path,
      table: core.table,
      delegate: core.delegate,
      titleFields: core.titleFields,
      sections: [{ key: 'core', label: 'Details' }],
      filters: [],
      fields: Object.entries(core.fields).map(([key, def]) => {
        checkField(`${core.name}.${key}`, def, entityNames, problems);
        return toField(key, def, { source: 'core', column: key, section: 'core' });
      }),
    };
  }
  for (const [name] of Object.entries(config.labels ?? {}))
    if (!entities[name]) problems.push(`labels: unknown entity "${name}"`);

  const seen = new Map<string, string>();
  for (const { manifest: m, ref } of customer.modules) {
    if (!MODULE_NAME.test(m.name ?? '')) {
      problems.push(`${ref}: module name "${m.name}" must be camelCase (it is the JSONB namespace)`);
      continue;
    }
    if (seen.has(m.name)) {
      problems.push(`${ref}: module name "${m.name}" is already used by ${seen.get(m.name)} (ext namespaces would collide)`);
      continue;
    }
    seen.set(m.name, ref);
    const moduleLabel = m.label ?? humanize(m.name);

    for (const [entityName, extension] of Object.entries(m.extends ?? {})) {
      const entity = entities[entityName];
      if (!entity) {
        problems.push(`${m.name}: extends unknown entity "${entityName}"`);
        continue;
      }
      entity.sections.push({ key: m.name, label: moduleLabel, module: m.name });
      for (const [f, def] of Object.entries(extension.fields ?? {})) {
        const where = `${m.name}: ${entityName}.${f}`;
        if (!FIELD_NAME.test(f)) problems.push(`${where}: field names must be camelCase`);
        checkField(where, def, entityNames, problems);
        entity.fields.push(toField(`${m.name}.${f}`, def, { source: 'ext', module: m.name, path: [m.name, f], section: m.name }));
      }
      for (const [f, def] of Object.entries(extension.computed ?? {})) {
        const where = `${m.name}: ${entityName}.${f} (computed)`;
        if (extension.fields?.[f]) problems.push(`${where}: also declared as a stored field`);
        checkField(where, def, entityNames, problems);
        entity.fields.push(
          toField(`${m.name}.${f}`, def, { source: 'computed', module: m.name, path: [m.name, f], section: m.name, readOnly: true }),
        );
      }
      for (const [f, def] of Object.entries(extension.filters ?? {})) {
        if (!m.server) problems.push(`${m.name}: filter ${entityName}.${f} needs a server entry to implement it`);
        entity.filters.push({ ...def, key: `${m.name}.${f}`, label: def.label ?? humanize(f), module: m.name });
      }
      for (const line of extension.prismaFields ?? []) {
        const fieldName = line.trim().split(/\s+/)[0];
        if (entity.fields.some((x) => x.source === 'core' && x.key === fieldName))
          problems.push(`${m.name}: prismaFields "${fieldName}" collides with core field on ${entityName}`);
      }
    }
  }

  if (problems.length) throw new AssemblyError(problems);

  return {
    customer: { name: config.name, title: config.title, tagline: config.tagline, theme: config.theme ?? {} },
    entityOrder: coreEntities.map((e) => e.name),
    entities,
    modules: customer.modules.map(({ manifest: m }) => ({
      name: m.name,
      label: m.label ?? humanize(m.name),
      description: m.description,
      server: !!m.server,
      web: !!m.web,
    })),
  };
}
