<script setup lang="ts">
import { useCde } from '../lib/context.ts';

/** Renders every installed module's contribution to a named slot. */
const props = defineProps<{ name: string }>();
defineOptions({ inheritAttrs: false });
const { slot, registry } = useCde();
const items = slot(props.name);
</script>

<template>
  <component :is="item.component" v-for="item in items" :key="item.id" v-bind="$attrs" :registry="registry" :data-slot="name" />
</template>
