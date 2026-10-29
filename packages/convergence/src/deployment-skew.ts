// @def.boundary convergence-layer-group
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

import type { Catalog } from '@qa-sdk/core';
import type { VersionUsage } from './convergence.types.js';

export interface DeploymentSkew {
  readonly prefix: string;
  /** 사용 중인 version 목록 (집계량 순; 최신 판정은 latestVersion 별도) */
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
  readonly severity: 'ok' | 'warning' | 'critical';
  readonly summary: string;
}

/** 카탈로그에 선언된 prefix별 최신 버전. 정의와 집계 판정을 연결할 때만 사용한다. */
export function catalogLatestVersions(catalog: Catalog): ReadonlyMap<string, string> {
  const latest = new Map<string, string>();
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    const version = prefix.versions.at(-1)?.version;
    if (version) latest.set(prefixId, version);
  }
  return latest;
}

/**
 * versionUsages에서 배포 스큐를 감지한다.
 */
export function analyzeDeploymentSkew(
  versionUsages: readonly VersionUsage[],
  options?: { latestVersions?: ReadonlyMap<string, string> },
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
    // 같은 version의 usage를 병합 (중복 snapshot에서 같은 version이 여러 번 기록될 수 있음)
    const merged = new Map<string, VersionUsage>();
    for (const u of usages) {
      const existing = merged.get(u.version);
      if (existing) {
        merged.set(u.version, {
          ...existing,
          count: existing.count + u.count,
          sessions: [...new Set([...existing.sessions, ...u.sessions])],
          lastSeen: u.lastSeen > existing.lastSeen ? u.lastSeen : existing.lastSeen,
        });
      } else {
        merged.set(u.version, { ...u, sessions: [...u.sessions] });
      }
    }

    // 명시적 최신 버전이 있으면 그것을 사용한다. 없을 때의 count 추정은
    // 기존 호환성을 위해 유지하되, 정의 기반 최신성으로 해석해서는 안 된다.
    const sorted = [...merged.values()].toSorted((a, b) => b.count - a.count);
    const latestVersion = options?.latestVersions?.get(prefix) ?? sorted[0]?.version ?? 'unknown';

    const activeVersions = sorted.map((u) => ({
      version: u.version,
      count: u.count,
      sessions: u.sessions,
      lastSeen: u.lastSeen,
    }));

    const hasSkew = sorted.length > 1;
    const latestObserved = merged.has(latestVersion);

    // 구버전에 머물러 있는 session
    const staleConsumers: DeploymentSkew['staleConsumers'][number][] = [];
    if (hasSkew && latestObserved) {
      for (const usage of sorted) {
        // 명시된 최신 버전만 제외한다. count 추정 모드에서는 sorted[0]이 최신이다.
        if (usage.version === latestVersion) continue;
        for (const session of usage.sessions) {
          // 이 session이 latest에도 있으면 → 전환 중 (경고 낮춤)
          const latestUsage = merged.get(latestVersion);
          const inLatest = latestUsage?.sessions.includes(session) ?? false;
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

    let severity: DeploymentSkew['severity'];
    if (!hasSkew && options?.latestVersions?.has(prefix) && !latestObserved) {
      // 최신 정의가 아직 한 건도 관측되지 않은 상태는 스큐가 아니라 확인 보류다.
      severity = 'warning';
    } else if (!hasSkew) {
      severity = 'ok';
    } else if (hasSkew && !latestObserved) {
      // catalog 최신 version이 아직 관측되지 않았다면 stale 소비자를 확정할 수 없다.
      severity = 'warning';
    } else if (staleConsumers.length > 0) {
      severity = 'critical'; // 구버전 전용 session 존재
    } else {
      severity = 'warning'; // version 혼재하지만 모든 session이 양쪽 다 사용
    }

    const summary = !hasSkew
      ? latestObserved
        ? `${prefix}: 전부 ${sorted[0]?.version ?? latestVersion}`
        : `${prefix}: 관측 version ${sorted[0]?.version ?? 'unknown'}만 존재 (catalog 최신 ${latestVersion} 미관측)`
      : staleConsumers.length > 0
        ? `${prefix}: ${sorted.length}개 version 동시 사용. ${staleConsumers.length}개 서비스가 구버전(${staleConsumers[0]?.version})에 머물러 있음.`
        : !latestObserved
          ? `${prefix}: ${sorted.length}개 version 관측. catalog 최신 ${latestVersion}는 아직 미관측.`
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

  return results.toSorted((a, b) => {
    const sevOrder = { critical: 0, warning: 1, ok: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}
