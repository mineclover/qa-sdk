// @def.boundary platform-demo-system
// @def.doc platform-demo-system

/**
 * Deterministic service read model used by the service sheet.
 *
 * It mirrors the platform-demo-api response shape while keeping the demo
 * usable without a Worker, D1, or registry service. demo-snapshot remains the
 * single source of truth for labels and address math.
 */

import {
  DEMO_ENVS,
  DEMO_KO,
  DEMO_NSS,
  DEMO_REGIONS,
  DEMO_SVCS,
  demoDecodeSvc,
  demoEncodeSvc,
} from 'demo-snapshot';
import type { ServiceCellsResponse, ServiceDecodeResponse } from './registry.js';
import type { SvcDimKey } from './pages/service.js';

const DIMENSIONS: Record<SvcDimKey, readonly string[]> = {
  env: DEMO_ENVS,
  region: DEMO_REGIONS,
  svc_name: DEMO_SVCS,
  namespace: DEMO_NSS,
};

const KOREAN_LABELS: Record<SvcDimKey, Record<string, string>> = {
  env: DEMO_KO.env,
  region: DEMO_KO.region,
  svc_name: DEMO_KO.svc,
  namespace: DEMO_KO.ns,
};

function labelsFor(dim: SvcDimKey): Array<{ id: string; ko: string; pos: number }> {
  return DIMENSIONS[dim].map((id, index) => ({
    id,
    ko: KOREAN_LABELS[dim][id] ?? id,
    pos: index + 1,
  }));
}

/** Return the same cell response as `/api/service/cells`, from the catalog. */
export async function fetchMockServiceCells(params: {
  xDim: SvcDimKey;
  yDim: SvcDimKey;
  fixed: Record<SvcDimKey, number>;
}): Promise<ServiceCellsResponse> {
  const xLabels = labelsFor(params.xDim);
  const yLabels = labelsFor(params.yDim);
  const cells = yLabels.flatMap((y) =>
    xLabels.map((x) => {
      const coords: Record<SvcDimKey, number> = { ...params.fixed };
      coords[params.xDim] = x.pos;
      coords[params.yDim] = y.pos;
      return {
        xPos: x.pos,
        yPos: y.pos,
        value: demoEncodeSvc([coords.env, coords.region, coords.svc_name, coords.namespace]),
      };
    }),
  );

  const fixed: Record<string, { id: string; ko: string; pos: number }> = {};
  for (const dim of Object.keys(DIMENSIONS) as SvcDimKey[]) {
    if (dim === params.xDim || dim === params.yDim) continue;
    const pos = params.fixed[dim];
    const id = DIMENSIONS[dim][pos - 1] ?? DIMENSIONS[dim][0];
    fixed[dim] = { id, ko: KOREAN_LABELS[dim][id] ?? id, pos };
  }

  return { xDim: params.xDim, yDim: params.yDim, xLabels, yLabels, fixed, cells };
}

/** Return the same decode response as `/api/service/decode/:value`. */
export async function fetchMockServiceDecode(value: number): Promise<ServiceDecodeResponse> {
  const [envPos, regionPos, svcPos, namespacePos] = demoDecodeSvc(value);
  const env = DEMO_ENVS[envPos - 1];
  const region = DEMO_REGIONS[regionPos - 1];
  const svc_name = DEMO_SVCS[svcPos - 1];
  const namespace = DEMO_NSS[namespacePos - 1];

  if (!env || !region || !svc_name || !namespace) {
    throw new Error(`서비스 주소를 해석할 수 없습니다: ${value}`);
  }

  return {
    env,
    region,
    svc_name,
    namespace,
    envKo: DEMO_KO.env[env] ?? env,
    regionKo: DEMO_KO.region[region] ?? region,
    svcNameKo: DEMO_KO.svc[svc_name] ?? svc_name,
    namespaceKo: DEMO_KO.ns[namespace] ?? namespace,
  };
}
