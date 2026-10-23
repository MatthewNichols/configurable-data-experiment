<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DataTable, { type DataTablePageEvent, type DataTableSortEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { apiFetch } from '@cde/sdk/web';
import { recordTitle, type EntityRecord, type RegistryEntity, type RegistryField } from '@cde/sdk';
import FieldDisplay from './FieldDisplay.vue';
import { useCde } from '../lib/context.ts';
import { rememberTitle } from '../lib/refs.ts';

/**
 * Metadata-driven list: columns from fields marked `list`, filter controls from each field's
 * search operators plus module-declared filters. Query state lives in the URL (unless embedded).
 */
const props = defineProps<{ entity: RegistryEntity; fixedFilter?: Record<string, string>; embedded?: boolean }>();
const { registry } = useCde();
const route = useRoute();
const router = useRouter();

type Query = Record<string, string>;
const state = reactive<Query>(props.embedded ? {} : { ...(route.query as Query) });
const items = ref<EntityRecord[]>([]);
const total = ref(0);
const loading = ref(false);
const pageSize = 10;

const columns = computed(() => {
  const listed = props.entity.fields.filter((f) => f.list);
  return (listed.length ? listed : props.entity.fields.slice(0, 4)).filter((f) => !props.fixedFilter?.[`filter[${f.key}]`]);
});

interface Control {
  key: string;
  label: string;
  kind: 'text' | 'select' | 'range' | 'number';
  param: string;
  options?: { label: string; value: string }[];
  field?: RegistryField;
}
const refOptions = reactive<Record<string, { label: string; value: string }[]>>({});
const yesNo = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
];
const controls = computed<Control[]>(() => {
  const out: Control[] = [];
  for (const f of props.entity.fields) {
    if (!f.operators.length || props.fixedFilter?.[`filter[${f.key}]`]) continue;
    const label = f.module ? `${f.label}` : f.label;
    if (f.operators.includes('gte')) out.push({ key: f.key, label, kind: 'range', param: `filter[${f.key}]`, field: f });
    else if (f.type === 'enum') out.push({ key: f.key, label, kind: 'select', param: `filter[${f.key}]`, options: f.values!.map((v) => ({ label: v, value: v })) });
    else if (f.type === 'bool') out.push({ key: f.key, label, kind: 'select', param: `filter[${f.key}]`, options: yesNo });
    else if (f.type === 'reference') out.push({ key: f.key, label, kind: 'select', param: `filter[${f.key}]`, options: refOptions[f.key] ?? [], field: f });
    else if (f.operators.includes('like')) out.push({ key: f.key, label, kind: 'text', param: `filter[${f.key}][like]` });
    else out.push({ key: f.key, label, kind: f.type === 'int' || f.type === 'decimal' ? 'number' : 'text', param: `filter[${f.key}]` });
  }
  for (const flt of props.entity.filters) {
    const options = flt.type === 'bool' ? yesNo : flt.values?.map((v) => ({ label: v, value: v }));
    out.push({ key: flt.key, label: flt.label, kind: options ? 'select' : 'text', param: `filter[${flt.key}]`, options });
  }
  return out;
});

async function load() {
  loading.value = true;
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  for (const [k, v] of Object.entries({ ...state, ...props.fixedFilter })) if (v !== '' && v !== undefined && v !== null) params.set(k, v);
  try {
    const res = await apiFetch<{ items: EntityRecord[]; total: number }>(`/api/${props.entity.path}?${params}`);
    items.value = res.items;
    total.value = res.total;
    res.items.forEach((r) => rememberTitle(props.entity, r));
  } finally {
    loading.value = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  state,
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!props.embedded) {
        const query = Object.fromEntries(Object.entries(state).filter(([, v]) => v !== '' && v !== null && v !== undefined));
        router.replace({ query });
      }
      load();
    }, 250);
  },
  { deep: true },
);

