<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { apiFetch } from '@cde/sdk/web';
import { recordTitle, type EntityRecord } from '@cde/sdk';
import EntityTable from '../components/EntityTable.vue';
import FieldDisplay from '../components/FieldDisplay.vue';
import ModuleSlot from '../components/ModuleSlot.vue';
import { useCde } from '../lib/context.ts';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const { registry, entityByPath, slot } = useCde();
const entity = computed(() => entityByPath(String(route.params.entity))!);
const record = ref<EntityRecord>();

async function load() {
  record.value = await apiFetch<EntityRecord>(`/api/${entity.value.path}/${route.params.id}`);
}
onMounted(load);

const sections = computed(() =>
  entity.value.sections
    .map((s) => ({ ...s, fields: entity.value.fields.filter((f) => f.section === s.key) }))
    .filter((s) => s.fields.length),
);

/** Reverse references: other entities with a reference field pointing here (e.g. a customer's cars). */
const related = computed(() =>
  Object.values(registry.entities).flatMap((e) =>
    e.fields
      .filter((f) => f.type === 'reference' && f.ref === entity.value.name && f.operators.includes('eq'))
      .map((f) => ({ entity: e, field: f })),
  ),
);
const tabs = computed(() => slot(`${entity.value.name}.detail.tabs`));

function remove() {
  confirm.require({
    message: `Delete this ${entity.value.label.toLowerCase()}?`,
    header: 'Confirm',
    acceptProps: { label: 'Delete', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    accept: async () => {
      await apiFetch(`/api/${entity.value.path}/${route.params.id}`, { method: 'DELETE' });
      toast.add({ severity: 'success', summary: `${entity.value.label} deleted`, life: 2500 });
      router.push(`/${entity.value.path}`);
    },
  });
}
</script>

<template>
  <div v-if="record" class="page">
    <div class="page-header">
      <h1 data-testid="record-title">{{ recordTitle(entity, record) }}</h1>
      <RouterLink :to="`/${entity.path}/${record.id}/edit`"><Button label="Edit" icon="pi pi-pencil" severity="secondary" data-testid="btn-edit" /></RouterLink>
      <Button label="Delete" icon="pi pi-trash" severity="danger" outlined data-testid="btn-delete" @click="remove" />
    </div>
    <Tabs value="details">
      <TabList>
        <Tab value="details">Details</Tab>
        <Tab v-for="r in related" :key="`rel-${r.entity.name}-${r.field.key}`" :value="`rel-${r.entity.name}-${r.field.key}`">
          {{ r.entity.pluralLabel }}
        </Tab>
        <Tab v-for="t in tabs" :key="t.id" :value="t.id" :data-testid="`tab-${t.id}`">{{ t.title ?? t.id }}</Tab>
      </TabList>
      <TabPanels style="padding: 1rem 0 0; background: transparent">
        <TabPanel value="details">
          <div class="detail-layout">
            <div class="stack" style="flex: 1">
              <section v-for="s in sections" :key="s.key" class="card" :data-testid="`section-${s.key}`">
                <h2 class="section-title">{{ s.label }} <span v-if="s.module" class="module-badge">module: {{ s.module }}</span></h2>
                <dl class="values">
                  <div v-for="f in s.fields" :key="f.key" :data-testid="`detail-${f.key}`">
                    <dt>{{ f.label }}</dt>
                    <dd><FieldDisplay :entity="entity" :field="f" :record="record" /></dd>
                  </div>
                </dl>
              </section>
            </div>
            <ModuleSlot :name="`${entity.name}.detail.aside`" :entity="entity" :record="record" />
          </div>
        </TabPanel>
        <TabPanel v-for="r in related" :key="`rel-${r.entity.name}-${r.field.key}`" :value="`rel-${r.entity.name}-${r.field.key}`">
          <EntityTable :entity="r.entity" :fixed-filter="{ [`filter[${r.field.key}]`]: record.id }" embedded />
        </TabPanel>
        <TabPanel v-for="t in tabs" :key="t.id" :value="t.id">
          <component :is="t.component" :entity="entity" :record="record" :registry="registry" @changed="load" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.detail-layout { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
</style>
