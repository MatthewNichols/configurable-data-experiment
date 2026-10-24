<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import PickList from 'primevue/picklist';
import Button from 'primevue/button';
import type { RegistryEntity, RegistryField } from '@cde/sdk';
import { defaultColumns, listColumns, setListColumns } from '../lib/columns.ts';
import { useCde } from '../lib/context.ts';

/** Choose and order a list view's columns: shown (reorderable) on the left, available on the right. */
const props = defineProps<{ entity: RegistryEntity }>();
const visible = defineModel<boolean>('visible', { required: true });
const { registry } = useCde();

const lists = ref<RegistryField[][]>([[], []]);

function split(shown: RegistryField[]) {
  const keys = new Set(shown.map((f) => f.key));
  lists.value = [[...shown], props.entity.fields.filter((f) => !keys.has(f.key))];
}

watch(visible, (open) => open && split(listColumns(registry.customer.name, props.entity)), { immediate: true });

function apply() {
  const keys = lists.value[0].map((f) => f.key);
  // matching the defaults saves nothing, so fields a module later marks `list` still appear
  const isDefault = keys.join() === defaultColumns(props.entity).map((f) => f.key).join();
  setListColumns(registry.customer.name, props.entity, isDefault ? null : keys);
  visible.value = false;
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="`${entity.pluralLabel} columns`" :style="{ width: '44rem' }" :breakpoints="{ '760px': '95vw' }">
    <PickList v-model="lists" data-key="key" :show-target-controls="false" breakpoint="640px" scroll-height="18rem" data-testid="column-chooser">
      <template #sourceheader>Shown</template>
      <template #targetheader>Available</template>
      <template #option="{ option }">
        <span :data-testid="`column-option-${option.key}`">{{ option.label }}</span>
        <span v-if="option.module" class="module-badge" style="margin-left: 0.4rem">{{ option.module }}</span>
      </template>
    </PickList>
    <template #footer>
      <Button label="Reset to defaults" severity="secondary" text @click="split(defaultColumns(entity))" data-testid="columns-reset" />
      <Button label="Cancel" severity="secondary" @click="visible = false" />
      <Button label="Apply" icon="pi pi-check" :disabled="!lists[0].length" @click="apply" data-testid="columns-apply" />
    </template>
  </Dialog>
</template>
