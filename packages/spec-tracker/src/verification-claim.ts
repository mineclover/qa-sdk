// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import type { ContractEvidence, ContractMarkerKind } from "./types.js";

/**
 * Verification Claim — 스펙 문장의 최소 검증 단위.
 *
 * 문서 자체가 아니라 "검증 가능한 주장 1건"을 표현한다.
 * 이후 구현/테스트/런타임/리뷰 증거를 이 claim에 바인딩한다.
 */
export interface VerificationClaim {
  /** stable ID — 수동 또는 추출기에서 부여 */
  readonly claimId: string;
  /** 소속 spec 문서 */
  readonly specId: string;
  /** 검증 대상 subject — prefix, endpoint, flow, service, symbol 등 */
  readonly subjectRef: string;
  /** 계약 마커 기반 claim이면 marker를 보존 */
  readonly marker?: ContractMarkerKind;
  /** 사람이 읽는 claim 본문 */
  readonly text: string;
}

export type DefinitionState =
  | "missing"
  | "declared"
  | "structured"
  | "linked";

export type ImplementationState =
  | "none"
  | "partial"
  | "implemented";

export type TestState =
  | "none"
  | "mapped"
  | "passing"
  | "failing";

export type RuntimeState =
  | "none"
  | "observable"
  | "observed";

export type ReviewState =
  | "none"
  | "reviewed"
  | "accepted";

/**
 * Product FSM의 합성 결과.
 *
 * declared:
 *   문서 claim은 있으나 아직 binding이 거의 없음
 * bound:
 *   구현/테스트/런타임 중 최소 1개 binding이 연결됨
 * exercised:
 *   테스트 통과 또는 런타임 관측이 발생함
 * verified:
 *   linked + implemented + exercised + accepted
 * contradicted:
 *   연결된 검증 증거 중 실패가 확인됨
 * stale:
 *   최신 문서 버전과 binding/evidence가 어긋남
 */
export type ClaimCompositeState =
  | "absent"
  | "declared"
  | "bound"
  | "exercised"
  | "verified"
  | "contradicted"
  | "stale";

export interface ClaimDefinitionInput {
  readonly declared?: boolean;
  readonly structured?: boolean;
  readonly linked?: boolean;
  readonly stale?: boolean;
}

export interface ClaimImplementationInput {
  readonly bindings?: readonly string[];
  readonly implementedBindings?: readonly string[];
}

export interface ClaimTestingInput {
  readonly bindings?: readonly string[];
  readonly evidences?: readonly ContractEvidence[];
}

export interface ClaimRuntimeInput {
  readonly observable?: boolean;
  readonly observed?: boolean;
}

export interface ClaimReviewInput {
  readonly reviewed?: boolean;
  readonly accepted?: boolean;
}

export interface VerificationClaimInput {
  readonly claim: VerificationClaim;
  readonly definition?: ClaimDefinitionInput;
  readonly implementation?: ClaimImplementationInput;
  readonly testing?: ClaimTestingInput;
  readonly runtime?: ClaimRuntimeInput;
  readonly review?: ClaimReviewInput;
  /** 문서/검증/리뷰 중 어느 층에서든 stale가 감지되면 composite stale로 승격 */
  readonly stale?: boolean;
}

export interface VerificationClaimSnapshot {
  readonly claim: VerificationClaim;
  readonly definitionState: DefinitionState;
  readonly implementationState: ImplementationState;
  readonly testState: TestState;
  readonly runtimeState: RuntimeState;
  readonly reviewState: ReviewState;
  readonly compositeState: ClaimCompositeState;
  /** FSM product key — 이후 prefix 축으로 투영 가능한 최소 표현 */
  readonly stateKey: string;
  /** 아직 필요한 바인딩/증거 */
  readonly missing: readonly string[];
  /** 명시적 모순 또는 차단 사유 */
  readonly blockers: readonly string[];
}

