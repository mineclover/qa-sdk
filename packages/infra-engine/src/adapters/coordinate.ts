// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// adapters/coordinate.ts — CoordinateAdapter Catalog 기반 실인코딩
import type { Catalog } from '@qa-sdk/core';
import { latestPrefixVersion, encodePrefix } from '@qa-sdk/core';
import type { CoordinateAdapter } from './adapter.js';

/**
 * Catalog 기반 좌표 인코딩 어댑터.
 * 인코딩 실패 시 fail-open — null / {} 반환.
 *
 * table_ref 차원(actor 등)은 getFixedLabels()가 자동 제외하므로
 * encodePrefix는 axis + prefix_ref 차원만 인코딩한다.
 */
export function createCoordinateAdapter(catalog: Catalog): CoordinateAdapter {
  return {
    resolveSvcRef(serviceId, env, region, namespace) {
      try {
        const version = latestPrefixVersion(catalog, 'service');
        const prefix = catalog.prefixes.service;
        if (!prefix) return null;
        const vdef = prefix.versions.find((v) => v.version === version);
        if (!vdef) return null;

        // 각 축에서 position 계산
        const positions: Record<string, number> = {};
        for (const label of prefix.labels) {
          const dim = prefix.dims[label];
          if (dim.kind === 'table_ref') continue;

          const val =
            label === 'env'
              ? env
              : label === 'region'
                ? region
                : label === 'svc_name'
                  ? serviceId
                  : label === 'namespace'
                    ? (namespace ?? 'shop')
                    : undefined;
          if (val === undefined) return null;

          if (dim.kind === 'axis') {
            const axis = catalog.axes[dim.axisId];
            const snap = axis?.versions[vdef.axisVersions[label]];
            if (!snap) return null;
            const idx = snap.entries.indexOf(val);
            if (idx < 0) return null;
            positions[label] = idx;
          }
        }

        const address = encodePrefix(catalog, 'service', version, positions);
        return `service:${version}:${address}`;
      } catch {
        return null;
      }
    },

    encodeDeployEvent(svcRef, action, _actor): Record<string, string> {
      if (!svcRef) return {};
      try {
        const version = latestPrefixVersion(catalog, 'deploy_event');
        const prefix = catalog.prefixes.deploy_event;
        if (!prefix) return {};
        const vdef = prefix.versions.find((v) => v.version === version);
        if (!vdef) return {};

        const positions: Record<string, number> = {};
        for (const label of prefix.labels) {
          const dim = prefix.dims[label];
          if (dim.kind === 'table_ref') continue;

          if (dim.kind === 'prefix_ref') {
            const address = parseSvcRefAddress(svcRef);
            if (address === null) return {};
            const ref = vdef.refEntries?.[label];
            if (!ref) return {};
            const idx = ref.values.indexOf(address);
            if (idx < 0) return {};
            positions[label] = idx;
          } else if (dim.kind === 'axis') {
            const axis = catalog.axes[dim.axisId];
            const snap = axis?.versions[vdef.axisVersions[label]];
            if (!snap) return {};
            const idx = snap.entries.indexOf(action);
            if (idx < 0) return {};
            positions[label] = idx;
          }
        }

        const address = encodePrefix(catalog, 'deploy_event', version, positions);
        return { deploy_event: `deploy_event:${version}:${address}` };
      } catch {
        return {};
      }
    },

    encodeHealthEvent(svcRef, status): Record<string, string> {
      if (!svcRef) return {};
      try {
        const version = latestPrefixVersion(catalog, 'health_event');
        const prefix = catalog.prefixes.health_event;
        if (!prefix) return {};
        const vdef = prefix.versions.find((v) => v.version === version);
        if (!vdef) return {};

        const positions: Record<string, number> = {};
        for (const label of prefix.labels) {
          const dim = prefix.dims[label];
          if (dim.kind === 'table_ref') continue;

          if (dim.kind === 'prefix_ref') {
            const address = parseSvcRefAddress(svcRef);
            if (address === null) return {};
            const ref = vdef.refEntries?.[label];
            if (!ref) return {};
            const idx = ref.values.indexOf(address);
            if (idx < 0) return {};
            positions[label] = idx;
          } else if (dim.kind === 'axis') {
            const axis = catalog.axes[dim.axisId];
            const snap = axis?.versions[vdef.axisVersions[label]];
            if (!snap) return {};
            const idx = snap.entries.indexOf(status);
            if (idx < 0) return {};
            positions[label] = idx;
          }
        }

        const address = encodePrefix(catalog, 'health_event', version, positions);
        return { health_event: `health_event:${version}:${address}` };
      } catch {
        return {};
      }
    },
  };
}

/** "service:v1:42" → 42 파싱. 실패 시 null. */
function parseSvcRefAddress(svcRef: string): number | null {
  const parts = svcRef.split(':');
  if (parts.length < 3) return null;
  const addr = Number(parts[parts.length - 1]);
  return Number.isNaN(addr) ? null : addr;
}
