<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useCde } from './lib/context.ts';

const { registry, modules } = useCde();
const route = useRoute();
const nav = computed(() => [
  { label: 'Dashboard', to: '/', icon: 'pi pi-home' },
  ...registry.entityOrder.map((n) => ({
    label: registry.entities[n].pluralLabel,
    to: `/${registry.entities[n].path}`,
    icon: registry.entities[n].icon,
  })),
  ...Object.values(modules).flatMap((m) => m.nav ?? []),
]);
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to));
</script>

<template>
  <header class="topbar" data-testid="topbar">
    <div class="brand">
      <i class="pi pi-objects-column" />
      <div>
        <div class="title" data-testid="app-title">{{ registry.customer.title }}</div>
        <div v-if="registry.customer.tagline" class="tagline">{{ registry.customer.tagline }}</div>
      </div>
    </div>
    <nav>
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }" :data-testid="`nav-${item.to}`">
        <i :class="item.icon ?? 'pi pi-circle'" /> {{ item.label }}
      </RouterLink>
    </nav>
  </header>
  <main>
    <RouterView :key="$route.fullPath.split('?')[0]" />
  </main>
  <footer class="footer muted">
    install: <code>{{ registry.customer.name }}</code> · modules:
    <span v-if="!registry.modules.length">none</span>
    <span v-for="(m, i) in registry.modules" :key="m.name">{{ i ? ', ' : '' }}{{ m.label }}</span>
  </footer>
  <Toast />
  <ConfirmDialog />
</template>

<style scoped>
.topbar {
  display: flex; align-items: center; gap: 2rem; padding: 0.75rem 1.5rem; flex-wrap: wrap;
  background: var(--p-primary-700); color: var(--p-primary-contrast-color);
}
.brand { display: flex; align-items: center; gap: 0.75rem; }
.brand .pi { font-size: 1.6rem; }
.title { font-weight: 700; font-size: 1.15rem; }
.tagline { font-size: 0.8rem; opacity: 0.85; }
nav { display: flex; gap: 0.25rem; flex-wrap: wrap; }
nav a { color: inherit; padding: 0.45rem 0.8rem; border-radius: 8px; opacity: 0.85; display: flex; gap: 0.4rem; align-items: center; }
nav a:hover { text-decoration: none; background: rgb(255 255 255 / 0.12); opacity: 1; }
nav a.active { background: rgb(255 255 255 / 0.2); opacity: 1; font-weight: 600; }
.footer { text-align: center; font-size: 0.8rem; padding: 1rem; }
</style>
