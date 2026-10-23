import { defineCustomer } from '@cde/sdk';

/** Core only: the baseline every other install builds on. */
export default defineCustomer({
  name: 'bare',
  title: 'CDE Core',
  tagline: 'Standard data only — no modules',
  modules: [],
  theme: { primary: 'indigo', surface: 'slate' },
});
