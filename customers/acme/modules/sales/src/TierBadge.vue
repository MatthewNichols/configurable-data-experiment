<script setup lang="ts">
const props = defineProps<{ value: unknown }>();
const colours: Record<string, string> = { bronze: '#b0703c', silver: '#8a96a3', gold: '#c9a227', platinum: '#5b6b7a' };
</script>

<template>
  <span v-if="props.value" class="tier" :style="{ background: colours[String(props.value)] ?? '#999' }" data-testid="tier-badge">
    ★ {{ String(props.value).toUpperCase() }}
  </span>
  <span v-else class="muted">—</span>
</template>

<style scoped>
.tier { color: white; font-weight: 700; font-size: 0.75rem; letter-spacing: 0.05em; padding: 0.2rem 0.55rem; border-radius: 999px; }
</style>