onMounted(async () => {
  load();
  for (const f of props.entity.fields.filter((x) => x.type === 'reference' && x.operators.length)) {
    const target = registry.entities[f.ref!];
    const { items: opts } = await apiFetch<{ items: EntityRecord[] }>(`/api/${target.path}?pageSize=200`);
    refOptions[f.key] = opts.map((r) => ({ label: recordTitle(target, r), value: r.id }));
  }
});

function onPage(e: DataTablePageEvent) {
  state.page = String(e.page + 1);
}
function onSort(e: DataTableSortEvent) {
  state.sort = String(e.sortField ?? '');
  state.order = e.sortOrder === 1 ? 'asc' : 'desc';
}
function clear() {
  for (const k of Object.keys(state)) delete state[k];
}
const hasFilters = computed(() => Object.keys(state).some((k) => k !== 'page' && state[k]));
const first = computed(() => (Number(state.page || 1) - 1) * pageSize);
</script>

<template>
  <div class="stack" :data-testid="`entity-table-${entity.name}`">
    <div v-if="!embedded" class="card stack">
      <div class="page-header" style="margin: 0">
        <IconField style="flex: 1; min-width: 240px">
          <InputIcon class="pi pi-search" />
          <InputText v-model="state.q" :placeholder="`Search ${entity.pluralLabel.toLowerCase()}…`" style="width: 100%" data-testid="search-q" />
        </IconField>
        <Button v-if="hasFilters" label="Clear" icon="pi pi-filter-slash" severity="secondary" text @click="clear" data-testid="filters-clear" />
      </div>
      <div class="filters">
        <div v-for="c in controls" :key="c.key" class="field" :data-testid="`filter-${c.key}`">
          <label>{{ c.label }}</label>
          <div v-if="c.kind === 'range'" class="range">
            <InputText v-model="state[`${c.param}[gte]`]" :type="c.field!.type === 'date' ? 'date' : 'number'" placeholder="from" data-testid="gte" />
            <InputText v-model="state[`${c.param}[lte]`]" :type="c.field!.type === 'date' ? 'date' : 'number'" placeholder="to" data-testid="lte" />
          </div>
          <Select
            v-else-if="c.kind === 'select'"
            v-model="state[c.param]"
            :options="c.options"
            option-label="label"
            option-value="value"
            show-clear
            :filter="(c.options?.length ?? 0) > 8"
            placeholder="Any"
          />
          <InputText v-else v-model="state[c.param]" :type="c.kind === 'number' ? 'number' : 'text'" placeholder="Any" />
        </div>
      </div>
    </div>
    <div class="card" style="padding: 0; overflow-x: auto">
      <DataTable
        :value="items"
        lazy
        paginator
        :rows="pageSize"
        :first="first"
        :total-records="total"
        :loading="loading"
        :sort-field="state.sort"
        :sort-order="state.order === 'asc' ? 1 : state.order === 'desc' ? -1 : 0"
        data-key="id"
        class="clickable-rows"
        striped-rows
        @page="onPage"
        @sort="onSort"
        @row-click="(e) => router.push(`/${entity.path}/${e.data.id}`)"
      >
        <template #empty><div class="muted" data-testid="empty">No {{ entity.pluralLabel.toLowerCase() }} found.</div></template>
        <Column v-for="f in columns" :key="f.key" :field="f.key" :sortable="f.source !== 'computed'">
          <template #header>
            <span>{{ f.label }}</span>
            <span v-if="f.module" class="module-badge" style="margin-left: 0.4rem" :title="`from module ${f.module}`">{{ f.module }}</span>
          </template>
          <template #body="{ data }">
            <FieldDisplay :entity="entity" :field="f" :record="data" />
          </template>
        </Column>
      </DataTable>
      <div class="muted" style="padding: 0.5rem 1rem; font-size: 0.8rem" data-testid="total">{{ total }} {{ total === 1 ? entity.label.toLowerCase() : entity.pluralLabel.toLowerCase() }}</div>
    </div>
  </div>
</template>