export function deriveDefinitionState(input?: ClaimDefinitionInput): DefinitionState {
  if (!input?.declared) return "missing";
  if (input.linked) return "linked";
  if (input.structured) return "structured";
  return "declared";
}

export function deriveImplementationState(input?: ClaimImplementationInput): ImplementationState {
  const bindings = input?.bindings ?? [];
  const implemented = input?.implementedBindings ?? [];

  if (bindings.length === 0 && implemented.length === 0) return "none";
  if (implemented.length === 0) return "partial";
  if (implemented.length < bindings.length) return "partial";
  return "implemented";
}

export function deriveTestState(input?: ClaimTestingInput): TestState {
  const bindings = input?.bindings ?? [];
  const evidences = input?.evidences ?? [];

  if (evidences.some((e) => e.status === "fail")) return "failing";
  if (evidences.some((e) => e.status === "pass")) return "passing";
  if (bindings.length > 0) return "mapped";
  return "none";
}

export function deriveRuntimeState(input?: ClaimRuntimeInput): RuntimeState {
  if (input?.observed) return "observed";
  if (input?.observable) return "observable";
  return "none";
}

export function deriveReviewState(input?: ClaimReviewInput): ReviewState {
  if (input?.accepted) return "accepted";
  if (input?.reviewed) return "reviewed";
  return "none";
}

export function buildClaimStateKey(snapshot: {
  definitionState: DefinitionState;
  implementationState: ImplementationState;
  testState: TestState;
  runtimeState: RuntimeState;
  reviewState: ReviewState;
}): string {
  return [
    snapshot.definitionState,
    snapshot.implementationState,
    snapshot.testState,
    snapshot.runtimeState,
    snapshot.reviewState,
  ].join("/");
}

export function deriveVerificationClaim(
  input: VerificationClaimInput,
): VerificationClaimSnapshot {
  const definitionState = deriveDefinitionState(input.definition);
  const implementationState = deriveImplementationState(input.implementation);
  const testState = deriveTestState(input.testing);
  const runtimeState = deriveRuntimeState(input.runtime);
  const reviewState = deriveReviewState(input.review);

  const blockers: string[] = [];
  if (definitionState === "missing") blockers.push("claim 문서 정의 없음");
  if (testState === "failing") blockers.push("실패한 검증 증거 존재");

  const missing: string[] = [];
  if (definitionState !== "linked") missing.push("문서 링크 정합성");
  if (implementationState === "none") missing.push("구현 바인딩");
  if (testState === "none") missing.push("테스트 매핑");
  if (runtimeState === "none") missing.push("런타임 관측 바인딩");
  if (reviewState !== "accepted") missing.push("리뷰 승인");

  const compositeState = deriveCompositeState({
    definitionState,
    implementationState,
    testState,
    runtimeState,
    reviewState,
    stale: input.stale === true || input.definition?.stale === true,
  });

  return {
    claim: input.claim,
    definitionState,
    implementationState,
    testState,
    runtimeState,
    reviewState,
    compositeState,
    stateKey: buildClaimStateKey({
      definitionState,
      implementationState,
      testState,
      runtimeState,
      reviewState,
    }),
    missing,
    blockers,
  };
}

function deriveCompositeState(input: {
  definitionState: DefinitionState;
  implementationState: ImplementationState;
  testState: TestState;
  runtimeState: RuntimeState;
  reviewState: ReviewState;
  stale: boolean;
}): ClaimCompositeState {
  if (input.stale) return "stale";
  if (input.definitionState === "missing") return "absent";
  if (input.testState === "failing") return "contradicted";

  const isBound =
    input.implementationState !== "none"
    || input.testState !== "none"
    || input.runtimeState !== "none"
    || input.reviewState !== "none";

  const isExercised =
    input.testState === "passing"
    || input.runtimeState === "observed";

  const isVerified =
    input.definitionState === "linked"
    && input.implementationState === "implemented"
    && isExercised
    && input.reviewState === "accepted";

  if (isVerified) return "verified";
  if (isExercised) return "exercised";
  if (isBound) return "bound";
  return "declared";
}
