<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import { apiFetch } from '@cde/sdk/web';
import { recordTitle, type EntityRecord, type RegistryField } from '@cde/sdk';
import { useCde } from '../lib/context.ts';

const props = defineProps<{ field: RegistryField; error?: string }>();
const model = defineModel<unknown>();
const { registry } = useCde();
const id = computed(() => `f-${props.field.key.replace('.', '-')}`);

const numberValue = computed({
  get: () => (model.value === null || model.value === undefined ? '' : String(model.value)),
  set: (v) => (model.value = v === '' || v === null ? null : Number(v)),
});

const refOptions = ref<{ label: string; value: string }[]>([]);
onMounted(async () => {
  if (props.field.type !== 'reference') return;
  const target = registry.entities[props.field.ref!];
  const { items } = await apiFetch<{ items: EntityRecord[] }>(`/api/${target.path}?pageSize=200&sort=createdAt&order=asc`);
  refOptions.value = items.map((r) => ({ label: recordTitle(target, r), value: r.id }));
});
</script>

<template>
  <div class="field" :data-testid="`field-${field.key}`" :data-type="field.type">
    <label :for="id">{{ field.label }}<span v-if="field.required"> *</span></label>
    <Textarea v-if="field.type === 'text'" :id="id" v-model="model as string" rows="3" auto-resize :invalid="!!error" />
    <InputText
      v-else-if="field.type === 'int' || field.type === 'decimal'"
      :id="id"
      v-model="numberValue"
      type="number"
      :step="field.type === 'int' ? 1 : 0.01"
      :min="field.min"
      :max="field.max"
      :placeholder="field.example !== undefined ? String(field.example) : undefined"
      :invalid="!!error"
    />
    <InputText v-else-if="field.type === 'date'" :id="id" v-model="model as string" type="date" :invalid="!!error" />
    <div v-else-if="field.type === 'bool'"><ToggleSwitch :input-id="id" v-model="model as boolean" /></div>
    <Select
      v-else-if="field.type === 'enum'"
      :input-id="id"
      v-model="model"
      :options="field.values as string[]"
      show-clear
      placeholder="—"
      :invalid="!!error"
    />
    <Select
      v-else-if="field.type === 'reference'"
      :input-id="id"
      v-model="model"
      :options="refOptions"
      option-label="label"
      option-value="value"
      filter
      show-clear
      placeholder="—"
      :invalid="!!error"
    />
    <InputText
      v-else
      :id="id"
      v-model="model as string"
      :maxlength="field.maxLength"
      :placeholder="field.example !== undefined ? String(field.example) : undefined"
      :invalid="!!error"
    />
    <small v-if="field.description" class="muted">{{ field.description }}</small>
    <small v-if="error" class="error" :data-testid="`error-${field.key}`">{{ error }}</small>
  </div>
</template>
