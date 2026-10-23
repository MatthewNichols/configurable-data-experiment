import type { RegistryField } from '@cde/sdk';

let counter = 0;

/** A deterministic-ish valid value for a field; `refs` supplies ids for reference fields. */
export function sampleValue(field: RegistryField, refs: Record<string, string> = {}): unknown {
  const n = ++counter;
  const tag = `${Date.now().toString(36)}${n}`;
  if (field.example !== undefined && field.type !== 'reference') return field.example;
  switch (field.type) {
    case 'string':
      if (field.maxLength === 17) return `VIN${tag.toUpperCase()}`.padEnd(17, '0').slice(0, 17);
      return `${field.label} ${tag}`.slice(0, field.maxLength ?? 255);
    case 'text':
      return `Some ${field.label.toLowerCase()} ${tag}`;
    case 'int':
      return Math.max(field.min ?? 0, Math.min(field.max ?? 1_000_000, (field.min ?? 0) + 7));
    case 'decimal':
      return (field.min ?? 0) + 12.5;
    case 'bool':
      return true;
    case 'date':
      return '2026-03-14';
    case 'enum':
      return field.values![field.values!.length - 1];
    case 'reference':
      return refs[field.ref!] ?? null;
  }
}
