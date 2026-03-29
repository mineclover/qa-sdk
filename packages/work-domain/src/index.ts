/**
 * work-domain — 작업 도메인 분류 체계
 *
 * Ralph TUI Atomic Story Master Guide v2.1 기준
 * 10 대분류 + 품질 게이트 자동 매핑 + definition-catalog 브릿지
 */

// 타입
export type {
  WorkDomainId,
  SubDomain,
  QualityGate,
  QualityGateSpec,
  WorkDomainDef,
  ClassificationResult,
} from "./types.js";

// 게이트 유형 택소노미
export type { GateScope, GateKindId, GateKindDef } from "./gate-kind.js";
export {
  GATE_KINDS,
  ALL_GATE_KIND_IDS,
  getGateKindDef,
  getGateKindsByScope,
  countByScope,
} from "./gate-kind.js";

// 하네스 상태 모델
export type {
  HarnessStateId,
  HarnessDocRole,
  HarnessStateDef,
  HarnessBundleDoc,
  HarnessStateSnapshot,
} from "./harness-model.js";
export {
  HARNESS_STATES,
  getHarnessStateDef,
  classifyHarnessDocRole,
  deriveHarnessState,
} from "./harness-model.js";

// 하네스 런타임 (게이트 실행 상태 머신)
export type {
  GateState,
  GateEvent,
  BundleState,
  DocNode,
  DocLink,
  DocGraphPort,
  GateRequirement,
  HarnessPlan,
  GateInstance,
  HarnessInstance,
} from "./harness.js";
export {
  transitionGate,
  deriveBundleState,
  isContractDoc,
  deriveGateKinds,
  buildHarnessPlan,
  createHarnessInstance,
  applyGateEvent,
  nextReadyGates,
} from "./harness.js";

// 레지스트리
export { WORK_DOMAINS, ALL_DOMAIN_IDS, getDomainDef, getSubDomain } from "./registry.js";

// 품질 게이트
export { resolveQualityGates, gatesToCriteria, mergeQualityGates } from "./quality-gates.js";

// definition-catalog 매핑
export type { ScopeMapping, DocQueryParams, DefScope, DefLayer, ConcernTag, TierTag } from "./mapping.js";
export { DOMAIN_TO_DEF_MAP, buildDocQuery, suggestDomainFromArtifact } from "./mapping.js";

// 자동 분류
export { classifyUserStory, classifyStories } from "./classify.js";
