/**
 * catalog-builder — refEntries를 semantic 정의에서 자동 파생하여 DEMO_CATALOG을 구성한다.
 *
 * 개발자가 보는 것: 의미값 (문자열 조합)
 * 시스템이 파생하는 것: 정수 주소
 *
 * 정수는 이 파일 밖으로 노출되지 않는다.
 */

import { calcWeights } from "weighted-index";
import type { DemoCatalog, PrefixVersionDef } from "./demo-catalog.js";

// ═══════════════════════════════════════════════════════════════
//  Semantic RefEntries 정의 — 의미가 원본
// ═══════════════════════════════════════════════════════════════

/** prod/asia의 전 서비스 × 전 namespace (10개) */
export const PERM_SVC_MEANING = [
  { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "cms" },
  { env: "prod", region: "asia", svc_name: "shopping-backend", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "shopping-backend", namespace: "cms" },
  { env: "prod", region: "asia", svc_name: "auth", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "auth", namespace: "cms" },
  { env: "prod", region: "asia", svc_name: "payment", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "payment", namespace: "cms" },
  { env: "prod", region: "asia", svc_name: "gateway", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "gateway", namespace: "cms" },
] as const;

/** dev + prod의 5개 서비스 (namespace=shop, 10개) */
export const EVT_SVC_MEANING = [
  { env: "dev", region: "asia", svc_name: "shopping-web", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "shopping-backend", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "auth", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "payment", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "gateway", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "shopping-backend", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "auth", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "payment", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "gateway", namespace: "shop" },
] as const;

/** prod 5개 서비스 (namespace=shop, 5개) */
export const ORDER_SVC_MEANING = [
  { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "shopping-backend", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "auth", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "payment", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "gateway", namespace: "shop" },
] as const;

/** dev+stage+prod × asia × 전 서비스 (namespace=shop, 15개) — 인프라 계측 대상 */
export const INFRA_SVC_MEANING = [
  { env: "dev", region: "asia", svc_name: "shopping-web", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "shopping-backend", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "auth", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "payment", namespace: "shop" },
  { env: "dev", region: "asia", svc_name: "gateway", namespace: "shop" },
  { env: "stage", region: "asia", svc_name: "shopping-web", namespace: "shop" },
  { env: "stage", region: "asia", svc_name: "shopping-backend", namespace: "shop" },
  { env: "stage", region: "asia", svc_name: "auth", namespace: "shop" },
  { env: "stage", region: "asia", svc_name: "payment", namespace: "shop" },
  { env: "stage", region: "asia", svc_name: "gateway", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "shopping-backend", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "auth", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "payment", namespace: "shop" },
  { env: "prod", region: "asia", svc_name: "gateway", namespace: "shop" },
] as const;

// ═══════════════════════════════════════════════════════════════
//  파생 — 의미 → 정수 (내부에서만 사용)
// ═══════════════════════════════════════════════════════════════

/**
 * service prefix의 shape/strides를 계산하고, 의미값을 정수 주소로 변환한다.
 * demo-accessors를 import하지 않고 직접 계산 (순환 의존 방지).
 */
export function deriveServiceAddresses(
  catalog: DemoCatalog,
  meanings: readonly Record<string, string>[],
): number[] {
  const svcPrefix = catalog.prefixes.service;
  const fixedLabels = svcPrefix.labels.filter(
    l => svcPrefix.dims[l].kind !== "table_ref",
  );

  // shape 계산
  const shape = fixedLabels.map(label => {
    const dimRef = svcPrefix.dims[label];
    if (dimRef.kind === "axis") {
      const axis = (catalog.axes as Record<string, { versions: Record<string, { capacity?: number; entries: readonly string[] }> }>)[dimRef.axisId];
      const snap = axis.versions["v1"];
      return snap.capacity ?? snap.entries.length;
    }
    return 1;
  });

  // strides 계산
  const strides = calcWeights(shape);

  // 의미값 → 정수 주소
  return meanings.map(meaning => {
    let addr = 0;
    for (let i = 0; i < fixedLabels.length; i++) {
      const label = fixedLabels[i];
      const dimRef = svcPrefix.dims[label];
      if (dimRef.kind === "axis") {
        const axis = (catalog.axes as Record<string, { versions: Record<string, { entries: readonly string[] }> }>)[dimRef.axisId];
        const entries = axis.versions["v1"].entries;
        const pos = entries.indexOf(meaning[label] as string);
        if (pos === -1) throw new Error(`Entry "${meaning[label]}" not found in axis "${dimRef.axisId}"`);
        addr += pos * strides[i];
      }
    }
    return addr;
  });
}

/**
 * DEMO_CATALOG의 refEntries용 정수 배열을 파생한다.
 * 이 함수만 호출하면 현재 shape 기준으로 올바른 정수가 나온다.
 */
export function buildRefValues(catalog: DemoCatalog): {
  permSvc: number[];
  evtSvc: number[];
  orderSvc: number[];
} {
  return {
    permSvc: deriveServiceAddresses(catalog, PERM_SVC_MEANING),
    evtSvc: deriveServiceAddresses(catalog, EVT_SVC_MEANING),
    orderSvc: deriveServiceAddresses(catalog, ORDER_SVC_MEANING),
  };
}
