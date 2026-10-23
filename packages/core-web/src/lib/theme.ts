import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import type { CustomerTheme } from '@cde/sdk';

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const palette = (name: string) => Object.fromEntries(shades.map((s) => [s, `{${name}.${s}}`]));

/** Per-customer branding: swap the primary/surface palettes of the Aura preset. */
export function customerPreset(theme: CustomerTheme) {
  return definePreset(Aura, {
    semantic: {
      primary: palette(theme.primary ?? 'indigo'),
      colorScheme: { light: { surface: { 0: '#ffffff', ...palette(theme.surface ?? 'slate') } } },
    },
  });
}
