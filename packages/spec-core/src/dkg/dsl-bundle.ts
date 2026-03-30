/**
 * DslBundle — prefix 묶음 + 서비스 바인딩 + 사용 패턴 정의.
 *
 * DSL = "이 prefix들을 이 서비스 컨텍스트에서 이렇게 조합해서 쓴다"의 선언.
 *
 * 개별 prefix는 차원 교차의 원자 단위.
 * DslBundle은 여러 prefix를 묶어 하나의 사용 시나리오를 구성한다.
 *
 * 예:
 *   관측 DSL = { page_view, endpoint, flow_point } × service 바인딩
 *   인프라 DSL = { deploy_event, health_event, endpoint } × 전 환경 바인딩
 *   결제 DSL = { permission, endpoint, flow_point, order_event } × prod 바인딩
 */

import type { Catalog } from "@qa-sdk/core";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

/** DSL 멤버 — bundle에 포함되는 prefix와 그 역할 */
export interface DslMember {
  /** 참조하는 prefix ID */
  readonly prefixId: string;
  /** 이 prefix의 역할 */
  readonly role: DslMemberRole;
  /** service prefix를 참조하는 label 이름 (있을 경우) */
  readonly svcRefLabel?: string;
}

export type DslMemberRole =
  | "observation"   // 관측 (page_view, endpoint, flow_point)
  | "permission"    // 권한 (permission, rbac)
  | "event"         // 비즈니스 이벤트 (cart_event, order_event)
  | "infra"         // 인프라 이벤트 (deploy_event, health_event)
  | "context";      // 컨텍스트 제공 (service)

/** 서비스 바인딩 — SDK 부트 시 고정되는 차원 */
export interface ServiceBinding {
  /** 바인딩 대상 prefix (보통 "service") */
  readonly prefixId: string;
  /** 고정되는 차원 목록 */
  readonly fixedDims: readonly string[];
}

/**
 * 실행 컨텍스트 — 데이터 출처와 목적을 식별.
 *
 * 3가지 독립 관심사를 분리:
 * - env axis:  서비스가 어디서 돌아가는가 (인프라, 좌표에 인코딩)
 * - build:     코드가 어떻게 빌드됐는가 (CI/CD, envelope에 포함)
 * - execution: 이 데이터가 왜 존재하는가 (테스트 목적, 필터/격리 기준)
 */
export type ExecutionMode = "live" | "test" | "synthetic" | "replay";

export interface ExecutionContext {
  /** 실행 모드 — 이 데이터가 왜 존재하는가 */
  readonly mode: ExecutionMode;
  /** 실행 식별자 — 테스트 suite ID, 시나리오 ID 등 */
  readonly executionId?: string;
  /** 실행 태그 — 필터/그룹핑용 자유 태그 */
  readonly tags?: readonly string[];
}

/** DslBundle 정의 */
export interface DslBundle {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  /** 서비스 컨텍스트 바인딩 */
  readonly serviceBinding: ServiceBinding;

  /** 실행 컨텍스트 — 데이터 출처/목적 식별 (선택) */
  readonly executionContext?: ExecutionContext;

  /** 이 DSL을 구성하는 prefix 멤버 */
  readonly members: readonly DslMember[];

  /** 참조하는 FlowDefinition ID (선택) */
  readonly flows?: readonly string[];

  /** 이 DSL 내에서 유지해야 하는 불변조건 (선택) */
  readonly invariants?: readonly string[];
}

/** DslBundle 생성 입력 */
export interface DslBundleInput {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly serviceBinding: ServiceBinding;
  readonly executionContext?: ExecutionContext;
  readonly members: readonly DslMemberInput[];
  readonly flows?: readonly string[];
  readonly invariants?: readonly string[];
}

export interface DslMemberInput {
  readonly prefixId: string;
  readonly role: DslMemberRole;
}

// ═══════════════════════════════════════════════════════════════
//  Builder
// ═══════════════════════════════════════════════════════════════

/**
 * DslBundle을 생성한다.
 *
 * 각 멤버 prefix의 dims를 검사하여 svcRefLabel을 자동 감지한다.
 * prefix_ref → serviceBinding.prefixId 인 차원이 있으면 그것이 svcRefLabel.
 */
