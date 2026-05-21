import type { EntryIR, Lifecycle } from "taxonomy-engine";
import type { DecisionFile, DecisionEvidence } from "./decision-file.js";

export type ConflictResolution = "accept-yaml" | "accept-decision" | "merge";

export type SyncOptions = {
  /** 충돌 시 해소 방식. 누락 시 "conflict" 액션 반환 (호출자가 interactive prompt). */
  conflict?: ConflictResolution;
};

export type SyncAction =
  | { kind: "noop"; reason: "no-decision-link" | "lifecycle-missing" | "in-sync" }
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
 */
export function computeSyncAction(
  yamlEntry: EntryIR,
  subject: string,
  decisionFile: DecisionFile | undefined,
  state: { yamlChanged?: boolean; decisionChanged?: boolean } = {},
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

  if (yamlLc === decisionLc) {
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

  // decision만 변경 (yaml 변경 없음) → yaml에 반영
  // (state 정보 없으면 같은 경로로 처리 — 단순 lifecycle 비교)
  if (state.decisionChanged || !state.yamlChanged) {
    return {
      kind: "pull-yaml-lifecycle",
      newLifecycle: decisionLc,
      evidence: decisionFile.markers.evidence,
    };
  }

  // yaml만 변경 → decision에 반영
  return {
    kind: "pull-decision-lifecycle",
    newLifecycle: yamlLc,
  };
}
