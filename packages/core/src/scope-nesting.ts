/**
 * Scope Nesting — contract descent 기반 스코프 중첩 검증
 *
 * Scope = 계약을 소유하는 Boundary (provides/consumes)
 * Nesting = 계약 하향 경로 (상위 scope → 하위 scope)
 * 검증 = "하위가 소비하는 계약의 제공자가 상위에 존재하는가"
 */

// ── 타입 ──────────────────────────────────────────────

/** 계약 참조 — scope가 제공하거나 소비하는 단위 */
export interface ContractRef {
  /** 계약 식별자 */
  contractId: string;
  /** 계약 유형 */
  type: "state" | "logging" | "persist" | "adapter" | "custom";
  /** 계약이 제공하는 shape (타입명 또는 스키마 참조) */
  shape?: string;
  /** provides에서: 상위 provider를 의도적으로 재정의 (기본: false) */
  override?: boolean;
  /** consumes에서: 필수 여부 (기본: true). false이면 provider 없어도 warning만 */
  required?: boolean;
}

/** Scope = 계약을 소유하는 Boundary */
export interface ScopeContract {
  /** 스코프 식별자 */
  scopeId: string;
  /** 이 스코프가 소유하고 하위에 제공하는 계약 */
  provides: ContractRef[];
  /** 이 스코프가 상위로부터 소비하는 계약 */
  consumes: ContractRef[];
  /** 패싯 역할 (boundary 정의) */
  facets?: string[];
}

/** Nesting = 스코프 중첩 순서 (외부→내부) */
export interface ScopeNesting {
  /** 중첩 식별자 */
  nestingId: string;
  /** 스코프 중첩 순서 (index 0 = 최외부) */
  scopes: ScopeContract[];
}

// ── L0 운영 상태 guard ────────────────────────────────

/**
 * 시뮬레이션 guard — L0 운영 상태 제약을 선택적으로 주입.
 * 미주입 시 기본 허용 (fail-open 원칙).
 * doc lifecycle은 제외 — 런타임 영향 경로 특정 시 별도 스펙에서 추가.
 */
export interface SimulationGuards {
  /** 주소가 encode 가능한가 — GateEngine 4-state (active만 true) */
  isEncodable?: (prefixId: string) => boolean;
  /** 품질 게이트 결과 — GateState 9종 중 최종 판정 */
  gateResult?: (gateId: string) => "pass" | "fail" | "review";
  /** 하네스 머신 상태 */
  harnessState?: (machineId: string) => string;
}

/** guard 기본값 — 모두 허용 (fail-open) */
const DEFAULT_GUARDS: Required<SimulationGuards> = {
  isEncodable: () => true,
  gateResult: () => "pass",
  harnessState: () => "active",
};

/** 주입된 guard와 기본값을 병합 */
export function resolveGuards(guards?: SimulationGuards): Required<SimulationGuards> {
  if (!guards) return DEFAULT_GUARDS;
  return {
    isEncodable: guards.isEncodable ?? DEFAULT_GUARDS.isEncodable,
    gateResult: guards.gateResult ?? DEFAULT_GUARDS.gateResult,
    harnessState: guards.harnessState ?? DEFAULT_GUARDS.harnessState,
  };
}

// ── 검증 결과 ─────────────────────────────────────────

export type NestingIssueSeverity = "error" | "warning";

export interface NestingIssue {
  severity: NestingIssueSeverity;
  /** 문제가 발생한 스코프 */
  scopeId: string;
  /** 관련 계약 */
  contractId: string;
  /** 진단 코드 */
  code: NestingIssueCode;
  /** 설명 */
  message: string;
}

export type NestingIssueCode =
  | "missing-provider"     // 소비하는 계약의 제공자가 상위에 없음
  | "duplicate-provider"   // 동일 계약을 복수 스코프가 제공 (override 아닌 경우)
  | "unused-contract"      // 제공하지만 하위에서 소비하지 않음
  | "self-consume"         // 자기가 제공한 계약을 자기가 소비
  | "empty-scope"          // provides도 consumes도 없는 스코프
  | "guard-inactive"       // L0 guard에 의해 계약 비활성
  | "optional-missing"     // optional consume의 provider 부재 (warning)
  | "override-no-parent";  // override 선언했지만 상위에 대체 대상 없음

export interface NestingValidation {
  valid: boolean;
  issues: NestingIssue[];
  /** 계약 하향 경로 — contractId별 provider→consumer 관계 */
  descentPaths: DescentPath[];
}

