// @def.boundary docs-control-plane
// @def.doc docs-control-plane

export interface QualityDocumentSnapshot {
  readonly id: string;
  readonly lifecycle: string;
  readonly level?: string;
  readonly purpose?: string;
  readonly tags: readonly string[];
  readonly linkTypes: readonly string[];
}

export interface QualityDocumentSummary {
  readonly active: readonly QualityDocumentSnapshot[];
  readonly withPurpose: number;
  readonly withTags: number;
  readonly withLinks: number;
  readonly byLevel: Readonly<Record<string, number>>;
  readonly noPurpose: readonly QualityDocumentSnapshot[];
}

export function summarizeQualityDocuments(
  documents: readonly QualityDocumentSnapshot[],
): QualityDocumentSummary {
  const active = documents.filter(
    (document) => document.lifecycle !== 'deprecated' && document.lifecycle !== 'archived',
  );
  const byLevel: Record<string, number> = {};
  let withPurpose = 0;
  let withTags = 0;
  let withLinks = 0;

  for (const document of active) {
    const level = document.level ?? 'leaf';
    byLevel[level] = (byLevel[level] ?? 0) + 1;
    if (document.purpose && document.purpose.length > 0) withPurpose += 1;
    if (document.tags.length > 0) withTags += 1;
    if (document.linkTypes.some((type) => type !== 'contains')) withLinks += 1;
  }

  return {
    active,
    withPurpose,
    withTags,
    withLinks,
    byLevel,
    noPurpose: active.filter((document) => !document.purpose || document.purpose.length === 0),
  };
}

export function formatQualityLevelSummary(byLevel: Readonly<Record<string, number>>): string {
  return Object.entries(byLevel)
    .toSorted((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key}(${value})`)
    .join(' ');
}

export function countQualityLinks(documents: readonly QualityDocumentSnapshot[]): number {
  return documents.reduce((total, document) => total + document.linkTypes.length, 0);
}
