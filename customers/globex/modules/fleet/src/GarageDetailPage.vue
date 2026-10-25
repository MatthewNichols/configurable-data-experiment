<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { recordTitle, type EntityRecord } from '@cde/sdk';
import { apiFetch, ApiError, type PageProps } from '@cde/sdk/web';
import { EntityTable, FieldDisplay, useCde } from '@cde/core-web/ui';

/** Replaces the generic Garage detail page (see `pages` in web.ts): occupancy up front, cars below. */
const props = defineProps<PageProps>();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const { slot } = useCde();
const statuses = ['available', 'rented', 'maintenance'] as const;

const record = ref<EntityRecord>();
const occupancy = ref<{ bays: number; cars: number; byStatus: Record<string, number> }>();
async function load() {
  [record.value, occupancy.value] = await Promise.all([
    apiFetch<EntityRecord>(`/api/${props.entity.path}/${props.id}`),
    apiFetch(`/api/modules/fleet/garages/${props.id}/occupancy`),
  ]);
}
onMounted(load);

const car = computed(() => props.registry.entities.Car);
const sections = computed(() =>
  props.entity.sections
    .map((s) => ({ ...s, fields: props.entity.fields.filter((f) => f.section === s.key) }))
    .filter((s) => s.fields.length),
);
const tabs = computed(() => slot(`${props.entity.name}.detail.tabs`));
const used = computed(() => (occupancy.value ? Math.min(100, (occupancy.value.cars / occupancy.value.bays) * 100) : 0));
const free = computed(() => (occupancy.value ? occupancy.value.bays - occupancy.value.cars : 0));

function remove() {
  confirm.require({
    message: 'Delete this garage?',
    header: 'Confirm',
    acceptProps: { label: 'Delete', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await apiFetch(`/api/${props.entity.path}/${props.id}`, { method: 'DELETE' });
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        toast.add({ severity: 'error', summary: 'Cannot delete', detail: e.message, life: 5000 });
        return;
      }
      toast.add({ severity: 'success', summary: 'Garage deleted', life: 2500 });
      router.push(`/${props.entity.path}`);
    },
  });
}
</script>

<template>
  <div v-if="record" class="page">
    <div class="page-header">
      <h1 data-testid="record-title">{{ recordTitle(entity, record) }}</h1>
      <Tag :value="String(record.depot)" severity="secondary" data-testid="garage-depot" />
      <RouterLink :to="`/${entity.path}/${record.id}/edit`"><Button label="Edit" icon="pi pi-pencil" severity="secondary" data-testid="btn-edit" /></RouterLink>
      <Button label="Delete" icon="pi pi-trash" severity="danger" outlined data-testid="btn-delete" @click="remove" />
    </div>

    <div class="layout">
      <section v-if="occupancy" class="card occupancy" data-testid="garage-occupancy">
        <h2 class="section-title">Occupancy <span class="module-badge">fleet</span></h2>
        <div class="big"><strong data-testid="occupancy-cars">{{ occupancy.cars }}</strong> / {{ occupancy.bays }} bays</div>
        <div class="bar" :class="{ full: free <= 0 }"><div :style="{ width: `${used}%` }" /></div>
        <div class="muted" data-testid="occupancy-free">{{ free >= 0 ? `${free} free` : `${-free} over capacity` }}</div>
        <div class="pills">
          <RouterLink
            v-for="s in statuses"
            :key="s"
            :to="{ path: '/cars', query: { 'filter[fleet.garage]': record.id, 'filter[fleet.status]': s } }"
            :class="['pill', s]"
            :data-testid="`occupancy-${s}`"
          >
            <strong>{{ occupancy.byStatus[s] ?? 0 }}</strong> {{ s }}
          </RouterLink>
        </div>
      </section>

      <section v-for="s in sections" :key="s.key" class="card details" :data-testid="`section-${s.key}`">
        <h2 class="section-title">{{ s.label }} <span v-if="s.module" class="module-badge">module: {{ s.module }}</span></h2>
        <dl class="values">
          <div v-for="f in s.fields" :key="f.key" :data-testid="`detail-${f.key}`">
            <dt>{{ f.label }}</dt>
            <dd><FieldDisplay :entity="entity" :field="f" :record="record" /></dd>
          </div>
        </dl>
      </section>
    </div>

    <Tabs value="cars" style="margin-top: 1rem">
      <TabList>
        <Tab value="cars" data-testid="tab-garage-cars">{{ car.pluralLabel }} here</Tab>
        <Tab v-for="t in tabs" :key="t.id" :value="t.id" :data-testid="`tab-${t.id}`">{{ t.title ?? t.id }}</Tab>
      </TabList>
      <TabPanels style="padding: 1rem 0 0; background: transparent">
        <TabPanel value="cars">
          <EntityTable :entity="car" :fixed-filter="{ 'filter[fleet.garage]': record.id }" embedded />
        </TabPanel>
        <TabPanel v-for="t in tabs" :key="t.id" :value="t.id">
          <component :is="t.component" :entity="entity" :record="record" :registry="registry" @changed="load" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.layout { display: flex; gap: 1rem; align-items: stretch; flex-wrap: wrap; }
.occupancy { flex: 0 1 20rem; }
.details { flex: 1 1 24rem; }
.big { font-size: 1.1rem; margin: 0.4rem 0; }
.big strong { font-size: 2rem; }
.bar { height: 0.6rem; border-radius: 99px; background: var(--p-surface-200); overflow: hidden; margin-bottom: 0.3rem; }
.bar > div { height: 100%; background: var(--p-primary-500); }
.bar.full > div { background: var(--p-red-500); }
.pills { display: flex; gap: 0.5rem; margin-top: 0.8rem; flex-wrap: wrap; }
.pill { padding: 0.3rem 0.6rem; border-radius: 8px; color: white; font-size: 0.85rem; }
.available { background: var(--p-green-600); }
.rented { background: var(--p-blue-600); }
.maintenance { background: var(--p-orange-600); }
</style>
