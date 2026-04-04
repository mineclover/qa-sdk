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
  | "missing-provider"    // 소비하는 계약의 제공자가 상위에 없음
  | "duplicate-provider"  // 동일 계약을 복수 스코프가 제공
  | "unused-contract"     // 제공하지만 하위에서 소비하지 않음
  | "self-consume"        // 자기가 제공한 계약을 자기가 소비
  | "empty-scope";        // provides도 consumes도 없는 스코프

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
export function validateScopeNesting(nesting: ScopeNesting): NestingValidation {
  const issues: NestingIssue[] = [];
  const descentPaths: DescentPath[] = [];
  const { scopes } = nesting;

  // contractId → { providerScopeId, depth }
  const providerMap = new Map<string, { scopeId: string; depth: number }>();
  // contractId → consumer scopeId[]
  const consumerMap = new Map<string, string[]>();

  // 1단계: provider 등록 + 중복 검사
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
      const existing = providerMap.get(contract.contractId);
      if (existing) {
        issues.push({
          severity: "warning",
          scopeId: scope.scopeId,
          contractId: contract.contractId,
          code: "duplicate-provider",
          message: `계약 "${contract.contractId}"이 "${existing.scopeId}"(depth ${existing.depth})와 "${scope.scopeId}"(depth ${i}) 양쪽에서 제공됨`,
        });
      }
      providerMap.set(contract.contractId, { scopeId: scope.scopeId, depth: i });
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
      if (!provider) {
        issues.push({
          severity: "error",
          scopeId: scope.scopeId,
          contractId: contract.contractId,
          code: "missing-provider",
          message: `스코프 "${scope.scopeId}"가 소비하는 계약 "${contract.contractId}"의 제공자가 없음`,
        });
      } else if (provider.depth >= i) {
        // provider가 자기와 같은 depth이거나 하위에 있음
        issues.push({
          severity: "error",
          scopeId: scope.scopeId,
          contractId: contract.contractId,
          code: "missing-provider",
          message: `스코프 "${scope.scopeId}"(depth ${i})가 소비하는 계약 "${contract.contractId}"의 제공자 "${provider.scopeId}"(depth ${provider.depth})가 상위가 아님`,
        });
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
