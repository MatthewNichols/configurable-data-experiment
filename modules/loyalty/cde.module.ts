import { defineModule } from '@cde/sdk';

/**
 * A purely declarative module: the fields below get storage (JSONB), validation, search
 * filters, indexes, form editors and list columns without a line of module code.
 */
export default defineModule({
  name: 'loyalty',
  label: 'Loyalty',
  description: 'Loyalty programme membership for customers',
  extends: {
    Customer: {
      fields: {
        tier: { type: 'enum', values: ['bronze', 'silver', 'gold', 'platinum'], label: 'Tier', searchable: 'filter', list: true },
        points: { type: 'int', min: 0, label: 'Points', searchable: 'range', list: true },
        memberSince: { type: 'date', label: 'Member since', searchable: 'range' },
        marketingOptIn: { type: 'bool', label: 'Marketing opt-in', searchable: 'filter' },
      },
    },
  },
});
