import type { TaxonomyIR, AxisIR, RelationIR } from '../schema/ir.js';

const HEADER = '// 자동 생성 파일. 수동 편집 금지. taxonomy-engine codegen 산출물.\n\n';

function pascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function upper(name: string): string {
  return name.replace(/-/g, '_').toUpperCase();
}

function stripLoc<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (k, v) => (k === '_loc' ? undefined : v)));
}

export function renderAxes(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, axis] of [...ir.axes].sort(([a], [b]) => a.localeCompare(b))) {
    const ids = axis.entries.map((e) => `"${e.id}"`).join(' | ');
    lines.push(`export type ${pascal(name)}Id = ${ids};\n\n`);
  }
  return lines.join('');
}

export function renderAddresses(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, axis] of [...ir.axes].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`export const ${upper(name)}_ADDR = {\n`);
    for (const e of axis.entries) {
      lines.push(`  ${e.id}: ${e.address},\n`);
    }
    lines.push(`} as const;\n\n`);
  }
  return lines.join('');
}

export function renderRegistry(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, axis] of [...ir.axes].sort(([a], [b]) => a.localeCompare(b))) {
    const stripped = stripLoc(axis) as AxisIR;
    lines.push(
      `export const ${upper(name)}_ENTRIES = ${JSON.stringify(stripped, null, 2)} as const;\n\n`,
    );
  }
  return lines.join('');
}

export function renderRelations(ir: TaxonomyIR): string {
  const lines: string[] = [HEADER];
  for (const [name, rel] of [...ir.relations].sort(([a], [b]) => a.localeCompare(b))) {
    const stripped = stripLoc(rel) as RelationIR;
    lines.push(`export const ${upper(name)} = ${JSON.stringify(stripped, null, 2)} as const;\n\n`);
  }
  return lines.join('');
}

export function renderMeta(ir: TaxonomyIR, contentHash: string, generatedAt: string): string {
  return (
    HEADER +
    `export const TAXONOMY_META = {
  taxonomy: ${JSON.stringify(ir.taxonomy)},
  version: ${ir.version},
  contentHash: ${JSON.stringify(contentHash)},
  generatedAt: ${JSON.stringify(generatedAt)},
} as const;
`
  );
}
