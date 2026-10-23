import type { EntityRecord, Registry, RegistryEntity } from './registry.ts';

/**
 * Named slots the core UI renders. `<Entity>` is the entity name, e.g. `Car.detail.tabs`.
 *  - `app.dashboard`           widgets on the home page            props: { registry }
 *  - `<Entity>.detail.tabs`    extra tabs on the detail page        props: { entity, record, registry }
 *  - `<Entity>.detail.aside`   panels beside the detail fields      props: { entity, record, registry }
 *  - `<Entity>.list.actions`   buttons in the list toolbar          props: { entity, registry }
 */
export type SlotName = 'app.dashboard' | `${string}.detail.tabs` | `${string}.detail.aside` | `${string}.list.actions`;

export interface SlotProps {
  registry: Registry;
  entity?: RegistryEntity;
  record?: EntityRecord;
}

export interface SlotContribution {
  id: string;
  title?: string;
  /** a Vue component (kept as unknown so the SDK has no Vue dependency) */
  component: unknown;
  order?: number;
}

export interface WebModule {
  slots?: Partial<Record<SlotName, SlotContribution[]>>;
  routes?: Array<{ path: string; name?: string; component: unknown; label?: string }>;
  nav?: Array<{ label: string; to: string; icon?: string }>;
  /** Custom read-only renderers keyed by `<Entity>.<fieldKey>`, e.g. `Customer.loyalty.tier` */
  fieldRenderers?: Record<string, unknown>;
}

export function defineWebModule(mod: WebModule): WebModule {
  return mod;
}

/** Small JSON fetch helper for module UIs; throws `ApiError` with field errors on 4xx/5xx. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function apiFetch<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText, data?.fieldErrors);
  return data as T;
}
