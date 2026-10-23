<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { apiFetch } from '@cde/sdk/web';

const data = ref<{ total: number; cars: { id: string; make: string; model: string; year: number }[] }>();
onMounted(async () => (data.value = await apiFetch('/api/modules/serviceHistory/due')));
</script>

<template>
  <div class="card" data-testid="widget-service-due">
    <div class="muted">Due for service <span class="module-badge">serviceHistory</span></div>
    <RouterLink :to="{ path: '/cars', query: { 'filter[serviceHistory.serviceDue]': 'true' } }" class="due-count">{{ data?.total ?? '…' }}</RouterLink>
    <ul v-if="data?.cars.length" class="due-list">
      <li v-for="c in data.cars" :key="c.id">
        <RouterLink :to="`/cars/${c.id}`">{{ c.year }} {{ c.make }} {{ c.model }}</RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.due-count { display: block; font-size: 2.25rem; font-weight: 700; color: var(--p-orange-600); }
.due-list { margin: 0.25rem 0 0; padding-left: 1.1rem; font-size: 0.9rem; }
</style>
