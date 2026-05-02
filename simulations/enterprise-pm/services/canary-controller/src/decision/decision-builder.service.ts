// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §1 결정 객체 SafetyDecision/ResourceDecision interface 그대로.
// Plan A grammar #7/#8/#14/#15 (decision-id/cycle-id/decision-category/decision-signal)로 식별자 합성.
// audit-recorder write는 (cycleId, pass) 복합 키 idempotent — idempotency-key 헤더 + 409 무시.

import { Injectable } from "@nestjs/common";
import {
  buildDecisionId,
  buildCycleId,
  buildDecisionCategory,
} from "sim-identifier-grammar";
import type { CategoryVerdicts } from "../verdict/category-verdict.service.js";
import type { SafetyDecisionOutput } from "./safety-decision.service.js";
import type { ResourceDecisionOutput } from "./resource-decision.service.js";
import type {
  SourceStatus,
  SignalSample,
} from "../metrics/metrics-scrape.service.js";
import { createLogger } from "../lib/logger.js";

export interface BuilderConfig {
  controllerId: string;
  auditUrl: string;
}

export interface Evidence {
  kind: "data" | "rule";
  source: string;
  content: unknown;
  weight: number;
}

export interface SafetyDecisionRecord {
  decisionId: string;
  cycleId: string;
  cycleAt: string;
  pass: "safety";
  verdict: SafetyDecisionOutput["verdict"];
  categoryVerdicts: Pick<
    CategoryVerdicts,
    "perf" | "compatibility" | "decisionQuality" | "auditSafety" | "replicationHealth"
  >;
  triggerCategory?: SafetyDecisionOutput["triggerCategory"];
  triggerSignals: string[];
  evidence: Evidence[];
  confidence: number;
  action?: SafetyDecisionOutput["action"];
}

export interface ResourceDecisionRecord {
  decisionId: string;
  cycleId: string;
  cycleAt: string;
  pass: "resource";
  verdict: ResourceDecisionOutput["verdict"];
  categoryVerdicts: Pick<
    CategoryVerdicts,
    "loadPressure" | "resourceHeadroom" | "stability"
  >;
  rejectedBy?: ResourceDecisionOutput["rejectedBy"];
  triggerSignals: string[];
  evidence: Evidence[];
  confidence: number;
  action?: ResourceDecisionOutput["action"];
}

const SAFETY_NAMES = [
  "perf",
  "compatibility",
  "decisionQuality",
  "auditSafety",
  "replicationHealth",
] as const;
const RESOURCE_NAMES = [
  "loadPressure",
  "resourceHeadroom",
  "stability",
] as const;

@Injectable()
export class DecisionBuilderService {
  private readonly logger = createLogger("sim-canary-controller:builder");

  constructor(private readonly cfg: BuilderConfig) {}

  newCycleId(cycleAt: number): string {
    return buildCycleId({ controllerId: this.cfg.controllerId, cycleAt });
  }

  buildSafety(input: {
    cycleId?: string;
    cycleAt: number;
    verdicts: CategoryVerdicts;
    decision: SafetyDecisionOutput;
    sources: SourceStatus[];
    signals: Record<string, SignalSample>;
    confidence: number;
  }): SafetyDecisionRecord {
    const cycleId = input.cycleId ?? this.newCycleId(input.cycleAt);
    // grammar #14: 카테고리 어휘 점검 (build 시점 차단).
    for (const name of SAFETY_NAMES) {
      buildDecisionCategory({ pass: "safety", name });
    }
    const v = input.verdicts;
    return {
      decisionId: buildDecisionId({ pass: "safety", cycleId }),
      cycleId,
      cycleAt: new Date(input.cycleAt).toISOString(),
      pass: "safety",
      verdict: input.decision.verdict,
      categoryVerdicts: {
        perf: v.perf,
        compatibility: v.compatibility,
        decisionQuality: v.decisionQuality,
        auditSafety: v.auditSafety,
        replicationHealth: v.replicationHealth,
      },
      triggerCategory: input.decision.triggerCategory,
      triggerSignals: input.decision.triggerSignals,
      evidence: this.evidenceFrom(input.sources, input.signals),
      confidence: input.confidence,
      action: input.decision.action,
    };
  }

  buildResource(input: {
    cycleId: string;
    cycleAt: number;
    verdicts: CategoryVerdicts;
    decision: ResourceDecisionOutput;
    sources: SourceStatus[];
    signals: Record<string, SignalSample>;
    confidence: number;
  }): ResourceDecisionRecord {
    for (const name of RESOURCE_NAMES) {
      buildDecisionCategory({ pass: "resource", name });
    }
    const v = input.verdicts;
    return {
      decisionId: buildDecisionId({
        pass: "resource",
        cycleId: input.cycleId,
      }),
      cycleId: input.cycleId,
      cycleAt: new Date(input.cycleAt).toISOString(),
      pass: "resource",
      verdict: input.decision.verdict,
      categoryVerdicts: {
        loadPressure: v.loadPressure,
        resourceHeadroom: v.resourceHeadroom,
        stability: v.stability,
      },
      rejectedBy: input.decision.rejectedBy,
      triggerSignals: v.triggerSignals,
      evidence: this.evidenceFrom(input.sources, input.signals),
      confidence: input.confidence,
      action: input.decision.action,
    };
  }

  private evidenceFrom(
    sources: SourceStatus[],
    signals: Record<string, SignalSample>,
  ): Evidence[] {
    return [
      ...sources.map(
        (s) =>
          ({
            kind: "data" as const,
            source: `metrics:${s.name}`,
            content: { ok: s.ok },
            weight: s.weight,
          }) as Evidence,
      ),
      ...Object.entries(signals).map(
        ([id, s]) =>
          ({
            kind: "data" as const,
            source: `signal:${s.sourceName}`,
            content: { signal: id, value: s.value },
            weight: 1,
          }) as Evidence,
      ),
    ];
  }

  /** spec 01 §6: (cycleId, pass) 복합 키 멱등 write. 409 → 이미 적재됨(무시). */
  async write(
    record: SafetyDecisionRecord | ResourceDecisionRecord,
  ): Promise<void> {
    const res = await fetch(`${this.cfg.auditUrl}/v1/decisions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `${record.cycleId}:${record.pass}`,
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok && res.status !== 409) {
      this.logger.error(
        { status: res.status, decisionId: record.decisionId },
        "audit write failed",
      );
      throw new Error(`audit-recorder write failed: ${res.status}`);
    }
  }
}
