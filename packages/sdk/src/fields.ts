/**
 * Field definitions are the single vocabulary shared by core entities, declarative
 * module extensions, the API validator, the search builder and the metadata-driven UI.
 */
export const FIELD_TYPES = ['string', 'text', 'int', 'decimal', 'bool', 'date', 'enum', 'reference'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * - `text`   : included in the entity's full-text search vector (`?q=`)
 * - `filter` : equality / contains filter (`?filter[key]=v`)
 * - `range`  : gte / lte filter (`?filter[key][gte]=v`)
 */
export type SearchMode = 'text' | 'filter' | 'range';

export interface FieldDef {
  type: FieldType;
  label?: string;
  description?: string;
  required?: boolean;
  /** enum only */
  values?: readonly string[];
  /** int / decimal */
  min?: number;
  max?: number;
  /** string / text */
  maxLength?: number;
  /** reference only: target entity name, e.g. 'Customer' */
  ref?: string;
  searchable?: SearchMode | readonly SearchMode[];
  /** show as a column in list views */
  list?: boolean;
  /** example value: used as the UI placeholder and by generated test data */
  example?: string | number;
}

/** A filter that does not map 1:1 to a stored field; implemented by a server module's search extension. */
export interface FilterDef {
  type: 'bool' | 'enum' | 'string' | 'date';
  label?: string;
  values?: readonly string[];
}

export function searchModes(def: Pick<FieldDef, 'searchable'>): SearchMode[] {
  if (!def.searchable) return [];
  return Array.isArray(def.searchable) ? [...def.searchable] : [def.searchable as SearchMode];
}

/** Operators the search API accepts for a field, derived from its type + searchable modes. */
export function filterOperators(def: FieldDef): string[] {
  const modes = searchModes(def);
  const ops: string[] = [];
  if (modes.includes('filter')) {
    if (def.type === 'string' || def.type === 'text') ops.push('eq', 'like');
    else if (def.type === 'enum') ops.push('eq', 'in');
    else ops.push('eq');
  }
  if (modes.includes('range') && ['int', 'decimal', 'date'].includes(def.type)) ops.push('gte', 'lte');
  return ops;
}

export function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}
