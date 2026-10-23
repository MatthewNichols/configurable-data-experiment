import { defineCustomer } from '@cde/sdk';

/** A rental fleet: service-history (shared) plus its own fleet module with business rules. */
export default defineCustomer({
  name: 'globex',
  title: 'Globex Rentals',
  tagline: 'Fleet operations',
  modules: ['@cde-module/service-history', './modules/fleet'],
  theme: { primary: 'amber', surface: 'stone' },
  labels: { Customer: { label: 'Renter', pluralLabel: 'Renters' } },
});
