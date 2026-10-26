import { defineWebModule } from '@cde/sdk/web';
import FleetStatusWidget from './FleetStatusWidget.vue';
import GarageDetailPage from './GarageDetailPage.vue';

export default defineWebModule({
  slots: {
    'app.dashboard': [{ id: 'fleet-status', component: FleetStatusWidget, order: 1 }],
  },
  pages: { 'Garage.detail': GarageDetailPage },
});