export function defineDslBundle(
  catalog: Catalog,
  input: DslBundleInput,
): DslBundle {
  // serviceBinding.prefixId가 실제로 존재하는지 검증
  const svcPrefix = catalog.prefixes[input.serviceBinding.prefixId];
  if (!svcPrefix) {
    throw new Error(`Unknown service prefix: ${input.serviceBinding.prefixId}`);
  }

  // fixedDims가 service prefix의 labels에 포함되는지 검증
  for (const dim of input.serviceBinding.fixedDims) {
    if (!svcPrefix.labels.includes(dim)) {
      throw new Error(
        `fixedDim "${dim}" not found in service prefix "${input.serviceBinding.prefixId}" labels`,
      );
    }
  }

  // 각 멤버 prefix를 검증하고 svcRefLabel 자동 감지
  const members: DslMember[] = input.members.map(m => {
    const prefix = catalog.prefixes[m.prefixId];
    if (!prefix) {
      throw new Error(`Unknown prefix: ${m.prefixId}`);
    }

    // prefix_ref → service 인 차원을 찾는다
    let svcRefLabel: string | undefined;
    for (const [label, dimRef] of Object.entries(prefix.dims)) {
      if (
        dimRef.kind === "prefix_ref" &&
        dimRef.prefixId === input.serviceBinding.prefixId
      ) {
        svcRefLabel = label;
        break;
      }
    }

    return { prefixId: m.prefixId, role: m.role, svcRefLabel };
  });

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    serviceBinding: input.serviceBinding,
    executionContext: input.executionContext,
    members,
    flows: input.flows,
    invariants: input.invariants,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Registry
// ═══════════════════════════════════════════════════════════════

export class DslBundleRegistry {
  private readonly bundles = new Map<string, DslBundle>();

  register(bundle: DslBundle): void {
    if (this.bundles.has(bundle.id)) {
      throw new Error(`DslBundle already registered: ${bundle.id}`);
    }
    this.bundles.set(bundle.id, bundle);
  }

  get(id: string): DslBundle | undefined {
    return this.bundles.get(id);
  }

  getOrThrow(id: string): DslBundle {
    const bundle = this.bundles.get(id);
    if (!bundle) throw new Error(`DslBundle not found: ${id}`);
    return bundle;
  }

  list(): DslBundle[] {
    return [...this.bundles.values()];
  }

  /** 특정 prefix가 포함된 모든 DSL 반환 */
  findByPrefix(prefixId: string): DslBundle[] {
    return this.list().filter(b => b.members.some(m => m.prefixId === prefixId));
  }

  /** 특정 역할의 멤버를 가진 모든 DSL 반환 */
  findByRole(role: DslMemberRole): DslBundle[] {
    return this.list().filter(b => b.members.some(m => m.role === role));
  }

  /** 서비스 바인딩된 모든 prefix 목록 (svcRefLabel 있는 멤버) */
  listServiceBoundPrefixes(): { prefixId: string; svcRefLabel: string; bundleId: string }[] {
    const result: { prefixId: string; svcRefLabel: string; bundleId: string }[] = [];
    for (const bundle of this.bundles.values()) {
      for (const member of bundle.members) {
        if (member.svcRefLabel) {
          result.push({ prefixId: member.prefixId, svcRefLabel: member.svcRefLabel, bundleId: bundle.id });
        }
      }
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
//  Analysis
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  Version Skew Detection
// ═══════════════════════════════════════════════════════════════

/** 단일 멤버의 버전 정보 */
export interface MemberVersionInfo {
  readonly prefixId: string;
  readonly versionCount: number;
  readonly versions: readonly string[];
  readonly latestVersion: string;
  /** 이 prefix가 사용하는 axis별 버전 (latest 기준) */
  readonly axisVersions: Record<string, string>;
}

/** 축 버전 충돌 */
export interface AxisVersionConflict {
  readonly axisId: string;
  readonly versions: Record<string, string>; // prefixId → axis version
  readonly spread: number; // 최대 - 최소 버전 숫자
}

/** DSL 번들 내 버전 스큐 리포트 */
export interface DslVersionSkewReport {
  readonly bundleId: string;
  /** 멤버별 버전 정보 */
  readonly members: readonly MemberVersionInfo[];
  /** 같은 축을 다른 버전으로 참조하는 충돌 */
  readonly axisConflicts: readonly AxisVersionConflict[];
  /** 멤버 간 prefix 버전 수 차이 (max - min) */
  readonly maxVersionSpread: number;
  /** 경고 수준 */
  readonly severity: "ok" | "minor" | "major";
  /** 사람이 읽을 수 있는 요약 */
  readonly summary: string;
}

/**
 * DSL 번들 내 멤버 prefix 간 버전 스큐를 분석한다.
 *
 * 감지 항목:
 * 1. 같은 축을 다른 버전으로 참조하는 멤버 (예: permission은 role:v4, rbac은 role:v1)
 * 2. prefix 버전 수 차이가 큰 멤버 (예: permission은 4개 버전, endpoint는 1개)
 * 3. refEntries가 다른 service 집합을 참조하는 멤버
 */
export function analyzeDslVersionSkew(
  catalog: Catalog,
  bundle: DslBundle,
): DslVersionSkewReport {
  const members: MemberVersionInfo[] = [];

  for (const member of bundle.members) {
    const prefix = catalog.prefixes[member.prefixId];
    if (!prefix) continue;

    const versions = prefix.versions.map(v => v.version);
    const latest = prefix.versions[prefix.versions.length - 1];

    members.push({
      prefixId: member.prefixId,
      versionCount: versions.length,
      versions,
      latestVersion: latest.version,
      axisVersions: latest.axisVersions,
    });
  }

  // 축 버전 충돌 탐지: 같은 axisId를 다른 version으로 참조하는 멤버 쌍
  const axisVersionMap = new Map<string, Map<string, string>>(); // axisId → (prefixId → version)

  for (const m of members) {
    for (const [label, axisVer] of Object.entries(m.axisVersions)) {
      // label에 대응하는 실제 axisId를 찾는다
      const prefix = catalog.prefixes[m.prefixId];
      if (!prefix) continue;
      const dimRef = prefix.dims[label];
      if (!dimRef || dimRef.kind !== "axis") continue;
      const axisId = dimRef.axisId;

      if (!axisVersionMap.has(axisId)) {
        axisVersionMap.set(axisId, new Map());
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- set above guarantees presence
      axisVersionMap.get(axisId)!.set(m.prefixId, axisVer);
    }
  }

  const axisConflicts: AxisVersionConflict[] = [];
  for (const [axisId, prefixVersions] of axisVersionMap) {
    const uniqueVersions = new Set(prefixVersions.values());
    if (uniqueVersions.size > 1) {
      const nums = [...uniqueVersions].map(v => parseInt(v.replace(/\D/g, ""), 10) || 0);
      axisConflicts.push({
        axisId,
        versions: Object.fromEntries(prefixVersions),
        spread: Math.max(...nums) - Math.min(...nums),
      });
    }
  }

  // prefix 버전 수 차이
  const versionCounts = members.map(m => m.versionCount);
  const maxVersionSpread = versionCounts.length > 0
    ? Math.max(...versionCounts) - Math.min(...versionCounts)
    : 0;

  // 심각도 판정
  let severity: "ok" | "minor" | "major" = "ok";
  if (axisConflicts.some(c => c.spread >= 3)) severity = "major";
  else if (axisConflicts.length > 0 || maxVersionSpread >= 3) severity = "minor";

  // 요약
  const summaryParts: string[] = [];
  if (axisConflicts.length > 0) {
    summaryParts.push(
      `축 버전 충돌 ${axisConflicts.length}건: ${axisConflicts.map(c => `${c.axisId}(spread=${c.spread})`).join(", ")}`,
    );
  }
  if (maxVersionSpread >= 2) {
    const newest = members.reduce((a, b) => a.versionCount > b.versionCount ? a : b);
    const oldest = members.reduce((a, b) => a.versionCount < b.versionCount ? a : b);
    summaryParts.push(
      `prefix 버전 격차: ${newest.prefixId}(${newest.versionCount}개) vs ${oldest.prefixId}(${oldest.versionCount}개)`,
    );
  }

  return {
    bundleId: bundle.id,
    members,
    axisConflicts,
    maxVersionSpread,
    severity,
    summary: summaryParts.length > 0 ? summaryParts.join(". ") : "버전 스큐 없음",
  };
}

/**
 * 모든 DSL 번들에 대해 버전 스큐를 분석한다.
 */
export function analyzeAllVersionSkew(
  catalog: Catalog,
  registry: DslBundleRegistry,
): DslVersionSkewReport[] {
  return registry.list().map(bundle => analyzeDslVersionSkew(catalog, bundle));
}

export interface DslCoverageReport {
  /** DSL에 포함된 prefix 목록 */
  readonly covered: readonly string[];
  /** DSL에 포함되지 않은 prefix 목록 */
  readonly uncovered: readonly string[];
  /** 서비스 바인딩이 없는 멤버 (svcRefLabel 없음) */
  readonly unboundMembers: readonly string[];
  /** 역할별 멤버 수 */
  readonly roleCounts: Record<DslMemberRole, number>;
}

/**
 * 카탈로그의 모든 prefix에 대해 DSL 커버리지를 분석한다.
 */
export function analyzeDslCoverage(
  catalog: Catalog,
  registry: DslBundleRegistry,
): DslCoverageReport {
  const allPrefixes = Object.keys(catalog.prefixes);
  const coveredSet = new Set<string>();
  const unboundMembers: string[] = [];
  const roleCounts: Record<string, number> = {};

  for (const bundle of registry.list()) {
    // serviceBindingPrefix도 커버된 것으로 카운트
    coveredSet.add(bundle.serviceBinding.prefixId);
    for (const member of bundle.members) {
      coveredSet.add(member.prefixId);
      roleCounts[member.role] = (roleCounts[member.role] ?? 0) + 1;
      if (!member.svcRefLabel && member.role !== "context") {
        unboundMembers.push(member.prefixId);
      }
    }
  }

  return {
    covered: allPrefixes.filter(p => coveredSet.has(p)),
    uncovered: allPrefixes.filter(p => !coveredSet.has(p)),
    unboundMembers,
    roleCounts: roleCounts as Record<DslMemberRole, number>,
  };
}
