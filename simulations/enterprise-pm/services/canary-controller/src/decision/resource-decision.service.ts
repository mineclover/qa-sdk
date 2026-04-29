// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §4 Pass 2 (Resource) 의사 코드 1:1.
//
// Pass 1이 promote/stable 아니면 SKIP (스케줄러 가드 — Task 9.12).
//
// 분기 순서:
//   stability=WARN → hold
//   load=FAIL & headroom=FAIL → rejected (rejectedBy=resourceHeadroom + alert)
//   load=FAIL & headroom!=FAIL → scale-up (canary 5/25/50 → v2 우선; weight=100/0 → v1)
//   load=PASS & replicas>min & cooldownDown 경과 → scale-down (v1 우선)
//   else hold
//
// cooldown 비대칭: up 60s / down 180s.

import { Injectable } from "@nestjs/common";
import type { CategoryVerdicts } from "../verdict/category-verdict.service.js";

export interface ResourceConfig {
  cooldownUpMs: number;
  cooldownDownMs: number;
  minReplicasV1: number;
  minReplicasV2: number;
}

export type ResourceVerdict = "scale-up" | "scale-down" | "hold" | "rejected";

export interface ResourceDecisionInput {
  verdicts: CategoryVerdicts;
  currentWeight: number;
  current: { v1: number; v2: number };
  timeSinceLastChangeMs: number;
  confidence: number;
}

export interface ResourceDecisionOutput {
  verdict: ResourceVerdict;
  rejectedBy?: "resourceHeadroom" | "stability";
  alert?: boolean;
  action:
    | { kind: "scale"; target: { v1: number; v2: number }; reason: string }
    | { kind: "noop" };
}

@Injectable()
export class ResourceDecisionService {
  constructor(private readonly cfg: ResourceConfig) {}

  decide(input: ResourceDecisionInput): ResourceDecisionOutput {
    const { verdicts: v, currentWeight, current, timeSinceLastChangeMs } =
      input;

    if (v.stability === "WARN") {
      return { verdict: "hold", action: { kind: "noop" } };
    }

    if (v.loadPressure === "FAIL" && v.resourceHeadroom === "FAIL") {
      return {
        verdict: "rejected",
        rejectedBy: "resourceHeadroom",
        alert: true,
        action: { kind: "noop" },
      };
    }

    if (v.loadPressure === "FAIL" && v.resourceHeadroom !== "FAIL") {
      const inCanary =
        currentWeight === 5 || currentWeight === 25 || currentWeight === 50;
      const target = inCanary
        ? { v1: current.v1, v2: current.v2 + 1 }
        : { v1: current.v1 + 1, v2: current.v2 };
      const reason = inCanary
        ? "canary in progress: scale v2"
        : `weight=${currentWeight}: scale v1`;
      return {
        verdict: "scale-up",
        action: { kind: "scale", target, reason },
      };
    }

    const totalReplicas = current.v1 + current.v2;
    const minReplicas = this.cfg.minReplicasV1 + this.cfg.minReplicasV2;
    if (
      v.loadPressure === "PASS" &&
      totalReplicas > minReplicas &&
      timeSinceLastChangeMs >= this.cfg.cooldownDownMs
    ) {
      const canDecV1 = current.v1 > this.cfg.minReplicasV1;
      const canDecV2 = current.v2 > this.cfg.minReplicasV2;
      if (!canDecV1 && !canDecV2) {
        return { verdict: "hold", action: { kind: "noop" } };
      }
      const target = canDecV1
        ? { v1: current.v1 - 1, v2: current.v2 }
        : { v1: current.v1, v2: current.v2 - 1 };
      return {
        verdict: "scale-down",
        action: {
          kind: "scale",
          target,
          reason: "load PASS + cooldown elapsed",
        },
      };
    }

    return { verdict: "hold", action: { kind: "noop" } };
  }
}
