// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// monitor/sla.ts — SLA 보고서 계산
import type { InfraProfileAdapter } from "../adapters/adapter.js";

export interface SlaReport {
  serviceId: string;
  period: string; // "2026-04" (YYYY-MM)
  totalMinutes: number;
  uptimeMinutes: number;
  downtimeMinutes: number;
  percentage: number; // 0-100
  incidents: number; // 실패 배포 횟수
}

export async function calculateSla(
  infraProfile: InfraProfileAdapter,
  serviceId: string,
  periodMonth?: string, // "2026-04", default 현재 월
): Promise<SlaReport> {
  const now = new Date();
  const period = periodMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = period.split("-").map(Number);

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
  const totalMinutes = Math.floor(
    (Math.min(now.getTime(), periodEnd.getTime()) - periodStart.getTime()) / 60_000,
  );

  const history = await infraProfile.getHistory(serviceId);

  // 기간 내 이력 필터링
  const periodHistory = history.filter((h) => {
    const t = new Date(h.deployedAt).getTime();
    return t >= periodStart.getTime() && t < periodEnd.getTime();
  });

  const failCount = periodHistory.filter((h) => !h.success).length;

  // 단순 SLA: 각 실패 = 추정 5분 다운타임
  const downtimeMinutes = failCount * 5;
  const uptimeMinutes = Math.max(0, totalMinutes - downtimeMinutes);
  const percentage = totalMinutes > 0 ? Math.round((uptimeMinutes / totalMinutes) * 10000) / 100 : 100;

  return {
    serviceId,
    period,
    totalMinutes,
    uptimeMinutes,
    downtimeMinutes,
    percentage,
    incidents: failCount,
  };
}
