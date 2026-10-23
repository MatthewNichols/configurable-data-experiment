<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { apiFetch } from '@cde/sdk/web';
import ModuleSlot from '../components/ModuleSlot.vue';
import { useCde } from '../lib/context.ts';

const { registry } = useCde();
const counts = reactive<Record<string, number>>({});
onMounted(() =>
  registry.entityOrder.forEach(async (n) => {
    const { total } = await apiFetch<{ total: number }>(`/api/${registry.entities[n].path}?pageSize=1`);
    counts[n] = total;
  }),
);
</script>

<template>
  <div class="page">
    <div class="page-header"><h1>Dashboard</h1></div>
    <div class="grid">
      <RouterLink v-for="n in registry.entityOrder" :key="n" :to="`/${registry.entities[n].path}`" class="card stat" :data-testid="`stat-${n}`">
        <div class="muted">{{ registry.entities[n].pluralLabel }}</div>
        <div class="value">{{ counts[n] ?? '…' }}</div>
      </RouterLink>
      <ModuleSlot name="app.dashboard" />
    </div>
    <div class="card" style="margin-top: 1rem">
      <h2 class="section-title">This install</h2>
      <p v-if="!registry.modules.length" class="muted">Core data only, no modules installed.</p>
      <ul v-else data-testid="installed-modules">
        <li v-for="m in registry.modules" :key="m.name">
          <strong>{{ m.label }}</strong> <span class="module-badge">{{ m.name }}</span>
          <span class="muted"> — {{ m.description }}</span>
          <span class="muted"> ({{ [m.server && 'server', m.web && 'web'].filter(Boolean).join(' + ') || 'declarative' }})</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.stat { display: block; color: inherit; }
.stat:hover { text-decoration: none; border-color: var(--p-primary-300); }
.stat .value { font-size: 2.25rem; font-weight: 700; color: var(--p-primary-700); }
</style>
