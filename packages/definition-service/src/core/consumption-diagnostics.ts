// @def.doc definition-service

/**
 * 소비율 진단 — 스냅샷에서 PrefixConsumption 변환 + 진단 실행
 *
 * HTTP/DB 무관한 순수 로직.
 */

import {
  diagnoseConsumption,
  type PrefixConsumption,
  type ConsumptionDiagnosis,
} from "definition-catalog";
import type { ConsumptionSnapshot } from "./types.js";

/**
 * ConsumptionSnapshot → PrefixConsumption 변환
 */
export function snapshotToConsumption(snapshot: ConsumptionSnapshot): PrefixConsumption {
  const dimStats = JSON.parse(snapshot.dimStatsJson) as Record<
    string,
    { axisId: string; totalEntries: number; observedEntries: number; rate: number }
  >;
  return {
    prefixId: snapshot.prefixId,
    version: snapshot.prefixVersion,
    collectedAt: snapshot.collectedAt,
    totalSpace: snapshot.totalSpace,
    observedAddresses: snapshot.observedAddresses,
    consumptionRate: snapshot.consumptionRate,
    byDimension: dimStats,
  };
}

/**
 * 스냅샷에서 severity를 계산한다.
 */
export function diagnoseSnapshot(snapshot: ConsumptionSnapshot): ConsumptionDiagnosis {
  return diagnoseConsumption(snapshotToConsumption(snapshot));
}

/**
 * 소비율을 계산한다. totalSpace > 0이면 observed/total, 아니면 0.
 */
export function computeRate(totalSpace: number, observedAddresses: number): number {
  return totalSpace > 0 ? observedAddresses / totalSpace : 0;
}