/** 계약 하향 경로 — 하나의 계약이 어디서 제공되고 어디서 소비되는지 */
export interface DescentPath {
  contractId: string;
  providedBy: string;   // scopeId
  consumedBy: string[]; // scopeId[]
  /** provider의 nesting depth (0-based) */
  providerDepth: number;
}

// ── 검증 함수 ─────────────────────────────────────────

/**
 * 스코프 중첩의 계약 하향 정합성을 검증한다.
 *
 * 규칙:
 * 1. 하위가 소비하는 계약은 상위(조상) 스코프가 제공해야 한다
 * 2. 동일 계약을 복수 스코프가 제공하면 경고
 * 3. 제공하지만 하위에서 소비하지 않으면 경고
 * 4. 자기가 제공한 계약을 자기가 소비하면 에러
 */
export function validateScopeNesting(
  nesting: ScopeNesting,
  guards?: SimulationGuards,
): NestingValidation {
  const issues: NestingIssue[] = [];
  const descentPaths: DescentPath[] = [];
  const { scopes } = nesting;
  const g = resolveGuards(guards);

  // contractId → { providerScopeId, depth }
  const providerMap = new Map<string, { scopeId: string; depth: number }>();
  // contractId → consumer scopeId[]
  const consumerMap = new Map<string, string[]>();

  // 1단계: provider 등록 + 중복 검사 + L0 guard 적용
  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];

    if (scope.provides.length === 0 && scope.consumes.length === 0) {
      issues.push({
        severity: "warning",
        scopeId: scope.scopeId,
        contractId: "",
        code: "empty-scope",
        message: `스코프 "${scope.scopeId}"가 계약을 제공하지도 소비하지도 않음`,
      });
    }

    for (const contract of scope.provides) {
      // L0 guard: isEncodable가 false이면 이 계약은 비활성
      if (!g.isEncodable(contract.contractId)) {
        issues.push({
          severity: "warning",
          scopeId: scope.scopeId,
          contractId: contract.contractId,
          code: "guard-inactive",
          message: `스코프 "${scope.scopeId}"의 계약 "${contract.contractId}"이 gate에 의해 비활성 (encode 불가)`,
        });
        continue; // provider로 등록하지 않음 → 하위가 소비하면 missing-provider
      }

      const existing = providerMap.get(contract.contractId);
      if (existing) {
        if (contract.override) {
          // 의도적 override — 상위 provider를 대체
          providerMap.set(contract.contractId, { scopeId: scope.scopeId, depth: i });
        } else {
          issues.push({
            severity: "warning",
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: "duplicate-provider",
            message: `계약 "${contract.contractId}"이 "${existing.scopeId}"(depth ${existing.depth})와 "${scope.scopeId}"(depth ${i}) 양쪽에서 제공됨`,
          });
          providerMap.set(contract.contractId, { scopeId: scope.scopeId, depth: i });
        }
      } else {
        if (contract.override) {
          issues.push({
            severity: "warning",
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: "override-no-parent",
            message: `스코프 "${scope.scopeId}"가 "${contract.contractId}" override를 선언했지만 상위에 대체 대상 없음`,
          });
        }
        providerMap.set(contract.contractId, { scopeId: scope.scopeId, depth: i });
      }
    }
  }

  // 2단계: consumer 검증 — 조상에 provider 있는지
  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];

    // 자기 제공 계약 self-consume 검사
    const ownProvides = new Set(scope.provides.map(c => c.contractId));

    for (const contract of scope.consumes) {
      if (ownProvides.has(contract.contractId)) {
        issues.push({
          severity: "error",
          scopeId: scope.scopeId,
          contractId: contract.contractId,
          code: "self-consume",
          message: `스코프 "${scope.scopeId}"가 자기가 제공한 계약 "${contract.contractId}"을 소비`,
        });
        continue;
      }

      const provider = providerMap.get(contract.contractId);
      const isOptional = contract.required === false;

      if (!provider) {
        if (isOptional) {
          issues.push({
            severity: "warning",
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: "optional-missing",
            message: `스코프 "${scope.scopeId}"의 선택적 계약 "${contract.contractId}"의 제공자가 없음 (fallback 동작)`,
          });
        } else {
          issues.push({
            severity: "error",
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: "missing-provider",
            message: `스코프 "${scope.scopeId}"가 소비하는 계약 "${contract.contractId}"의 제공자가 없음`,
          });
        }
      } else if (provider.depth >= i) {
        if (isOptional) {
          issues.push({
            severity: "warning",
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: "optional-missing",
            message: `스코프 "${scope.scopeId}"의 선택적 계약 "${contract.contractId}"의 제공자 "${provider.scopeId}"가 상위가 아님 (fallback 동작)`,
          });
        } else {
          issues.push({
            severity: "error",
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: "missing-provider",
            message: `스코프 "${scope.scopeId}"(depth ${i})가 소비하는 계약 "${contract.contractId}"의 제공자 "${provider.scopeId}"(depth ${provider.depth})가 상위가 아님`,
          });
        }
      }

      // consumer 등록
      const consumers = consumerMap.get(contract.contractId) ?? [];
      consumers.push(scope.scopeId);
      consumerMap.set(contract.contractId, consumers);
    }
  }

  // 3단계: unused contract 검사
  for (const [contractId, provider] of providerMap) {
    const consumers = consumerMap.get(contractId);
    if (!consumers || consumers.length === 0) {
      issues.push({
        severity: "warning",
        scopeId: provider.scopeId,
        contractId,
        code: "unused-contract",
        message: `스코프 "${provider.scopeId}"가 제공하는 계약 "${contractId}"을 하위에서 소비하지 않음`,
      });
    }
  }

  // descent paths 조립
  for (const [contractId, provider] of providerMap) {
    descentPaths.push({
      contractId,
      providedBy: provider.scopeId,
      consumedBy: consumerMap.get(contractId) ?? [],
      providerDepth: provider.depth,
    });
  }

  const hasError = issues.some(i => i.severity === "error");

  return {
    valid: !hasError,
    issues,
    descentPaths,
  };
}

