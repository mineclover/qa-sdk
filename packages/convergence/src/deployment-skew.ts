/**
 * 배포 상태 스큐 감지 — 집계 기반.
 *
 * "같은 prefix의 다른 version이 동시에 사용 중"을 감지한다.
 * 정의 기반이 아니라 실제 수집된 address_context의 version에서 판단.
 *
 * session_id로 소비자(서비스)를 식별하여
 * "어떤 서비스가 어떤 version에 머물러 있는가"를 보여준다.
 *
 * @layer 측정 (Measurement)
 */

import type { VersionUsage } from "./convergence.types.js";

export interface DeploymentSkew {
  readonly prefix: string;
  /** 사용 중인 version 목록 (최신 순) */
  readonly activeVersions: readonly {
    readonly version: string;
    readonly count: number;
    readonly sessions: readonly string[];
    readonly lastSeen: string;
  }[];
  /** 스큐 여부 — version이 2개 이상이면 true */
  readonly hasSkew: boolean;
  /** 최신 version */
  readonly latestVersion: string;
  /** 구버전에 머물러 있는 session 목록 */
  readonly staleConsumers: readonly {
    readonly session: string;
    readonly version: string;
    readonly count: number;
  }[];
  /** 심각도 */
  readonly severity: "ok" | "warning" | "critical";
  readonly summary: string;
}

/**
 * versionUsages에서 배포 스큐를 감지한다.
 */
export function analyzeDeploymentSkew(
  versionUsages: readonly VersionUsage[],
): DeploymentSkew[] {
  // prefix별로 그룹핑
  const byPrefix = new Map<string, VersionUsage[]>();
  for (const vu of versionUsages) {
    const list = byPrefix.get(vu.prefix) ?? [];
    list.push(vu);
    byPrefix.set(vu.prefix, list);
  }

  const results: DeploymentSkew[] = [];

  for (const [prefix, usages] of byPrefix) {
    // version 정렬 (count 기준, 가장 많이 쓰이는 게 "latest"로 추정)
    const sorted = [...usages].sort((a, b) => b.count - a.count);
    const latestVersion = sorted[0]?.version ?? "unknown";

    const activeVersions = sorted.map(u => ({
      version: u.version,
      count: u.count,
      sessions: u.sessions,
      lastSeen: u.lastSeen,
    }));

    const hasSkew = sorted.length > 1;

    // 구버전에 머물러 있는 session
    const staleConsumers: DeploymentSkew["staleConsumers"][number][] = [];
    if (hasSkew) {
      for (const usage of sorted.slice(1)) { // latest 제외
        for (const session of usage.sessions) {
          // 이 session이 latest에도 있으면 → 전환 중 (경고 낮춤)
          const inLatest = sorted[0].sessions.includes(session);
          if (!inLatest) {
            staleConsumers.push({
              session,
              version: usage.version,
              count: usage.count,
            });
          }
        }
      }
    }

    let severity: DeploymentSkew["severity"];
    if (!hasSkew) {
      severity = "ok";
    } else if (staleConsumers.length > 0) {
      severity = "critical"; // 구버전 전용 session 존재
    } else {
      severity = "warning"; // version 혼재하지만 모든 session이 양쪽 다 사용
    }

    const summary = !hasSkew
      ? `${prefix}: 전부 ${latestVersion}`
      : staleConsumers.length > 0
        ? `${prefix}: ${sorted.length}개 version 동시 사용. ${staleConsumers.length}개 서비스가 구버전(${staleConsumers[0]?.version})에 머물러 있음.`
        : `${prefix}: ${sorted.length}개 version 혼재 (전환 중 가능성)`;

    results.push({
      prefix,
      activeVersions,
      hasSkew,
      latestVersion,
      staleConsumers,
      severity,
      summary,
    });
  }

  return results.sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, ok: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}
