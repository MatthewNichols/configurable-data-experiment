import { inject, type InjectionKey } from 'vue';
import type { Registry, RegistryEntity } from '@cde/sdk';
import type { SlotContribution, WebModule } from '@cde/sdk/web';

export interface AppContext {
  registry: Registry;
  modules: Record<string, WebModule>;
  slot(name: string): SlotContribution[];
  fieldRenderer(entity: string, key: string): unknown;
  entityByPath(path: string): RegistryEntity | undefined;
}

export const CTX: InjectionKey<AppContext> = Symbol('cde');

export function createContext(registry: Registry, modules: Record<string, WebModule>): AppContext {
  // only modules the server reports as installed (registry) contribute UI
  const active = Object.fromEntries(Object.entries(modules).filter(([name]) => registry.modules.some((m) => m.name === name)));
  return {
    registry,
    modules: active,
    slot: (name) =>
      Object.values(active)
        .flatMap((m) => (m.slots as Record<string, SlotContribution[]> | undefined)?.[name] ?? [])
        .sort((a, b) => (a.order ?? 100) - (b.order ?? 100)),
    fieldRenderer: (entity, key) => {
      for (const m of Object.values(active)) {
        const r = m.fieldRenderers?.[`${entity}.${key}`];
        if (r) return r;
      }
      return undefined;
    },
    entityByPath: (path) => Object.values(registry.entities).find((e) => e.path === path),
  };
}

export function useCde(): AppContext {
  const ctx = inject(CTX);
  if (!ctx) throw new Error('cde context missing');
  return ctx;
}