// ── Provider Resolution ───────────────────────────────

/** 해결된 계약 — 특정 scope 관점에서 소비 계약의 provider 정보 */
export interface ResolvedContract {
  contractId: string;
  provider: { scopeId: string; depth: number } | null;
  consumer: { scopeId: string; depth: number };
  /** override로 대체되었는가 */
  overridden: boolean;
  /** optional이고 provider 없는가 */
  optional: boolean;
}

/**
 * 특정 scope 관점에서 소비하는 계약의 provider를 조회한다.
 * override/optional/guard를 반영한 실제 해결 결과를 반환.
 */
export function resolveContracts(
  nesting: ScopeNesting,
  scopeId: string,
  guards?: SimulationGuards,
): ResolvedContract[] {
  const g = resolveGuards(guards);
  const { scopes } = nesting;

  const scopeIndex = scopes.findIndex(s => s.scopeId === scopeId);
  if (scopeIndex < 0) return [];

  const scope = scopes[scopeIndex];

  // provider 맵 구축 (override 반영, guard 반영)
  const providerMap = new Map<string, { scopeId: string; depth: number }>();
  for (let i = 0; i < scopes.length; i++) {
    for (const contract of scopes[i].provides) {
      if (!g.isEncodable(contract.contractId)) continue;
      const existing = providerMap.get(contract.contractId);
      if (existing && !contract.override) continue; // 비-override는 첫 등록 유지
      providerMap.set(contract.contractId, { scopeId: scopes[i].scopeId, depth: i });
    }
  }

  return scope.consumes.map((contract): ResolvedContract => {
    const provider = providerMap.get(contract.contractId) ?? null;
    const isOptional = contract.required === false;
    const validProvider = provider && provider.depth < scopeIndex ? provider : null;

    // override 여부: provider가 있고, 더 상위에 다른 provider도 있었는지
    let overridden = false;
    if (validProvider) {
      // 현재 provider 이전에 동일 계약을 제공하는 scope가 있었는지 확인
      for (let i = 0; i < validProvider.depth; i++) {
        if (scopes[i].provides.some(c => c.contractId === contract.contractId)) {
          overridden = true;
          break;
        }
      }
    }

    return {
      contractId: contract.contractId,
      provider: validProvider,
      consumer: { scopeId, depth: scopeIndex },
      overridden,
      optional: isOptional && validProvider === null,
    };
  });
}

// ── 순서 검증 유틸 ────────────────────────────────────

/**
 * 두 스코프 순서를 바꿨을 때 계약 하향이 깨지는지 검사한다.
 * 순서 변경이 안전하면 null, 깨지면 issue 목록 반환.
 */
export function checkSwapSafety(
  nesting: ScopeNesting,
  indexA: number,
  indexB: number,
): NestingIssue[] | null {
  const swapped: ScopeNesting = {
    ...nesting,
    scopes: [...nesting.scopes],
  };
  [swapped.scopes[indexA], swapped.scopes[indexB]] =
    [swapped.scopes[indexB], swapped.scopes[indexA]];

  const result = validateScopeNesting(swapped);
  const errors = result.issues.filter(i => i.severity === "error");
  return errors.length > 0 ? errors : null;
}
