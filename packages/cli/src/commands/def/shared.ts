// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
export { closeDataSource } from '../../lib/data-source-runtime.js';

export function getRootDir(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml')) && existsSync(join(current, 'docs'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

export function formatLinkRef(id: string, address?: string): string {
  return address ? `${id} <${address}>` : id;
}

export function parseCsvFlag(
  value?: string,
  options: { readonly bareFlagIsEmpty?: boolean } = {},
): string[] {
  if (!value || (options.bareFlagIsEmpty && value === 'true')) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
