/**
 * Decision-Flow 연결 브릿지
 *
 * decision-flow의 산출(outcome)을 definition-catalog의 좌표로 매핑한다.
 * 단방향: definition-catalog → decision-flow 타입 참조.
 *
 * 3가지 매핑:
 * 1. artifactType → DefScope (NarrativeOutcome의 산출 유형 → 정의 대분류)
 * 2. DecisionVerdict → DefLifecycle (결정 판정 → 문서 생명주기)
 * 3. DefinitionEntry → address_context (문서 좌표 → 수집 파이프라인)
 */

import type { DefScope, DefLifecycle, DefinitionEntry } from "./types.js";

// ─── artifactType → DefScope 매핑 ────────────────────────

/**
 * decision-flow NarrativeOutcome.artifactType에서 DefScope를 추론한다.
 *
 * artifactType은 자유 문자열이므로 알려진 값만 매핑하고
 * 알 수 없는 값은 undefined를 반환한다.
 */
const ARTIFACT_SCOPE_MAP: Record<string, DefScope> = {
  // ui
  "layout": "ui",
  "component": "ui",
  "page": "ui",
  "screen": "ui",
  "widget": "ui",

  // feature
  "module": "feature",
  "package": "feature",
  "service": "feature",

  // flow
  "plan": "flow",
  "flow": "flow",
  "pipeline": "flow",
  "workflow": "flow",
  "scenario": "flow",

  // state
  "state": "state",
  "model": "state",
  "entity": "state",

  // constraint
  "config": "constraint",
  "config-change": "constraint",
  "policy": "constraint",
  "rule": "constraint",

  // data
  "schema": "data",
  "axis": "data",
  "prefix": "data",
  "table": "data",
  "migration": "data",

  // interface
  "api": "interface",
  "endpoint": "interface",
  "cli": "interface",
  "command": "interface",
  "event-schema": "interface",
  "message": "interface",
  "contract": "interface",
};

/**
 * NarrativeOutcome.artifactType에서 DefScope를 추론한다.
 *
 * @returns DefScope 또는 undefined (매핑 불가 시)
 */
export function suggestScopeFromArtifact(artifactType: string): DefScope | undefined {
  return ARTIFACT_SCOPE_MAP[artifactType];
}

// ─── DecisionVerdict → DefLifecycle 매핑 ─────────────────

/** decision-flow DecisionVerdict 타입 (의존 없이 자체 정의) */
type DecisionVerdict = "success" | "failure" | "deferred" | "superseded";

/**
 * 결정 판정(verdict)에서 문서 생명주기를 제안한다.
 *
 * - success → approved (결정이 성공했으므로 관련 문서도 승인 상태)
 * - failure → deprecated (결정이 실패했으므로 관련 문서는 폐기 후보)
 * - deferred → draft (결정이 보류되었으므로 문서는 아직 초안)
 * - superseded → archived (결정이 대체되었으므로 문서는 보관)
 */
export function suggestLifecycleFromVerdict(verdict: DecisionVerdict): DefLifecycle {
  switch (verdict) {
    case "success": return "approved";
    case "failure": return "deprecated";
    case "deferred": return "draft";
    case "superseded": return "archived";
  }
}

// ─── address_context 빌더 ────────────────────────────────

/**
 * DefinitionEntry에서 address_context를 생성한다.
 *
 * 수집 파이프라인(ingest)에 연결할 때 사용한다.
 * 직렬화된 좌표가 없으면 빈 객체를 반환한다.
 */
export function buildDefinitionContext(entry: DefinitionEntry): Record<string, string> {
  if (!entry.serialized) return {};
  return { def_document: entry.serialized };
}
