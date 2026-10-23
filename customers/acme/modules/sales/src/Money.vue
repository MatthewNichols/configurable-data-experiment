<script setup lang="ts">
defineProps<{ value: unknown }>();
</script>

<template>
  <span v-if="value !== null && value !== undefined" data-testid="money">{{
    Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }}</span>
  <span v-else class="muted">—</span>
</template>
