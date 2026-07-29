// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { DefDoc } from 'definition-catalog';

export function printDefinitionRows(docs: readonly DefDoc[]): void {
  for (const doc of docs) {
    const levelBadge = doc.level && doc.level !== 'leaf' ? `[${doc.level}] ` : '';
    const tags = doc.tags.length > 0 ? ` [${doc.tags.join(',')}]` : '';
    console.log(
      `  ${levelBadge}${doc.docId}  ${doc.scope}/${doc.aspect}  ${doc.lifecycle}${tags}`,
    );
    if (doc.purpose) console.log(`    ${doc.purpose.slice(0, 100)}`);
  }
}

export function printDefinitionPageSummary(
  mode: string | undefined,
  total: number,
  offset: number,
  pageLength: number,
  label = '',
): number {
  const from = offset + 1;
  const to = offset + pageLength;
  const remaining = total - to;
  console.log(
    `${label}${mode ? `[${mode}] ` : ''}${from}-${to} / ${total}건${remaining > 0 ? ` (미표시 ${remaining}건)` : ''}`,
  );
  return to;
}

export function printDefinitionNextPage(to: number, limit: number, suffix = ''): void {
  console.log(`\n  다음 페이지: --offset=${to} --limit=${limit}${suffix}`);
}
