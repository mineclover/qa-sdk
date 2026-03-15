/**
 * version-query.ts — 버전 횡단 탐색.
 *
 * entity 기준 조건을 여러 version에 걸쳐 검색한다.
 * 좌표 번호가 아닌 entity 이름 기준이므로, version마다 position이 달라도
 * 동일한 의미 조건을 적용할 수 있다.
 */
import {
  positionsToConstraint,
  type CoordConstraint,
  type EntityId,
} from "weighted-index";
import type { MetaRegistry } from "./meta-registry.js";
import { EntryNotFoundError, ValidationError } from "./errors.js";

// ── queryAcrossVersions ──────────────────────────────────────────────────────

/**
 * entity 기준 조건을 여러 version에 걸쳐 검색한다.
 *
 * entity 이름 기준이므로 version마다 position이 달라도 동일 의미 조건을 적용한다.
 * version에 해당 entity가 없으면 그 version은 결과에서 제외된다.
 *
 * @param indexId     대상 index
 * @param versionIds  검색할 version 목록
 * @param constraint  entity 기준 조건. key = dimId, value = entity ID | null(와일드카드)
 * @param registry    MetaRegistry
 * @returns versionId → value 범위 (entity가 없는 version은 포함되지 않음)
 *
 * @example
 * queryAcrossVersions("perm", ["v1","v2","v3"], { role: "admin" }, registry)
 * // → Map { "v1" → [[0,8]], "v2" → [[0,8]], "v3" → [[0,11]] }
 */
export function queryAcrossVersions(
  indexId: string,
  versionIds: readonly string[],
  constraint: Record<string, EntityId | null>,
  registry: MetaRegistry,
): Map<string, [number, number][]> {
  const result = new Map<string, [number, number][]>();

  for (const versionId of versionIds) {
    const codec = registry.createCodec(indexId, versionId);
    try {
      const ranges = codec.matchRanges(constraint);
      result.set(versionId, ranges);
    } catch (e) {
      if (e instanceof EntryNotFoundError) continue; // entity가 이 version에 없음
      throw e;
    }
  }

  return result;
}

// ── entityVersionSpan ────────────────────────────────────────────────────────

/**
 * 특정 entity가 존재하는 version 목록을 반환한다.
 *
 * @param indexId   대상 index
 * @param dimId     entity가 속한 dim
 * @param entityId  찾을 entity
 * @param registry  MetaRegistry
 * @param options   activeOnly: true이면 active인 version만 반환
 *
 * @example
 * entityVersionSpan("perm", "role", "viewer", registry)
 * // → ["v2", "v3", "v4"]
 */
export function entityVersionSpan(
  indexId: string,
  dimId: string,
  entityId: EntityId,
  registry: MetaRegistry,
  options?: { activeOnly?: boolean },
): string[] {
  const indexDef = registry.getIndexDef(indexId);
  if (!indexDef.dims.includes(dimId)) {
    throw new ValidationError(
      `entityVersionSpan: dim "${dimId}" not in index "${indexId}"`
    );
  }

  const versionIds = registry.getVersionIds(indexId);
  const result: string[] = [];

  for (const versionId of versionIds) {
    const version = registry.getIndexVersion(indexId, versionId);
    const snapshotId = version.snapshots[dimId];
    const snapshot = registry.getDimSnapshot(dimId, snapshotId);

    const pos = snapshot.entries.indexOf(entityId);
    if (pos === -1) continue;

    if (options?.activeOnly) {
      const oneBasedPos = pos + 1;
      if (!registry.isEntryActive(dimId, snapshotId, oneBasedPos)) continue;
    }

    result.push(versionId);
  }

  return result;
}

// ── translateConstraint ──────────────────────────────────────────────────────

/**
 * 버전 간 좌표 제약 조건을 변환한다.
 *
 * fromVersion의 position 기준 constraint를 toVersion의 position 기준으로 변환한다.
 * migration edge가 있으면 사용하고, 없으면 EntityId 기반 암묵적 이동을 시도한다.
 *
 * @returns 변환된 constraint, 또는 null (entity가 target version에 없음)
 *
 * @example
 * translateConstraint("perm", "v1", "v3", { role: "1" }, registry)
 * // → { role: "2" }  (migration edge에 의해 position 변경)
 */
export function translateConstraint(
  indexId: string,
  fromVersion: string,
  toVersion: string,
  constraint: Record<string, CoordConstraint>,
  registry: MetaRegistry,
): Record<string, CoordConstraint> | null {
  if (fromVersion === toVersion) return { ...constraint };

  const indexDef = registry.getIndexDef(indexId);
  const fromIv = registry.getIndexVersion(indexId, fromVersion);
  const toIv = registry.getIndexVersion(indexId, toVersion);
  const result: Record<string, CoordConstraint> = {};

  for (const dimId of indexDef.dims) {
    const c = constraint[dimId];
    if (c === undefined || c === null) {
      result[dimId] = null;
      continue;
    }

    const fromSnapshotId = fromIv.snapshots[dimId];
    const toSnapshotId = toIv.snapshots[dimId];

    if (fromSnapshotId === toSnapshotId) {
      result[dimId] = c;
      continue;
    }

    // position 기준 constraint를 파싱하고 각 position을 변환
    const fromSnapshot = registry.getDimSnapshot(dimId, fromSnapshotId);
    const toSnapshot = registry.getDimSnapshot(dimId, toSnapshotId);

    // constraint에서 position 목록 추출
    const positions = _parsePositions(c, fromSnapshot.entries.length);
    const mappedPositions: number[] = [];

    for (const pos of positions) {
      // 방법 1: migration edge 사용 시도
      try {
        const mapped = registry.traceMigration(dimId, fromSnapshotId, toSnapshotId, pos);
        if (mapped >= 1 && mapped <= toSnapshot.entries.length) {
          mappedPositions.push(mapped);
        }
        continue;
      } catch {
        // migration edge 없음 → EntityId 기반 이동
      }

      // 방법 2: EntityId 기반 암묵적 이동
      const entityId = fromSnapshot.entries[pos - 1];
      if (entityId === undefined) return null;
      const toPos = toSnapshot.entries.indexOf(entityId);
      if (toPos === -1) return null; // entity가 target version에 없음
      mappedPositions.push(toPos + 1);
    }

    if (mappedPositions.length === 0) return null;
    result[dimId] = positionsToConstraint(mappedPositions);
  }

  return result;
}

/**
 * CoordConstraint 문자열에서 개별 position 목록을 추출한다.
 */
function _parsePositions(c: string, dimSize: number): number[] {
  const positions: number[] = [];
  for (const part of c.split(",")) {
    const trimmed = part.trim();
    const dash = trimmed.indexOf("-");
    if (dash === -1) {
      positions.push(Number(trimmed));
    } else {
      const from = Number(trimmed.slice(0, dash));
      const to = Number(trimmed.slice(dash + 1));
      for (let i = from; i <= to; i++) positions.push(i);
    }
  }
  return positions.filter((p) => p >= 1 && p <= dimSize);
}
