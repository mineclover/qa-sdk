// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * Dim-level wire format — 차원별 인덱스만 전송하는 경량 포맷.
 *
 * Full format: "rbac:v1:42" → prefix + version + 1D address
 * Dim format:  { role: 1, action: 2, resource: 3 } → 차원별 1-based index
 *
 * 장점: prefix 스펙 없이 axis별 독립 decode 가능
 * 단점: prefix 합성 정보(shape, stride) 누락 → 1D 주소 복원 불가 (dimsToAddress로 별도 수행)
 */

import type { Catalog, DimRef } from '@qa-sdk/core';
import { latestPrefixVersion, encodePrefix, decodePrefix } from '@qa-sdk/core';

// ── 타입 ────────────────────────────────────────────────────────────────────────

export interface DimWireCodec {
  /** 문자열 값 → 차원별 인덱스 맵 (1-based) */
  encodeDims(prefix: string, values: Record<string, string>): Record<string, number>;

  /** 차원별 인덱스 맵 (1-based) → 문자열 값 */
  decodeDims(prefix: string, indices: Record<string, number>): Record<string, string>;

  /** 1D 주소 → 차원별 인덱스 맵 (1-based) */
  addressToDims(prefix: string, address: number, version?: string): Record<string, number>;

  /** 차원별 인덱스 맵 (1-based) → 1D 주소 */
  dimsToAddress(prefix: string, indices: Record<string, number>, version?: string): number;
}

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────────

/** table_ref가 아닌 차원(고정 차원)의 labels만 반환 */
function getFixedLabels(prefix: {
  labels: readonly string[];
  dims: Record<string, DimRef>;
}): string[] {
  return prefix.labels.filter((l) => prefix.dims[l].kind !== 'table_ref');
}

/** prefix의 최신 version을 반환 */
const latestVersion = latestPrefixVersion;

// ── 팩토리 ──────────────────────────────────────────────────────────────────────

export function createDimWireCodec(catalog: Catalog): DimWireCodec {
  return {
    encodeDims(prefixId: string, values: Record<string, string>): Record<string, number> {
      const prefix = catalog.prefixes[prefixId];
      if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
      const ver = latestVersion(catalog, prefixId);
      const vdef = prefix.versions.find((v) => v.version === ver);
      if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${ver}`);

      const fixedLabels = getFixedLabels(prefix);
      const result: Record<string, number> = {};

      for (const label of fixedLabels) {
        const val = values[label];
        if (val === undefined) throw new Error(`Missing value for dim: ${label}`);

        const dim = prefix.dims[label];
        if (dim.kind === 'axis') {
          const axis = catalog.axes[dim.axisId];
          if (!axis) throw new Error(`Unknown axis: ${dim.axisId}`);
          const snap = axis.versions[vdef.axisVersions[label]];
          if (!snap)
            throw new Error(`Unknown axis version: ${dim.axisId}@${vdef.axisVersions[label]}`);
          const idx = snap.entries.indexOf(val);
          if (idx < 0)
            throw new Error(
              `Unknown entry "${val}" for axis ${dim.axisId}@${vdef.axisVersions[label]}`,
            );
          result[label] = idx + 1; // 1-based
        } else if (dim.kind === 'prefix_ref') {
          // prefix_ref: 값을 정수로 해석할 수 없으므로 skip (axis 차원만 지원)
          throw new Error(
            `encodeDims does not support prefix_ref dim "${label}". Use encodePrefixByValue instead.`,
          );
        }
      }

      return result;
    },

    decodeDims(prefixId: string, indices: Record<string, number>): Record<string, string> {
      const prefix = catalog.prefixes[prefixId];
      if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
      const ver = latestVersion(catalog, prefixId);
      const vdef = prefix.versions.find((v) => v.version === ver);
      if (!vdef) throw new Error(`Unknown prefix version: ${prefixId}@${ver}`);

      const fixedLabels = getFixedLabels(prefix);
      const result: Record<string, string> = {};

      for (const label of fixedLabels) {
        const idx = indices[label];
        if (idx === undefined) throw new Error(`Missing index for dim: ${label}`);

        const dim = prefix.dims[label];
        if (dim.kind === 'axis') {
          const axis = catalog.axes[dim.axisId];
          if (!axis) throw new Error(`Unknown axis: ${dim.axisId}`);
          const snap = axis.versions[vdef.axisVersions[label]];
          if (!snap)
            throw new Error(`Unknown axis version: ${dim.axisId}@${vdef.axisVersions[label]}`);
          const pos = idx - 1; // 0-based
          if (pos < 0 || pos >= snap.entries.length) {
            throw new Error(
              `Index ${idx} out of range for axis ${dim.axisId} (entries: ${snap.entries.length})`,
            );
          }
          result[label] = snap.entries[pos];
        } else if (dim.kind === 'prefix_ref') {
          throw new Error(
            `decodeDims does not support prefix_ref dim "${label}". Use decodePrefix instead.`,
          );
        }
      }

      return result;
    },

    addressToDims(prefixId: string, address: number, version?: string): Record<string, number> {
      const prefix = catalog.prefixes[prefixId];
      if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
      const ver = version ?? latestVersion(catalog, prefixId);

      const decoded = decodePrefix(catalog, prefixId, ver, address);
      const result: Record<string, number> = {};

      for (const [label, d] of Object.entries(decoded)) {
        // position은 0-based → 1-based로 변환
        result[label] = d.position + 1;
      }

      return result;
    },

    dimsToAddress(prefixId: string, indices: Record<string, number>, version?: string): number {
      const prefix = catalog.prefixes[prefixId];
      if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);
      const ver = version ?? latestVersion(catalog, prefixId);

      // 1-based → 0-based positions
      const positions: Record<string, number> = {};
      const fixedLabels = getFixedLabels(prefix);

      for (const label of fixedLabels) {
        const idx = indices[label];
        if (idx === undefined) throw new Error(`Missing index for dim: ${label}`);
        positions[label] = idx - 1; // 0-based
      }

      return encodePrefix(catalog, prefixId, ver, positions);
    },
  };
}
