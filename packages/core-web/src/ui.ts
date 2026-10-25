/**
 * Building blocks for module page overrides (`pages` in defineWebModule), so a custom page can
 * compose the generic pieces instead of copying them. Import from '@cde/core-web/ui'.
 */
export { default as EntityTable } from './components/EntityTable.vue';
export { default as FieldDisplay } from './components/FieldDisplay.vue';
export { default as ModuleSlot } from './components/ModuleSlot.vue';
export { useCde } from './lib/context.ts';
