import type { EntityRecord } from '@cde/sdk';
import type { SaveContext, SearchExtension } from '@cde/sdk/server';

type Fn<A extends unknown[]> = (...args: A) => void | Promise<void>;

/** Collects everything server modules register, keyed by entity name. */
export class ExtensionPoints {
  beforeSave = new Map<string, Fn<[SaveContext]>[]>();
  afterSave = new Map<string, Fn<[EntityRecord, SaveContext]>[]>();
  beforeDelete = new Map<string, Fn<[EntityRecord]>[]>();
  enrich = new Map<string, Fn<[EntityRecord[]]>[]>();
  /** entity -> module -> extension */
  search = new Map<string, Map<string, SearchExtension>>();

  add<K extends 'beforeSave' | 'afterSave' | 'beforeDelete' | 'enrich'>(kind: K, entity: string, fn: any) {
    const map = this[kind] as Map<string, unknown[]>;
    if (!map.has(entity)) map.set(entity, []);
    map.get(entity)!.push(fn);
  }

  async run<K extends 'beforeSave' | 'afterSave' | 'beforeDelete' | 'enrich'>(kind: K, entity: string, ...args: unknown[]) {
    for (const fn of (this[kind] as Map<string, Fn<unknown[]>[]>).get(entity) ?? []) await fn(...args);
  }
}
