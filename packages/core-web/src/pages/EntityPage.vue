<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import type { PageKind } from '@cde/sdk/web';
import EntityListPage from './EntityListPage.vue';
import EntityDetailPage from './EntityDetailPage.vue';
import EntityFormPage from './EntityFormPage.vue';
import { useCde } from '../lib/context.ts';

/** Renders a module's page override for this entity if one is installed, else the generic page. */
const props = defineProps<{ kind: PageKind }>();
const route = useRoute();
const { registry, entityByPath, page } = useCde();
const generic = { list: EntityListPage, detail: EntityDetailPage, form: EntityFormPage };
const entity = computed(() => entityByPath(String(route.params.entity)));
const override = computed(() => entity.value && page(entity.value.name, props.kind));
</script>

<template>
  <component :is="override" v-if="override" :entity="entity" :registry="registry" :id="route.params.id as string | undefined" />
  <component :is="generic[kind]" v-else />
</template>
