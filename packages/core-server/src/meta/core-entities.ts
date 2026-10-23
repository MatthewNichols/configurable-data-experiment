import type { FieldDef } from '@cde/sdk';

export interface CoreEntityDef {
  name: string;
  label: string;
  pluralLabel: string;
  path: string;
  table: string;
  delegate: string;
  titleFields: string[];
  fields: Record<string, FieldDef>;
}

/**
 * The "standard data" every install has. Columns here must match prisma/core.prisma.
 * Modules add to these entities; they never edit them.
 */
export const coreEntities: CoreEntityDef[] = [
  {
    name: 'Customer',
    label: 'Customer',
    pluralLabel: 'Customers',
    path: 'customers',
    table: 'Customer',
    delegate: 'customer',
    titleFields: ['firstName', 'lastName'],
    fields: {
      firstName: { type: 'string', label: 'First name', required: true, searchable: ['text', 'filter'], list: true },
      lastName: { type: 'string', label: 'Last name', required: true, searchable: ['text', 'filter'], list: true },
      email: { type: 'string', label: 'Email', searchable: ['text', 'filter'], list: true },
      phone: { type: 'string', label: 'Phone', searchable: 'text' },
      notes: { type: 'text', label: 'Notes', searchable: 'text' },
    },
  },
  {
    name: 'Car',
    label: 'Car',
    pluralLabel: 'Cars',
    path: 'cars',
    table: 'Car',
    delegate: 'car',
    titleFields: ['year', 'make', 'model'],
    fields: {
      vin: { type: 'string', label: 'VIN', required: true, maxLength: 17, searchable: ['text', 'filter'], list: true },
      make: { type: 'string', label: 'Make', required: true, searchable: ['text', 'filter'], list: true },
      model: { type: 'string', label: 'Model', required: true, searchable: ['text', 'filter'], list: true },
      year: { type: 'int', label: 'Year', required: true, min: 1900, max: 2100, searchable: ['filter', 'range'], list: true },
      color: { type: 'string', label: 'Colour', searchable: 'filter' },
      customerId: { type: 'reference', ref: 'Customer', label: 'Owner', searchable: 'filter', list: true },
    },
  },
];
