// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §3 Pass 1 (Safety) 의사 코드 1:1.
//
// 우선순위 = 분기 순서:
//   1) Hard rollback — hardFail 비어있지 않음.
//   2) Soft rollback — windowCycles 중 failQuorum 이상 FAIL.
//   3) Hold — confidence 미달 OR any WARN.
//   4) Promote — 모두 PASS + dwellTime 경과.
//   else hold.
//
// weight sequence는 단방향 (5 → 25 → 50 → 100). 100 도달 시 promote 유지(catalog 승격은 02-canary-topology 별도).

import { Injectable } from "@nestjs/common";
import type {
  CategoryVerdicts,
  Verdict,
} from "../verdict/category-verdict.service.js";

export interface SafetyConfig {
  weightSequence: number[];
  dwellMs: number;
  confidenceHold: number;
  windowCycles: number;
  failQuorum: number;
}

export type SafetyVerdict = "promote" | "hold" | "rollback";
export type WeightStep = 0 | 5 | 25 | 50 | 100;
export type TriggerCategory = keyof Pick<
  CategoryVerdicts,
  "perf" | "compatibility" | "decisionQuality" | "auditSafety" | "replicationHealth"
>;

export interface SafetyDecisionInput {
  verdicts: CategoryVerdicts;
  confidence: number;
  currentWeight: number;
  /** 최근 사이클의 FAIL 여부 boolean 배열 (가장 오래된 → 최신). */
  history: boolean[];
  timeSincePromotionMs: number;
}

export interface SafetyDecisionOutput {
  verdict: SafetyVerdict;
  triggerCategory?: TriggerCategory;
  triggerSignals: string[];
  action:
    | { kind: "weight-update"; weight: WeightStep; revision: number }
    | { kind: "noop" };
}

let revisionCounter = 0;
const nextRevision = () => ++revisionCounter;

const SAFETY_CATS = [
  "perf",
  "compatibility",
  "decisionQuality",
  "auditSafety",
  "replicationHealth",
] as const;

const FAIL_CATS = [
  "perf",
  "decisionQuality",
  "replicationHealth",
  "loadPressure",
  "resourceHeadroom",
] as const;

@Injectable()
export class SafetyDecisionService {
  constructor(private readonly cfg: SafetyConfig) {}

  decide(input: SafetyDecisionInput): SafetyDecisionOutput {
    const {
      verdicts: v,
      confidence,
      currentWeight,
      history,
      timeSincePromotionMs,
    } = input;
    const rollbackAction = {
      kind: "weight-update" as const,
      weight: 0 as WeightStep,
      revision: nextRevision(),
    };

    // 1) Hard rollback first — spec 01 §3
    if (v.hardFail.length > 0) {
      return {
        verdict: "rollback",
        triggerCategory: v.hardFail[0] as TriggerCategory,
        triggerSignals: v.triggerSignals,
        action: { ...rollbackAction },
      };
    }

    // 2) Soft rollback — windowCycles 중 failQuorum 이상 FAIL (현재 사이클 포함).
    const anyFailNow = FAIL_CATS.some((k) => v[k] === "FAIL");
    const windowFails =
      history.slice(-this.cfg.windowCycles).filter(Boolean).length +
      (anyFailNow ? 1 : 0);
    if (windowFails >= this.cfg.failQuorum) {
      const tc: TriggerCategory | undefined =
        v.perf === "FAIL"
          ? "perf"
          : v.decisionQuality === "FAIL"
            ? "decisionQuality"
            : v.replicationHealth === "FAIL"
              ? "replicationHealth"
              : undefined;
      return {
        verdict: "rollback",
        triggerCategory: tc,
        triggerSignals: v.triggerSignals,
        action: { ...rollbackAction },
      };
    }

    // 3) Hold — confidence 미달 OR any WARN.
    const anyWarn = (SAFETY_CATS as readonly TriggerCategory[]).some(
      (k) => (v[k] as Verdict) === "WARN",
    );
    if (confidence < this.cfg.confidenceHold || anyWarn) {
      return {
        verdict: "hold",
        triggerSignals: v.triggerSignals,
        action: { kind: "noop" },
      };
    }

    // 4) Promote — 모두 PASS + dwellTime.
    const allPass = (SAFETY_CATS as readonly TriggerCategory[]).every(
      (k) => (v[k] as Verdict) === "PASS",
    );
    if (allPass && timeSincePromotionMs >= this.cfg.dwellMs) {
      const seq = this.cfg.weightSequence;
      const idx = seq.indexOf(currentWeight);
      const next = (
        idx === -1
          ? seq[0]
          : idx === seq.length - 1
            ? seq[idx]
            : seq[idx + 1]
      ) as WeightStep;
      return {
        verdict: "promote",
        triggerSignals: [],
        action: {
          kind: "weight-update",
          weight: next,
          revision: nextRevision(),
        },
      };
    }

    return {
      verdict: "hold",
      triggerSignals: v.triggerSignals,
      action: { kind: "noop" },
    };
  }
}
