import type { EntryIR, Lifecycle } from "taxonomy-engine";
import type { DecisionFile, DecisionEvidence } from "./decision-file.js";

export type ConflictResolution = "accept-yaml" | "accept-decision" | "merge";

export type SyncOptions = {
  /** 충돌 시 해소 방식. 누락 시 "conflict" 액션 반환 (호출자가 interactive prompt). */
  conflict?: ConflictResolution;
};

export type SyncAction =
  | {
      kind: "noop";
      reason:
        | "no-decision-link"
        | "lifecycle-missing"
        | "in-sync"
        | "in-sync-tbd-draft"
        | "markers-only";
    }
  | {
      kind: "push-create";
      subject: string;
      question: string;
      initialLifecycle: Lifecycle;
    }
  | {
      kind: "pull-yaml-lifecycle";
      newLifecycle: Lifecycle;
      evidence: DecisionEvidence[];
    }
  | {
      kind: "pull-decision-lifecycle";
      newLifecycle: Lifecycle;
    }
  | {
      kind: "conflict";
      yaml: { lifecycle: Lifecycle };
      decision: { lifecycle: Lifecycle; evidenceCount: number };
    };

/**
 * yaml entry와 decision 파일 상태를 비교하여 sync 액션 결정.
 *
 * 입력:
 * - yamlEntry: yaml의 entry IR (lifecycle/placeholderReason/decisionLink 포함)
 * - subject: 좌표 식별자 (tax:slug.axis.entry) — push-create 시 decision.subject로 들어감
 * - decisionFile: 존재하면 비교, 없으면 push-create 후보
 * - state: 직전 sync 이후 yaml/decision 양쪽이 모두 변경됐는지 호출자가 판단 (충돌 검출용).
 *   기본: 변경 여부 모름 → 단순 lifecycle 비교만.
 *
 * 의미 규칙:
 * - yaml `lifecycle: tbd` + decision `lifecycle: draft` 조합은 in-sync (양쪽 모두 "결정 시작 전").
 *   yaml의 tbd는 사용자 의도("결정 시작 안 함")를 보존하기 위한 명시적 표시이므로,
 *   skeleton 생성 직후 yaml을 draft로 끌어올리지 않는다.
 *   상세: docs/proposals/taxonomy-engine/concepts/decision-sync.md
 * - decision 파일에 lifecycle 변경 없이 markers(evidence/option/outcome)만 변경된 경우는
 *   "markers-only" noop 처리. decision SSOT 유지가 자연스러우므로 yaml에 영향 없음.
 *   호출자(CLI)는 이 액션을 보고 commit 없이 사용자에게 표시만 한다.
 */
export function computeSyncAction(
  yamlEntry: EntryIR,
  subject: string,
  decisionFile: DecisionFile | undefined,
  state: {
    yamlChanged?: boolean;
    decisionChanged?: boolean;
    previousDecision?: DecisionFile;
  } = {},
  options: SyncOptions = {},
): SyncAction {
  if (!yamlEntry.decisionLink) {
    return { kind: "noop", reason: "no-decision-link" };
  }
  if (yamlEntry.lifecycle === undefined) {
    return { kind: "noop", reason: "lifecycle-missing" };
  }

  // decision 파일 없음 → push-create
  if (!decisionFile) {
    return {
      kind: "push-create",
      subject,
      question: yamlEntry.placeholderReason ?? "(질문 미정)",
      initialLifecycle: "draft",
    };
  }

  const yamlLc = yamlEntry.lifecycle;
  const decisionLc = decisionFile.meta.lifecycle;

  // 부채 #1: yaml tbd + decision draft → "결정 시작 전" 동일 상태로 간주.
  // 사용자가 yaml에 박은 tbd 표시는 의도적이므로 보존.
  if (yamlLc === "tbd" && decisionLc === "draft") {
    // markers 변경 여부도 같이 검토 (부채 #8) — draft 상태에서도 evidence 수집은 진행될 수 있음
    if (markersChanged(decisionFile, state.previousDecision)) {
      return { kind: "noop", reason: "markers-only" };
    }
    return { kind: "noop", reason: "in-sync-tbd-draft" };
  }

  if (yamlLc === decisionLc) {
    // 부채 #8: lifecycle 동일하지만 markers만 변경된 경우 별도 보고.
    if (markersChanged(decisionFile, state.previousDecision)) {
      return { kind: "noop", reason: "markers-only" };
    }
    return { kind: "noop", reason: "in-sync" };
  }

  // 양쪽 모두 변경 → 충돌
  if (state.yamlChanged && state.decisionChanged) {
    if (!options.conflict) {
      return {
        kind: "conflict",
        yaml: { lifecycle: yamlLc },
        decision: {
          lifecycle: decisionLc,
          evidenceCount: decisionFile.markers.evidence.length,
        },
      };
    }
    if (options.conflict === "accept-yaml") {
      return {
        kind: "pull-decision-lifecycle",
        newLifecycle: yamlLc,
      };
    }
    if (options.conflict === "accept-decision") {
      return {
        kind: "pull-yaml-lifecycle",
        newLifecycle: decisionLc,
        evidence: decisionFile.markers.evidence,
      };
    }
    // merge: yaml lifecycle 우선 + decision evidence 보존 → yaml 갱신
    return {
      kind: "pull-yaml-lifecycle",
      newLifecycle: yamlLc,
      evidence: decisionFile.markers.evidence,
    };
  }

  // yaml만 변경 (decision 변경 없음) → decision에 반영
  if (state.yamlChanged && !state.decisionChanged) {
    return {
      kind: "pull-decision-lifecycle",
      newLifecycle: yamlLc,
    };
  }

  // decision만 변경 또는 변경 정보 모름 → yaml에 반영 (단순 lifecycle 비교 폴백)
  return {
    kind: "pull-yaml-lifecycle",
    newLifecycle: decisionLc,
    evidence: decisionFile.markers.evidence,
  };
}

/**
 * decision 파일의 markers(evidence/option/outcome 등)가 직전 상태 대비 변경됐는지 판단.
 * previousDecision이 없으면 비교 불가 → false 반환 (보수적).
 */
function markersChanged(
  current: DecisionFile,
  previous: DecisionFile | undefined,
): boolean {
  if (!previous) return false;
  const cur = current.markers;
  const prev = previous.markers;
  if (cur.purpose !== prev.purpose) return true;
  if (cur.context !== prev.context) return true;
  if (cur.outcome !== prev.outcome) return true;
  if (cur.options.length !== prev.options.length) return true;
  if (cur.evidence.length !== prev.evidence.length) return true;
  for (let i = 0; i < cur.options.length; i++) {
    const a = cur.options[i];
    const b = prev.options[i];
    if (a.id !== b.id || a.body !== b.body) return true;
  }
  for (let i = 0; i < cur.evidence.length; i++) {
    const a = cur.evidence[i];
    const b = prev.evidence[i];
    if (a.kind !== b.kind || a.weight !== b.weight || a.text !== b.text) {
      return true;
    }
  }
  return false;
}
