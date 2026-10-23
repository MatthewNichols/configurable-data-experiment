<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { apiFetch } from '@cde/sdk/web';

const statuses = ['available', 'rented', 'maintenance'] as const;
const counts = ref<Record<string, number>>({});
onMounted(async () => (counts.value = await apiFetch('/api/modules/fleet/status')));
</script>

<template>
  <div class="card" data-testid="widget-fleet-status">
    <div class="muted">Fleet status <span class="module-badge">fleet</span></div>
    <div class="row">
      <RouterLink
        v-for="s in statuses"
        :key="s"
        :to="{ path: '/cars', query: { 'filter[fleet.status]': s } }"
        :class="['pill', s]"
        :data-testid="`fleet-${s}`"
      >
        <strong>{{ counts[s] ?? 0 }}</strong> {{ s }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.row { display: flex; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap; }
.pill { padding: 0.4rem 0.7rem; border-radius: 8px; color: white; font-size: 0.9rem; }
.pill strong { font-size: 1.2rem; }
.available { background: var(--p-green-600); }
.rented { background: var(--p-blue-600); }
.maintenance { background: var(--p-orange-600); }
</style>
