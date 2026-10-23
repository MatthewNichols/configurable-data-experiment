import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const customersDir = path.join(repoRoot, 'customers');
export const customerDir = (name: string) => path.join(customersDir, name);
export const defaultOutDir = (name: string) => path.join(customerDir(name), '.cde');

/** Import specifier usable from a generated file in `fromDir`. */
export function relImport(fromDir: string, target: string): string {
  let rel = path.relative(fromDir, target).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}
