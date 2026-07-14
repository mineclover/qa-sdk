// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * cross-index-query.ts — index_ref 합성 질의 및 깊은 디코딩.
 *
 * MetaRegistry의 schema 컨텍스트를 사용하여 cross-index 참조를 자동으로
 * 따라가는 질의와 재귀적 디코딩을 제공한다.
 */
import {
  calcAddressRanges,
  positionsToConstraint,
  type CoordConstraint,
  type EntityId,
} from 'weighted-index';
import type { MetaRegistry } from './meta-registry.js';
import type { VersionedValue } from './types.js';
import { IndexNotFoundError, ValidationError } from './errors.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * deepDecode 결과.
 */
export interface DeepDecodeResult {
  /** indexId → { dimId → entityId } */
  layers: Map<string, Record<string, EntityId>>;
  /** 디코딩 경로 (최상위부터 리프까지) */
  path: VersionedValue[];
}

// ── composeQuery ─────────────────────────────────────────────────────────────

/**
 * index_ref dim을 통해 연결된 하위 index에 조건을 걸고,
 * 그 조건을 만족하는 **상위 index의 value 범위**를 반환한다.
 *
 * @param source    상위 index의 { indexId, versionId }
 * @param through   상위 index에서 index_ref인 dimId
 * @param targetConstraint  하위 index에 대한 entity 기준 조건
 *                          (key = 하위 index의 dimId, value = entity ID 또는 null)
 * @param registry  MetaRegistry 인스턴스
 * @returns 상위 index의 value 범위 (calcAddressRanges 결과와 동일 형태)
 *
 * @example
 * // article = [quality_tier(→doc_meta), priority]
 * // doc_meta = [format, lang]
 * // "format=PDF인 article의 value 범위"
 * composeQuery(
 *   { indexId: "article", versionId: "v1" },
 *   "quality_tier",
 *   { format: "PDF" },
 *   registry,
 * )
 */
export function composeQuery(
  source: { indexId: string; versionId: string },
  through: string,
  targetConstraint: Record<string, EntityId | null>,
  registry: MetaRegistry,
): [number, number][] {
  // 1. source index의 dim 정보 확인
  const sourceDef = registry.getIndexDef(source.indexId);
  const sourceVersion = registry.getIndexVersion(source.indexId, source.versionId);
  const throughDimIndex = sourceDef.dims.indexOf(through);
  if (throughDimIndex === -1) {
    throw new ValidationError(
      `composeQuery: dim "${through}" not found in index "${source.indexId}"`,
    );
  }

  // 2. through dim의 kind 확인 (index_ref여야 함)
  const throughDimDef = registry.getDimDef(through);
  if (throughDimDef.kind.type !== 'index_ref') {
    throw new ValidationError(
      `composeQuery: dim "${through}" is "${throughDimDef.kind.type}", expected "index_ref"`,
    );
  }

  // 3. target index에서 조건에 맞는 value(주소)들 계산
  const targetIndexId = throughDimDef.kind.indexId;
  const targetVersionIds = registry.getVersionIds(targetIndexId);
  if (targetVersionIds.length === 0) {
    throw new IndexNotFoundError(`composeQuery: target index "${targetIndexId}" has no versions`);
  }

  const targetVersionId = targetVersionIds[targetVersionIds.length - 1];
  const targetCodec = registry.createCodec(targetIndexId, targetVersionId);
  const targetRanges = targetCodec.matchRanges(targetConstraint);

  // 4. through dim의 entries에서 target 범위에 포함되는 position 찾기
  const throughSnapshotId = sourceVersion.snapshots[through];
  const throughSnapshot = registry.getDimSnapshot(through, throughSnapshotId);

  const matchingPositions: number[] = [];
  for (let i = 0; i < throughSnapshot.entries.length; i++) {
    const entryValue = throughSnapshot.entries[i] as number;
    const inRange = targetRanges.some(([from, to]) => entryValue >= from && entryValue <= to);
    if (inRange) {
      matchingPositions.push(i + 1); // 1-based
    }
  }

  if (matchingPositions.length === 0) return [];

  // 5. source 주소 범위 계산
  const sourceWi = registry.getWeightedIndex(source.indexId, source.versionId);
  const sourceConstraints: CoordConstraint[] = sourceDef.dims.map((_, idx) => {
    if (idx === throughDimIndex) {
      return positionsToConstraint(matchingPositions);
    }
    return null;
  });

  return calcAddressRanges(sourceWi.shape, sourceConstraints);
}

