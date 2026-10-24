import { reactive } from 'vue';
import type { RegistryEntity, RegistryField } from '@cde/sdk';

/**
 * Per-browser column choice for list views, keyed by install + entity. Stored as field keys so a
 * field a module later drops is simply skipped; nothing saved means the registry's `list` defaults.
 */
const chosen = reactive(new Map<string, string[]>());

function storageKey(customer: string, entity: RegistryEntity) {
  return `cde.columns.${customer}.${entity.name}`;
}

export function defaultColumns(entity: RegistryEntity): RegistryField[] {
  const listed = entity.fields.filter((f) => f.list);
  return listed.length ? listed : entity.fields.slice(0, 4);
}

export function listColumns(customer: string, entity: RegistryEntity): RegistryField[] {
  const key = storageKey(customer, entity);
  if (!chosen.has(key)) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) chosen.set(key, JSON.parse(saved));
    } catch {
      // unreadable storage: fall back to defaults
    }
  }
  const keys = chosen.get(key);
  if (!keys) return defaultColumns(entity);
  const byKey = new Map(entity.fields.map((f) => [f.key, f]));
  return keys.flatMap((k) => byKey.get(k) ?? []);
}

/** `null` resets to the registry defaults. */
export function setListColumns(customer: string, entity: RegistryEntity, keys: string[] | null) {
  const key = storageKey(customer, entity);
  if (keys) chosen.set(key, keys);
  else chosen.delete(key);
  try {
    if (keys) localStorage.setItem(key, JSON.stringify(keys));
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable: the choice lasts for this page load
  }
}
