import { createApp } from 'vue';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import 'primeicons/primeicons.css';
import { webModules } from 'virtual:cde-modules';
import { apiFetch } from '@cde/sdk/web';
import type { Registry } from '@cde/sdk';
import App from './App.vue';
import Dashboard from './pages/Dashboard.vue';
import EntityListPage from './pages/EntityListPage.vue';
import EntityDetailPage from './pages/EntityDetailPage.vue';
import EntityFormPage from './pages/EntityFormPage.vue';
import { createContext, CTX } from './lib/context.ts';
import { customerPreset } from './lib/theme.ts';
import './style.css';

// The registry is fetched at runtime (not bundled) so a future admin UI can change fields without a rebuild.
const registry = await apiFetch<Registry>('/api/meta');
const ctx = createContext(registry, webModules);
document.title = registry.customer.title;

const moduleRoutes: RouteRecordRaw[] = Object.values(ctx.modules).flatMap((m) =>
  (m.routes ?? []).map((r) => ({ path: r.path, name: r.name, component: r.component as any })),
);

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    ...moduleRoutes,
    { path: '/:entity', name: 'list', component: EntityListPage },
    { path: '/:entity/new', name: 'new', component: EntityFormPage },
    { path: '/:entity/:id', name: 'detail', component: EntityDetailPage },
    { path: '/:entity/:id/edit', name: 'edit', component: EntityFormPage },
  ],
});

createApp(App)
  .provide(CTX, ctx)
  .use(router)
  .use(PrimeVue, { theme: { preset: customerPreset(registry.customer.theme), options: { darkModeSelector: '.app-dark' } } })
  .use(ToastService)
  .use(ConfirmationService)
  .mount('#app');
