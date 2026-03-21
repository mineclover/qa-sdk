/**
 * catalog-mutator — 카탈로그 불변 변이.
 *
 * Catalog는 readonly 타입이므로 새 객체를 생성하여 반환한다.
 *
 * index-meta 원칙 준수:
 *   - Append-only: 기존 entries 순서/위치 절대 변경 없음
 *   - Capacity 단조 증가: 감소 불가, 확장 시 power-of-2
 *   - 영향 prefix의 버전 핀 자동 갱신
 */

import { nextPowerOf2 } from "weighted-index";
import type {
  Catalog,
  VersionedAxis,
  PrefixDef,
  PrefixVersionDef,
} from "@qa-sdk/core";
import {
  latestVersionKey,
  nextVersionKey,
  createAxisVersion,
  bumpVersionString,
} from "./axis-version-builder.js";

export interface CatalogMutationResult {
  readonly catalog: Catalog;
  readonly axisId: string;
  readonly entry: string;
  readonly oldVersion: string;
  readonly newVersion: string;
  readonly affectedPrefixes: readonly string[];
  readonly updatedPrefixVersions: readonly {
    prefixId: string;
    oldVersion: string;
    newVersion: string;
  }[];
  /** capacity 확장이 있었으면 기록 */
  readonly capacityChange?: { from: number; to: number };
}

/**
 * 카탈로그에 축 entry를 추가한다.
 *
 * 1. 축에 새 버전 생성 (기존 entries + 새 entry, append-only)
 * 2. 해당 축을 사용하는 prefix를 찾아 새 prefix 버전 핀 생성
 * 3. 변이된 카탈로그 반환
 */
export function addEntryToCatalog(
  catalog: Catalog,
  axisId: string,
  entry: string,
): CatalogMutationResult {
  const axis = catalog.axes[axisId];
  if (!axis) throw new Error(`Axis not found: ${axisId}`);

  const oldVersion = latestVersionKey(axis);
  const oldSnapshot = axis.versions[oldVersion];
  if (!oldSnapshot) throw new Error(`Version not found: ${axisId}@${oldVersion}`);

  if (oldSnapshot.entries.includes(entry)) {
    throw new Error(`Entry already exists: "${entry}" in ${axisId}@${oldVersion}`);
  }

  const capacity = oldSnapshot.capacity ?? oldSnapshot.entries.length;
  if (oldSnapshot.entries.length >= capacity) {
    throw new Error(
      `Headroom 0: ${axisId}@${oldVersion} (${oldSnapshot.entries.length}/${capacity}). expandCapacity()로 선처리 필요.`,
    );
  }

  // ── 1. 축 새 버전 생성 (append-only) ──
  const newVersion = nextVersionKey(axis);
  const newSnapshot = createAxisVersion(oldSnapshot, [entry]);

  const updatedAxis: VersionedAxis = {
    ...axis,
    versions: { ...axis.versions, [newVersion]: newSnapshot },
  };

  // ── 2. 영향 prefix 탐색 + 버전 핀 갱신 ──
  const { updatedPrefixes, affectedPrefixes, updatedPrefixVersions } =
    updateAffectedPrefixes(catalog.prefixes, axisId, oldVersion, newVersion);

  return {
    catalog: {
      ...catalog,
      axes: { ...catalog.axes, [axisId]: updatedAxis },
      prefixes: updatedPrefixes,
    },
    axisId,
    entry,
    oldVersion,
    newVersion,
    affectedPrefixes,
    updatedPrefixVersions,
  };
}

/**
 * 축 capacity를 power-of-2로 확장한다.
 *
 * stride-break 발생 — 기존 인코딩된 주소는 decode(old) → re-encode(new) 필요.
 * Capacity 단조 증가 원칙: 항상 2배.
 */
export function expandCapacity(
  catalog: Catalog,
  axisId: string,
): { catalog: Catalog; oldCapacity: number; newCapacity: number } {
  const axis = catalog.axes[axisId];
  if (!axis) throw new Error(`Axis not found: ${axisId}`);

  const versionKey = latestVersionKey(axis);
  const snapshot = axis.versions[versionKey];
  if (!snapshot) throw new Error(`Version not found: ${axisId}@${versionKey}`);

  const oldCapacity = snapshot.capacity ?? snapshot.entries.length;
  const newCapacity = nextPowerOf2(oldCapacity * 2);

  const expandedSnapshot = {
    entries: snapshot.entries,
    capacity: newCapacity,
    ko: snapshot.ko,
  };

  return {
    catalog: {
      ...catalog,
      axes: {
        ...catalog.axes,
        [axisId]: {
          ...axis,
          versions: { ...axis.versions, [versionKey]: expandedSnapshot },
        },
      },
    },
    oldCapacity,
    newCapacity,
  };
}

// ── Internal ──

function updateAffectedPrefixes(
  prefixes: Record<string, PrefixDef>,
  axisId: string,
  oldAxisVersion: string,
  newAxisVersion: string,
): {
  updatedPrefixes: Record<string, PrefixDef>;
  affectedPrefixes: string[];
  updatedPrefixVersions: { prefixId: string; oldVersion: string; newVersion: string }[];
} {
  const affectedPrefixes: string[] = [];
  const updatedPrefixVersions: { prefixId: string; oldVersion: string; newVersion: string }[] = [];
  const updatedPrefixes: Record<string, PrefixDef> = {};

  for (const [prefixId, prefix] of Object.entries(prefixes)) {
    const usesAxis = Object.values(prefix.dims).some(
      (dim) => dim.kind === "axis" && dim.axisId === axisId,
    );
    if (!usesAxis) {
      updatedPrefixes[prefixId] = prefix;
      continue;
    }

    affectedPrefixes.push(prefixId);
    const latestPV = prefix.versions[prefix.versions.length - 1];
    if (!latestPV || latestPV.axisVersions[axisId] !== oldAxisVersion) {
      updatedPrefixes[prefixId] = prefix;
      continue;
    }

    const newPrefixVersionStr = bumpVersionString(latestPV.version);
    const newPrefixVersion: PrefixVersionDef = {
      version: newPrefixVersionStr,
      axisVersions: { ...latestPV.axisVersions, [axisId]: newAxisVersion },
      // refEntries는 derive 단계에서 재계산 — 여기선 생략하되 executor가 경고
    };

    updatedPrefixes[prefixId] = {
      ...prefix,
      versions: [...prefix.versions, newPrefixVersion],
    };
    updatedPrefixVersions.push({
      prefixId,
      oldVersion: latestPV.version,
      newVersion: newPrefixVersionStr,
    });
  }

  return { updatedPrefixes, affectedPrefixes, updatedPrefixVersions };
}

