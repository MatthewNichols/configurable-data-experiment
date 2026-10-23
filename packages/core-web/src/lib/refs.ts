import { reactive } from 'vue';
import { apiFetch } from '@cde/sdk/web';
import { recordTitle, type EntityRecord, type RegistryEntity } from '@cde/sdk';

/** Batched, cached lookup of reference titles: many cells → one `?ids=` request per entity. */
const titles = reactive(new Map<string, string>());
const pending = new Map<RegistryEntity, Set<string>>();
let scheduled = false;

function flush() {
  scheduled = false;
  for (const [entity, ids] of pending) {
    pending.delete(entity);
    apiFetch<{ items: EntityRecord[] }>(`/api/${entity.path}?pageSize=200&ids=${[...ids].join(',')}`).then(({ items }) => {
      for (const r of items) titles.set(`${entity.name}:${r.id}`, recordTitle(entity, r));
    });
  }
}

export function refTitle(entity: RegistryEntity, id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const key = `${entity.name}:${id}`;
  if (!titles.has(key)) {
    titles.set(key, '…');
    if (!pending.has(entity)) pending.set(entity, new Set());
    pending.get(entity)!.add(id);
    if (!scheduled) {
      scheduled = true;
      setTimeout(flush, 0);
    }
  }
  return titles.get(key);
}

export function rememberTitle(entity: RegistryEntity, record: EntityRecord) {
  titles.set(`${entity.name}:${record.id}`, recordTitle(entity, record));
}
