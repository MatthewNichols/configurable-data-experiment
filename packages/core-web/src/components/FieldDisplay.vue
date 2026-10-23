<script setup lang="ts">
import { computed } from 'vue';
import Tag from 'primevue/tag';
import { getFieldValue, type EntityRecord, type RegistryEntity, type RegistryField } from '@cde/sdk';
import { useCde } from '../lib/context.ts';
import { refTitle } from '../lib/refs.ts';

const props = defineProps<{ entity: RegistryEntity; field: RegistryField; record: EntityRecord }>();
const { registry, fieldRenderer } = useCde();
const value = computed(() => getFieldValue(props.record, props.field));
const custom = computed(() => fieldRenderer(props.entity.name, props.field.key));
const target = computed(() => (props.field.type === 'reference' ? registry.entities[props.field.ref!] : undefined));
</script>

<template>
  <component :is="custom" v-if="custom" :value="value" :field="field" :record="record" />
  <span v-else-if="value === null || value === undefined || value === ''" class="muted">—</span>
  <Tag v-else-if="field.type === 'enum'" :value="String(value)" severity="secondary" />
  <span v-else-if="field.type === 'bool'"><i :class="value ? 'pi pi-check' : 'pi pi-times muted'" /> {{ value ? 'Yes' : 'No' }}</span>
  <RouterLink v-else-if="target" :to="`/${target.path}/${value}`" @click.stop>{{ refTitle(target, String(value)) }}</RouterLink>
  <span v-else-if="field.type === 'text'" style="white-space: pre-wrap">{{ value }}</span>
  <span v-else>{{ value }}</span>
</template>
