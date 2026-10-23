<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Button from 'primevue/button';
import EntityTable from '../components/EntityTable.vue';
import ModuleSlot from '../components/ModuleSlot.vue';
import { useCde } from '../lib/context.ts';

const route = useRoute();
const { entityByPath } = useCde();
const entity = computed(() => entityByPath(String(route.params.entity)));
</script>

<template>
  <div v-if="entity" class="page">
    <div class="page-header">
      <h1>{{ entity.pluralLabel }}</h1>
      <ModuleSlot :name="`${entity.name}.list.actions`" :entity="entity" />
      <RouterLink :to="`/${entity.path}/new`"><Button :label="`New ${entity.label.toLowerCase()}`" icon="pi pi-plus" data-testid="btn-new" /></RouterLink>
    </div>
    <EntityTable :entity="entity" />
  </div>
  <div v-else class="page"><h1>Not found</h1></div>
</template>
