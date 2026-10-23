declare module 'virtual:cde-modules' {
  import type { WebModule } from '@cde/sdk/web';
  export const webModules: Record<string, WebModule>;
}
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, any>;
  export default component;
}
