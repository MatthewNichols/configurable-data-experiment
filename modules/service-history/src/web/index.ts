import { defineWebModule } from '@cde/sdk/web';
import ServiceHistoryTab from './ServiceHistoryTab.vue';
import DueWidget from './DueWidget.vue';

export default defineWebModule({
  slots: {
    'Car.detail.tabs': [{ id: 'service-history', title: 'Service history', component: ServiceHistoryTab }],
    'app.dashboard': [{ id: 'service-due', component: DueWidget, order: 10 }],
  },
});
