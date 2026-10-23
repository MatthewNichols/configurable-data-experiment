<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { ApiError, apiFetch } from '@cde/sdk/web';
import { entityInputSchema, flattenIssues, getFieldValue, recordTitle, setFieldValue, type EntityRecord } from '@cde/sdk';
import FieldEditor from '../components/FieldEditor.vue';
import { useCde } from '../lib/context.ts';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { entityByPath } = useCde();
const entity = computed(() => entityByPath(String(route.params.entity))!);
const id = computed(() => route.params.id as string | undefined);

// the same zod schema the server uses, built from the registry: instant client-side validation
const schema = computed(() => entityInputSchema(entity.value));
const form = ref<Partial<EntityRecord>>({ ext: {} });
const errors = ref<Record<string, string>>({});
const saving = ref(false);
const title = ref('');

const editable = computed(() => entity.value.fields.filter((f) => !f.readOnly));
const sections = computed(() =>
  entity.value.sections
    .map((s) => ({ ...s, fields: editable.value.filter((f) => f.section === s.key) }))
    .filter((s) => s.fields.length),
);

onMounted(async () => {
  if (!id.value) return;
  const rec = await apiFetch<EntityRecord>(`/api/${entity.value.path}/${id.value}`);
  title.value = recordTitle(entity.value, rec);
  const f: Partial<EntityRecord> = { ext: {} };
  for (const field of editable.value) setFieldValue(f, field, getFieldValue(rec, field) ?? null);
  form.value = f;
});

function value(key: string) {
  return getFieldValue(form.value, entity.value.fields.find((f) => f.key === key)!);
}
function update(key: string, v: unknown) {
  setFieldValue(form.value, entity.value.fields.find((f) => f.key === key)!, v);
}

async function save() {
  errors.value = {};
  const parsed = schema.value.safeParse(form.value);
  if (!parsed.success) {
    errors.value = flattenIssues(parsed.error);
    return;
  }
  saving.value = true;
  try {
    const rec = await apiFetch<EntityRecord>(id.value ? `/api/${entity.value.path}/${id.value}` : `/api/${entity.value.path}`, {
      method: id.value ? 'PUT' : 'POST',
      body: parsed.data,
    });
    toast.add({ severity: 'success', summary: `${entity.value.label} saved`, life: 2500 });
    router.push(`/${entity.value.path}/${rec.id}`);
  } catch (e) {
    if (e instanceof ApiError) {
      errors.value = e.fieldErrors ?? {};
      toast.add({ severity: 'error', summary: e.message, life: 4000 });
    } else throw e;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>{{ id ? `Edit ${title || entity.label.toLowerCase()}` : `New ${entity.label.toLowerCase()}` }}</h1>
    </div>
    <form class="stack" data-testid="entity-form" @submit.prevent="save">
      <section v-for="s in sections" :key="s.key" class="card" :data-testid="`section-${s.key}`">
        <h2 class="section-title">
          {{ s.label }} <span v-if="s.module" class="module-badge">module: {{ s.module }}</span>
        </h2>
        <div class="form-grid">
          <FieldEditor
            v-for="f in s.fields"
            :key="f.key"
            :field="f"
            :error="errors[f.key]"
            :model-value="value(f.key)"
            @update:model-value="(v) => update(f.key, v)"
          />
        </div>
      </section>
      <div class="page-header">
        <span style="flex: 1" />
        <Button label="Cancel" severity="secondary" text @click="router.back()" />
        <Button type="submit" label="Save" icon="pi pi-check" :loading="saving" data-testid="btn-save" />
      </div>
    </form>
  </div>
</template>
