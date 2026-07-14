// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Scope Nesting — contract descent 기반 스코프 중첩 검증
 *
 * Scope = 계약을 소유하는 Boundary (provides/consumes)
 * Nesting = 계약 하향 경로 (상위 scope → 하위 scope)
 * 검증 = "하위가 소비하는 계약의 제공자가 상위에 존재하는가"
 */

// ── 타입 ──────────────────────────────────────────────

export interface ContractRef {
  contractId: string;
  type: 'state' | 'logging' | 'persist' | 'adapter' | 'custom';
  shape?: string;
  /** provides에서: 상위 provider를 의도적으로 재정의 */
  override?: boolean;
  /** consumes에서: 필수 여부 (기본: true). false이면 provider 없어도 warning만 */
  required?: boolean;
  /** provides에서: 데이터 준비 시점 이벤트 키. 미설정 시 즉시 */
  readyAfter?: string;
}

export interface ScopeContract {
  scopeId: string;
  provides: ContractRef[];
  consumes: ContractRef[];
  facets?: string[];
}

export interface ScopeNesting {
  nestingId: string;
  /** 스코프 중첩 순서 (index 0 = 최외부) */
  scopes: ScopeContract[];
}

// ── L0 운영 상태 guard ────────────────────────────────

/**
 * 시뮬레이션 guard — L0 운영 상태 제약을 선택적으로 주입.
 * 미주입 시 기본 허용 (fail-open 원칙).
 */
export interface SimulationGuards {
  /** GateEngine 4-state: active만 true */
  isEncodable?: (prefixId: string) => boolean;
  /** GateState 9종 최종 판정 */
  gateResult?: (gateId: string) => 'pass' | 'fail' | 'review';
  harnessState?: (machineId: string) => string;
}

const DEFAULT_GUARDS: Required<SimulationGuards> = {
  isEncodable: () => true,
  gateResult: () => 'pass',
  harnessState: () => 'active',
};

export function resolveGuards(guards?: SimulationGuards): Required<SimulationGuards> {
  if (!guards) return DEFAULT_GUARDS;
  return {
    isEncodable: guards.isEncodable ?? DEFAULT_GUARDS.isEncodable,
    gateResult: guards.gateResult ?? DEFAULT_GUARDS.gateResult,
    harnessState: guards.harnessState ?? DEFAULT_GUARDS.harnessState,
  };
}

// ── 검증 결과 ─────────────────────────────────────────

export type NestingIssueSeverity = 'error' | 'warning';

export interface NestingIssue {
  severity: NestingIssueSeverity;
  scopeId: string;
  contractId: string;
  code: NestingIssueCode;
  message: string;
}

export type NestingIssueCode =
  | 'missing-provider'
  | 'duplicate-provider'
  | 'unused-contract'
  | 'self-consume'
  | 'empty-scope'
  | 'guard-inactive'
  | 'optional-missing'
  | 'override-no-parent';

export interface NestingValidation {
  valid: boolean;
  issues: NestingIssue[];
  descentPaths: DescentPath[];
}

export interface DescentPath {
  contractId: string;
  providedBy: string;
  consumedBy: string[];
  providerDepth: number;
}

// ── providerMap 공통 구축 ─────────────────────────────

export interface ProviderEntry {
  scopeId: string;
  depth: number;
}

/**
 * 스코프 목록에서 contractId → provider 맵을 구축한다.
 * override/guard를 반영하며, issues가 주어지면 부수효과로 진단을 수집한다.
 */
