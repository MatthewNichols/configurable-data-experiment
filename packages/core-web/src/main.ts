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
import EntityPage from './pages/EntityPage.vue';
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
    // generic pages, unless a module overrides them via `pages` (see EntityPage)
    { path: '/:entity', name: 'list', component: EntityPage, props: { kind: 'list' } },
    { path: '/:entity/new', name: 'new', component: EntityPage, props: { kind: 'form' } },
    { path: '/:entity/:id', name: 'detail', component: EntityPage, props: { kind: 'detail' } },
    { path: '/:entity/:id/edit', name: 'edit', component: EntityPage, props: { kind: 'form' } },
  ],
});

createApp(App)
  .provide(CTX, ctx)
  .use(router)
  .use(PrimeVue, { theme: { preset: customerPreset(registry.customer.theme), options: { darkModeSelector: '.app-dark' } } })
  .use(ToastService)
  .use(ConfirmationService)
  .mount('#app');
