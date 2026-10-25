import { defineModule } from '@cde/sdk';

/** Test-only module that declares an entity using every column type. */
export default defineModule({
  name: 'workshop',
  entities: {
    Bay: {
      label: 'Bay',
      titleFields: ['code'],
      fields: {
        code: { type: 'string', required: true, searchable: ['text', 'filter'] },
        notes: { type: 'text', searchable: 'text' },
        lifts: { type: 'int', min: 0, searchable: 'range' },
        rate: { type: 'decimal' },
        covered: { type: 'bool', searchable: 'filter' },
        opened: { type: 'date', searchable: 'range' },
        kind: { type: 'enum', values: ['wash', 'repair'], searchable: 'filter' },
        keyholder: { type: 'reference', ref: 'Customer', searchable: 'filter' },
      },
    },
  },
  extends: {
    Car: { fields: { bay: { type: 'reference', ref: 'Bay', searchable: 'filter' } } },
  },
});
