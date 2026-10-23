import { defineModule } from '@cde/sdk';

/** Customer-only module: lives in the customer folder, never shipped to other installs. */
export default defineModule({
  name: 'sales',
  label: 'Sales',
  description: 'Acme-specific pricing and sales-rep data',
  web: './src/web.ts',
  extends: {
    Car: {
      fields: {
        listPrice: { type: 'decimal', min: 0, label: 'List price', searchable: 'range', list: true, example: 18995 },
        condition: { type: 'enum', values: ['new', 'used', 'certified'], label: 'Condition', searchable: 'filter', list: true },
        onLot: { type: 'bool', label: 'On the lot', searchable: 'filter' },
      },
    },
    Customer: {
      fields: {
        salesRep: { type: 'string', label: 'Sales rep', searchable: ['filter', 'text'] },
        preferredContact: { type: 'enum', values: ['email', 'phone', 'sms'], label: 'Preferred contact' },
      },
    },
  },
});