export function buildProviderMap(
  scopes: ScopeContract[],
  isEncodable: (contractId: string) => boolean,
  issues?: NestingIssue[],
): Map<string, ProviderEntry> {
  const providerMap = new Map<string, ProviderEntry>();

  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];

    if (issues && scope.provides.length === 0 && scope.consumes.length === 0) {
      issues.push({
        severity: 'warning',
        scopeId: scope.scopeId,
        contractId: '',
        code: 'empty-scope',
        message: `스코프 "${scope.scopeId}"가 계약을 제공하지도 소비하지도 않음`,
      });
    }

    for (const contract of scope.provides) {
      if (!isEncodable(contract.contractId)) {
        if (issues) {
          issues.push({
            severity: 'warning',
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: 'guard-inactive',
            message: `스코프 "${scope.scopeId}"의 계약 "${contract.contractId}"이 gate에 의해 비활성 (encode 불가)`,
          });
        }
        continue;
      }

      const existing = providerMap.get(contract.contractId);
      if (existing) {
        if (contract.override) {
          providerMap.set(contract.contractId, { scopeId: scope.scopeId, depth: i });
        } else if (issues) {
          issues.push({
            severity: 'warning',
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: 'duplicate-provider',
            message: `계약 "${contract.contractId}"이 "${existing.scopeId}"(depth ${existing.depth})와 "${scope.scopeId}"(depth ${i}) 양쪽에서 제공됨`,
          });
        }
      } else {
        if (issues && contract.override) {
          issues.push({
            severity: 'warning',
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: 'override-no-parent',
            message: `스코프 "${scope.scopeId}"가 "${contract.contractId}" override를 선언했지만 상위에 대체 대상 없음`,
          });
        }
        providerMap.set(contract.contractId, { scopeId: scope.scopeId, depth: i });
      }
    }
  }

  return providerMap;
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
  const { scopes } = nesting;
  const g = resolveGuards(guards);

  const providerMap = buildProviderMap(scopes, g.isEncodable, issues);
  const consumerMap = new Map<string, string[]>();

  // consumer 검증 — 조상에 provider 있는지
  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];
    const ownProvides = new Set(scope.provides.map((c) => c.contractId));

    for (const contract of scope.consumes) {
      if (ownProvides.has(contract.contractId)) {
        issues.push({
          severity: 'error',
          scopeId: scope.scopeId,
          contractId: contract.contractId,
          code: 'self-consume',
          message: `스코프 "${scope.scopeId}"가 자기가 제공한 계약 "${contract.contractId}"을 소비`,
        });
        continue;
      }

      const provider = providerMap.get(contract.contractId);
      const isOptional = contract.required === false;

      if (!provider) {
        if (isOptional) {
          issues.push({
            severity: 'warning',
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: 'optional-missing',
            message: `스코프 "${scope.scopeId}"의 선택적 계약 "${contract.contractId}"의 제공자가 없음 (fallback 동작)`,
          });
        } else {
          issues.push({
            severity: 'error',
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: 'missing-provider',
            message: `스코프 "${scope.scopeId}"가 소비하는 계약 "${contract.contractId}"의 제공자가 없음`,
          });
        }
      } else if (provider.depth >= i) {
        if (isOptional) {
          issues.push({
            severity: 'warning',
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: 'optional-missing',
            message: `스코프 "${scope.scopeId}"의 선택적 계약 "${contract.contractId}"의 제공자 "${provider.scopeId}"가 상위가 아님 (fallback 동작)`,
          });
        } else {
          issues.push({
            severity: 'error',
            scopeId: scope.scopeId,
            contractId: contract.contractId,
            code: 'missing-provider',
            message: `스코프 "${scope.scopeId}"(depth ${i})가 소비하는 계약 "${contract.contractId}"의 제공자 "${provider.scopeId}"(depth ${provider.depth})가 상위가 아님`,
          });
        }
      }

      const consumers = consumerMap.get(contract.contractId) ?? [];
      consumers.push(scope.scopeId);
      consumerMap.set(contract.contractId, consumers);
    }
  }

  // unused contract 검사
  for (const [contractId, provider] of providerMap) {
    const consumers = consumerMap.get(contractId);
    if (!consumers || consumers.length === 0) {
      issues.push({
        severity: 'warning',
        scopeId: provider.scopeId,
        contractId,
        code: 'unused-contract',
        message: `스코프 "${provider.scopeId}"가 제공하는 계약 "${contractId}"을 하위에서 소비하지 않음`,
      });
    }
  }

  // descent paths 조립
  const descentPaths: DescentPath[] = [];
  for (const [contractId, provider] of providerMap) {
    descentPaths.push({
      contractId,
      providedBy: provider.scopeId,
      consumedBy: consumerMap.get(contractId) ?? [],
      providerDepth: provider.depth,
    });
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    descentPaths,
  };
}

// ── Provider Resolution ───────────────────────────────

export interface ResolvedContract {
  contractId: string;
  provider: ProviderEntry | null;
  consumer: ProviderEntry;
  overridden: boolean;
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
  const { scopes } = nesting;
  const scopeIndex = scopes.findIndex((s) => s.scopeId === scopeId);
  if (scopeIndex < 0) return [];

  const g = resolveGuards(guards);
  const providerMap = buildProviderMap(scopes, g.isEncodable);
  const scope = scopes[scopeIndex];

  return scope.consumes.map((contract): ResolvedContract => {
    const provider = providerMap.get(contract.contractId) ?? null;
    const isOptional = contract.required === false;
    const validProvider = provider && provider.depth < scopeIndex ? provider : null;

    let overridden = false;
    if (validProvider) {
      for (let i = 0; i < validProvider.depth; i++) {
        if (scopes[i].provides.some((c) => c.contractId === contract.contractId)) {
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
 * 안전하면 null, 깨지면 error issue 목록 반환.
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
  [swapped.scopes[indexA], swapped.scopes[indexB]] = [
    swapped.scopes[indexB],
    swapped.scopes[indexA],
  ];

  const result = validateScopeNesting(swapped);
  const errors = result.issues.filter((i) => i.severity === 'error');
  return errors.length > 0 ? errors : null;
}
