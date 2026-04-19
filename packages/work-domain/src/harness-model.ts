// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 하네스 상태 모델
 *
 * 품질 게이트/계약/번들을 "문서 종류"가 아니라
 * 하네스가 현재 어느 상태에 도달했는가로 읽기 위한 유한 상태 모델.
 */

// ─── 상태 ───────────────────────────────────────────────

/** 하네스 상태 식별자 */
export type HarnessStateId =
  | "concept-defined"  // 개념/번들 경계가 정의됨
  | "contract-bound"   // 인터페이스 계약이 연결됨
  | "gate-bound"       // 검증 게이트가 연결됨
  | "verified";        // 게이트 실행 증거까지 확보됨

/** 번들 내부 문서의 역할 */
export type HarnessDocRole =
  | "concept"
  | "contract"
  | "gate"
  | "support";

export interface HarnessStateDef {
  readonly id: HarnessStateId;
  readonly name: string;
  readonly nameKo: string;
  readonly description: string;
}

export interface HarnessBundleDoc {
  readonly id: string;
  readonly scope: string;
  readonly aspect: string;
  readonly depth: string;
  readonly tags?: readonly string[];
  readonly gate?: unknown;
}

export interface HarnessStateSnapshot {
  readonly current: HarnessStateId;
  readonly reached: readonly HarnessStateId[];
  readonly next?: HarnessStateId;
  readonly missing: readonly string[];
}

export const HARNESS_STATES: readonly HarnessStateDef[] = [
  {
    id: "concept-defined",
    name: "Concept Defined",
    nameKo: "개념 정의",
    description: "번들/개념 경계와 관리 단위가 문서로 고정됨",
  },
  {
    id: "contract-bound",
    name: "Contract Bound",
    nameKo: "계약 연결",
    description: "기능의 인터페이스 계약 문서가 번들에 연결됨",
  },
  {
    id: "gate-bound",
    name: "Gate Bound",
    nameKo: "게이트 연결",
    description: "validation 게이트 문서가 계약을 검증하는 구조로 연결됨",
  },
  {
    id: "verified",
    name: "Verified",
    nameKo: "검증 완료",
    description: "게이트 실행 증거까지 확보되어 하네스가 닫힘",
  },
] as const;

export function getHarnessStateDef(id: HarnessStateId): HarnessStateDef {
  const found = HARNESS_STATES.find((state) => state.id === id);
  if (!found) throw new Error(`알 수 없는 HarnessState: ${id}`);
  return found;
}

// ─── 문서 분류 ──────────────────────────────────────────

export function classifyHarnessDocRole(doc: HarnessBundleDoc): HarnessDocRole {
  if (doc.tags?.includes("quality-bundle")) return "concept";
  if (doc.scope === "flow" && doc.depth === "overview") return "concept";
  if (doc.scope === "interface") return "contract";
  if (doc.gate || (doc.scope === "constraint" && doc.depth === "validation")) return "gate";
  return "support";
}

// ─── 상태 도출 ──────────────────────────────────────────

export function deriveHarnessState(
  docs: readonly HarnessBundleDoc[],
  options: { verified?: boolean } = {},
): HarnessStateSnapshot {
  const hasConcept = docs.some((doc) => classifyHarnessDocRole(doc) === "concept");
  const hasContract = docs.some((doc) => classifyHarnessDocRole(doc) === "contract");
  const hasGate = docs.some((doc) => classifyHarnessDocRole(doc) === "gate");
  const verified = options.verified === true;

  const reached: HarnessStateId[] = [];
  const missing: string[] = [];

  if (hasConcept) reached.push("concept-defined");
  else missing.push("개념 번들 문서");

  if (hasConcept && hasContract) reached.push("contract-bound");
  else if (hasConcept) missing.push("인터페이스 계약 문서");

  if (hasConcept && hasContract && hasGate) reached.push("gate-bound");
  else if (hasConcept && hasContract) missing.push("validation gate 문서");

  if (hasConcept && hasContract && hasGate && verified) reached.push("verified");
  else if (hasConcept && hasContract && hasGate) missing.push("게이트 실행 증거");

  const current = reached.at(-1) ?? "concept-defined";
  const next = current === "verified"
    ? undefined
    : HARNESS_STATES.find((state) => !reached.includes(state.id as HarnessStateId))?.id;

  return {
    current,
    reached,
    next,
    missing,
  };
}
