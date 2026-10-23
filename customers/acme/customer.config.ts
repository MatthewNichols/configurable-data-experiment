import { defineCustomer } from '@cde/sdk';

/** A car dealership: shared loyalty + service-history modules, plus its own sales module. */
export default defineCustomer({
  name: 'acme',
  title: 'Acme Motors',
  tagline: 'Dealership CRM',
  modules: ['@cde-module/loyalty', '@cde-module/service-history', './modules/sales'],
  theme: { primary: 'emerald', surface: 'slate' },
});
