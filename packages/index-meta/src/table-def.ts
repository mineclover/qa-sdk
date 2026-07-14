// @def.boundary index-meta-system
// @def.doc index-meta-system

import { ValidationError } from './errors.js';

// ── Address ref ───────────────────────────────────────────

export interface AddressRef {
  readonly prefix: string;
  readonly version: string;
}

// ── Version 형태 ──────────────────────────────────────────

export interface LeafVersion {
  readonly capacity: number;
}

export interface CompositeVersion {
  readonly refs: Record<string, AddressRef>;
}

export type TableVersion = LeafVersion | CompositeVersion;

export function isLeafVersion(v: TableVersion): v is LeafVersion {
  return 'capacity' in v;
}

// ── TableDef ──────────────────────────────────────────────

export interface TableDef {
  readonly _type: 'table';
  readonly id: string;
  /** leaf only — 원본 값의 kind */
  readonly source?: {
    readonly kind: { type: 'string_enum' } | { type: 'number_enum' };
  };
  /** composite only — 조합할 테이블 목록 */
  readonly dims?: readonly TableDef[];
  /** 버전 — capacity가 바뀔 때만 추가 */
  readonly versions: Record<string, TableVersion>;
  readonly description?: string;
}

// ── defineTable ───────────────────────────────────────────

export function defineTable(
  id: string,
  input: {
    source?: { kind: { type: 'string_enum' } | { type: 'number_enum' } };
    dims?: TableDef[];
    versions: Record<string, TableVersion>;
    description?: string;
  },
): TableDef {
  if (!id) throw new ValidationError('Table id must not be empty');
  if (id.includes(':')) throw new ValidationError(`Table id must not contain ":": "${id}"`);

  const hasSource = input.source !== undefined;
  const hasDims = input.dims !== undefined && input.dims.length > 0;

  if (hasSource && hasDims)
    throw new ValidationError(`Table "${id}": cannot have both source and dims`);
  if (!hasSource && !hasDims)
    throw new ValidationError(`Table "${id}": must have either source (leaf) or dims (composite)`);

  const versionEntries = Object.entries(input.versions);
  if (versionEntries.length === 0)
    throw new ValidationError(`Table "${id}": must have at least one version`);

  const dimIds = new Set((input.dims ?? []).map((d) => d.id));

  for (const [versionId, version] of versionEntries) {
    if (!versionId) throw new ValidationError(`Table "${id}": version id must not be empty`);
    if (versionId.includes(':'))
      throw new ValidationError(`Table "${id}": version id must not contain ":": "${versionId}"`);

    if (hasSource) {
      if (!isLeafVersion(version))
        throw new ValidationError(
          `Table "${id}" version "${versionId}": leaf version must have capacity`,
        );
      if (!Number.isInteger(version.capacity) || version.capacity < 1)
        throw new ValidationError(
          `Table "${id}" version "${versionId}": capacity must be a positive integer`,
        );
    } else {
      if (isLeafVersion(version))
        throw new ValidationError(
          `Table "${id}" version "${versionId}": composite version must have refs`,
        );

      // 모든 dim이 refs에 커버되는지 검증
      for (const dimId of dimIds) {
        if (!version.refs[dimId])
          throw new ValidationError(
            `Table "${id}" version "${versionId}": missing ref for dim "${dimId}"`,
          );
      }

      // refs의 각 항목이 선언된 dim과 일치하는지 검증
      for (const [dimId, ref] of Object.entries(version.refs)) {
        if (!dimIds.has(dimId))
          throw new ValidationError(
            `Table "${id}" version "${versionId}": ref "${dimId}" is not in dims`,
          );
        if (!ref.prefix)
          throw new ValidationError(
            `Table "${id}" version "${versionId}" ref "${dimId}": prefix must not be empty`,
          );
        if (ref.prefix !== dimId)
          throw new ValidationError(
            `Table "${id}" version "${versionId}" ref "${dimId}": prefix must equal dimId (got "${ref.prefix}")`,
          );
        if (!ref.version)
          throw new ValidationError(
            `Table "${id}" version "${versionId}" ref "${dimId}": version must not be empty`,
          );
      }
    }
  }

  return {
    _type: 'table',
    id,
    source: input.source,
    dims: input.dims ? [...input.dims] : undefined,
    versions: { ...input.versions },
    description: input.description,
  };
}
