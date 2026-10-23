<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { ApiError, apiFetch } from '@cde/sdk/web';
import type { EntityRecord } from '@cde/sdk';

interface ServiceRecord {
  id: string;
  date: string;
  mileage: number | null;
  description: string;
  cost: number | null;
}

const props = defineProps<{ record: EntityRecord }>();
const emit = defineEmits<{ changed: [] }>();
const base = `/api/modules/serviceHistory/cars/${props.record.id}/records`;
const records = ref<ServiceRecord[]>([]);
const form = reactive({ date: new Date().toISOString().slice(0, 10), mileage: '', description: '', cost: '' });
const errors = ref<Record<string, string>>({});

async function load() {
  records.value = await apiFetch<ServiceRecord[]>(base);
}
onMounted(load);

async function add() {
  errors.value = {};
  try {
    await apiFetch(base, {
      method: 'POST',
      body: {
        date: form.date,
        description: form.description,
        mileage: form.mileage === '' ? null : Number(form.mileage),
        cost: form.cost === '' ? null : Number(form.cost),
      },
    });
    Object.assign(form, { mileage: '', description: '', cost: '' });
    await load();
    emit('changed');
  } catch (e) {
    if (e instanceof ApiError) errors.value = e.fieldErrors;
    else throw e;
  }
}

async function remove(id: string) {
  await apiFetch(`/api/modules/serviceHistory/records/${id}`, { method: 'DELETE' });
  await load();
  emit('changed');
}
const money = (v: number | null) => (v === null ? '—' : v.toLocaleString(undefined, { style: 'currency', currency: 'USD' }));
</script>

<template>
  <div class="stack" data-testid="service-history">
    <form class="card filters" @submit.prevent="add" data-testid="service-form">
      <div class="field"><label>Date</label><InputText v-model="form.date" type="date" /></div>
      <div class="field" style="grid-column: span 2">
        <label>Work done</label>
        <InputText v-model="form.description" placeholder="e.g. Oil and filter change" data-testid="service-description" :invalid="!!errors.description" />
        <small v-if="errors.description" class="error">{{ errors.description }}</small>
      </div>
      <div class="field"><label>Mileage</label><InputText v-model="form.mileage" type="number" /></div>
      <div class="field"><label>Cost</label><InputText v-model="form.cost" type="number" step="0.01" /></div>
      <Button type="submit" label="Add record" icon="pi pi-plus" data-testid="service-add" />
    </form>
    <div class="card" style="padding: 0; overflow: hidden">
      <DataTable :value="records" data-key="id" striped-rows>
        <template #empty><div class="muted">No service records yet.</div></template>
        <Column field="date" header="Date" />
        <Column field="description" header="Work done" />
        <Column field="mileage" header="Mileage" />
        <Column header="Cost"><template #body="{ data }">{{ money(data.cost) }}</template></Column>
        <Column style="width: 4rem">
          <template #body="{ data }">
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete" @click="remove(data.id)" />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