// ── deepDecode ───────────────────────────────────────────────────────────────

/**
 * index_ref 체인을 끝까지 따라가서 모든 리프 entity를 반환한다.
 *
 * @param address    최상위 VersionedValue
 * @param registry   MetaRegistry 인스턴스
 * @param maxDepth   최대 재귀 깊이 (순환 방지). 기본 8.
 *
 * @example
 * deepDecode({ indexId: "article", versionId: "v1", value: 30 }, registry)
 * // → {
 * //     layers: Map {
 * //       "article"  → { quality_tier: 5, priority: 0 },
 * //       "doc_meta" → { format: "PDF", lang: "ko" },
 * //     },
 * //     path: [articleVV, docMetaVV],
 * //   }
 */
export function deepDecode(
  address: VersionedValue,
  registry: MetaRegistry,
  maxDepth = 8,
): DeepDecodeResult {
  const layers = new Map<string, Record<string, EntityId>>();
  const path: VersionedValue[] = [];
  const visited = new Set<string>();

  _deepDecodeRecursive(address, registry, layers, path, visited, maxDepth);

  return { layers, path };
}

function _deepDecodeRecursive(
  vv: VersionedValue,
  registry: MetaRegistry,
  layers: Map<string, Record<string, EntityId>>,
  path: VersionedValue[],
  visited: Set<string>,
  remaining: number,
): void {
  const key = `${vv.indexId}:${vv.versionId}:${vv.value}`;
  if (visited.has(key) || remaining <= 0) return;
  visited.add(key);
  path.push(vv);

  // decode current level
  const codec = registry.createCodec(vv.indexId, vv.versionId);
  const decoded = codec.decode(vv);
  layers.set(vv.indexId, { ...decoded });

  // follow index_ref dims
  const indexDef = registry.getIndexDef(vv.indexId);
  const indexVersion = registry.getIndexVersion(vv.indexId, vv.versionId);

  for (const dimId of indexDef.dims) {
    const dimDef = registry.getDimDef(dimId);
    const entityValue = decoded[dimId];

    if (dimDef.kind.type === 'index_ref' && typeof entityValue === 'number') {
      // dim-level index_ref: entityValue is a compressed address in the target index
      const targetIndexId = dimDef.kind.indexId;
      const targetVersionIds = registry.getVersionIds(targetIndexId);
      if (targetVersionIds.length > 0) {
        const targetVersionId = targetVersionIds[targetVersionIds.length - 1];
        _deepDecodeRecursive(
          { indexId: targetIndexId, versionId: targetVersionId, value: entityValue },
          registry,
          layers,
          path,
          visited,
          remaining - 1,
        );
      }
    }

    // entry-level index_ref
    const snapshotId = indexVersion.snapshots[dimId];
    const snapshot = registry.getDimSnapshot(dimId, snapshotId);
    const pos = snapshot.entries.indexOf(entityValue);
    if (pos !== -1) {
      const oneBasedPos = pos + 1;
      const entryRef = snapshot.entryRefs?.[oneBasedPos];
      if (entryRef && typeof entityValue === 'number') {
        _deepDecodeRecursive(
          { indexId: entryRef.indexId, versionId: entryRef.versionId, value: entityValue },
          registry,
          layers,
          path,
          visited,
          remaining - 1,
        );
      }
    }
  }
}
