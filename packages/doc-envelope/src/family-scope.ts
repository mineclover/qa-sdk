// @def.doc doc-envelope

import type { DocumentEnvelope } from './types.js';

export interface DocumentFamilyOnlyScopeOptions {
  readonly target: DocumentEnvelope;
  /**
   * Envelope 생성 시 adapter가 `metadata.transient = true`로 표시한 문서를
   * family-only scope에 포함할지 여부. 플래그의 의미는 adapter 소유다 (예:
   * `ralph-tui-integration`의 ralph-session adapter가 `.ralph-tui/` 세션 문서에
   * 이 플래그를 스탬프한다). `doc-envelope`은 특정 도구의 경로나 kind를 알지
   * 못한다.
   */
  readonly includeTransient?: boolean;
}

export interface DocumentFamilyOnlyScope {
  readonly documents: readonly DocumentEnvelope[];
  readonly reasonByDocumentKey: ReadonlyMap<string, string>;
}

const FAMILY_ONLY_ROLE_KINDS = new Set([
  'spec',
  'todo',
  'plan',
  'rule',
  'cases',
  'test',
  'memo',
  'knowledge',
  'prd',
  'ralph-prd-json',
]);

export function collectDocumentFamilyOnlyScope(
  documents: readonly DocumentEnvelope[],
  options: DocumentFamilyOnlyScopeOptions,
): DocumentFamilyOnlyScope {
  const selected = new Map<string, DocumentEnvelope>();
  const reasonByDocumentKey = new Map<string, string>();
  const target = options.target;

  addFamilyScopedDocument(selected, reasonByDocumentKey, target, 'target');

  if (target.familyId) {
    for (const document of documents) {
      if (document.familyId !== target.familyId) continue;
      if (!isFamilyOnlyRoleDocument(document, options.includeTransient === true)) continue;
      if (!isActiveFamilyOnlyDocument(document, options)) continue;
      addFamilyScopedDocument(
        selected,
        reasonByDocumentKey,
        document,
        isTransientDocument(document) ? 'family-only:transient' : 'family-only:role',
      );
    }
  }

  if (isContainableFamilyRoot(target)) {
    for (const link of target.links) {
      if (link.type !== 'contains') continue;
      const contained = resolveDocumentReference(documents, link.targetId);
      if (!contained) continue;
      if (!isDirectContainedDefinitionNode(contained)) continue;
      if (!isActiveFamilyOnlyDocument(contained, options)) continue;
      addFamilyScopedDocument(selected, reasonByDocumentKey, contained, 'family-only:contains');
    }
  }

  if (isLayoutFamilyRoot(target)) {
    for (const link of target.links) {
      if (link.type !== 'refs') continue;
      const referenced = resolveDocumentReference(documents, link.targetId);
      if (!referenced) continue;
      if (!isActiveFamilyOnlyDocument(referenced, options)) continue;
      addFamilyScopedDocument(selected, reasonByDocumentKey, referenced, 'family-only:refs');
    }
  }

  return {
    documents: [...selected.values()].toSorted(compareDocuments),
    reasonByDocumentKey,
  };
}

export function isArchivedPrdDocument(document: DocumentEnvelope): boolean {
  if (document.kind !== 'prd' && document.kind !== 'ralph-prd-json') return false;
  if (document.metadata.lifecycle === 'archived') return true;
  return normalizePath(document.path).split('/').includes('archive');
}

/**
 * Adapter가 envelope 생성 시 `metadata.transient = true`로 스탬프한 문서인지
 * 판별한다. 구체적인 transient 소스(예: `.ralph-tui/` 세션)의 정의는 adapter
 * 소유이며, `doc-envelope`은 플래그만 본다.
 */
export function isTransientDocument(document: DocumentEnvelope): boolean {
  return document.metadata.transient === true;
}

function isFamilyOnlyRoleDocument(document: DocumentEnvelope, includeTransient: boolean): boolean {
  if (document.metadata.type === 'knowledge') return true;
  if (FAMILY_ONLY_ROLE_KINDS.has(document.kind)) return true;
  return includeTransient && isTransientDocument(document);
}

function isContainableFamilyRoot(document: DocumentEnvelope): boolean {
  return (
    document.metadata.tier === 'system' ||
    document.metadata.level === 'group' ||
    document.metadata.level === 'module'
  );
}

function isLayoutFamilyRoot(document: DocumentEnvelope): boolean {
  return document.metadata.tier === 'layout';
}

function isDirectContainedDefinitionNode(document: DocumentEnvelope): boolean {
  if (typeof document.metadata.defId === 'string' && document.metadata.defId.length > 0) {
    return true;
  }
  return (
    document.metadata.level === 'group' ||
    document.metadata.level === 'module' ||
    document.metadata.level === 'leaf' ||
    document.metadata.tier === 'system' ||
    document.metadata.tier === 'layout' ||
    document.metadata.tier === 'component' ||
    document.metadata.tier === 'entry'
  );
}

function isActiveFamilyOnlyDocument(
  document: DocumentEnvelope,
  options: DocumentFamilyOnlyScopeOptions,
): boolean {
  if (document === options.target) return true;
  if (isArchivedPrdDocument(document)) return false;
  if (isTransientDocument(document)) return options.includeTransient === true;
  return true;
}

function addFamilyScopedDocument(
  selected: Map<string, DocumentEnvelope>,
  reasonByDocumentKey: Map<string, string>,
  document: DocumentEnvelope,
  reason: string,
): void {
  const key = documentKey(document);
  selected.set(key, document);
  if (!reasonByDocumentKey.has(key) || reason === 'target') {
    reasonByDocumentKey.set(key, reason);
  }
}

function resolveDocumentReference(
  documents: readonly DocumentEnvelope[],
  targetId: string,
): DocumentEnvelope | undefined {
  const normalizedTarget = normalizePath(targetId);
  return documents.find(
    (document) =>
      documentIdentityValues(document).includes(targetId) ||
      documentIdentityValues(document).includes(normalizedTarget),
  );
}

function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    document.stableId,
    document.familyId,
    document.path,
    normalizePath(document.path),
    asString(document.metadata.defId),
    asString(document.metadata.title),
    asString(document.metadata.name),
    asString(document.metadata.sourcePath),
    asString(document.metadata.outputPath),
  ]);
}

function compareDocuments(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return (
    left.path.localeCompare(right.path) ||
    left.kind.localeCompare(right.kind) ||
    left.stableId.localeCompare(right.stableId)
  );
}

function documentKey(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/g, '/');
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
