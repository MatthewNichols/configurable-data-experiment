import { defineWebModule } from '@cde/sdk/web';
import Money from './Money.vue';
import TierBadge from './TierBadge.vue';

export default defineWebModule({
  fieldRenderers: {
    'Car.sales.listPrice': Money,
    // a customer module restyling a field that belongs to a *shared* module
    'Customer.loyalty.tier': TierBadge,
  },
});
