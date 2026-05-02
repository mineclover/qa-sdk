// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §5 — 30s 사이클 타임라인:
//   t=0   scrape
//   t=1-3 verdict
//   t=3   Pass 1 (safety) write
//   t=4   조건부 Pass 2 (resource) write
//   t=5   action 실행 (gateway routing push + compose scale)
//
// lock 미보유 standby는 read-only(scrape만, write/action SKIP).
// Pass 1 write 실패 → Pass 2 SKIP.
// 다음 사이클은 SIM_CONTROLLER_CYCLE_MS 후.

import { Injectable, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { AdvisoryLockService } from "../lock/advisory-lock.service.js";
import { MetricsScrapeService } from "../metrics/metrics-scrape.service.js";
import { CategoryVerdictService } from "../verdict/category-verdict.service.js";
import { SafetyDecisionService } from "../decision/safety-decision.service.js";
import { ResourceDecisionService } from "../decision/resource-decision.service.js";
import { DecisionBuilderService } from "../decision/decision-builder.service.js";
import { ActionExecutorService } from "../action/action-executor.service.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";
import { env } from "../config/env.js";
import { createLogger } from "../lib/logger.js";

@Injectable()
export class CycleSchedulerService implements OnModuleInit {
  private readonly logger = createLogger("sim-canary-controller:cycle");

  // 사이클 간 영속 상태. spec 01 §5/§6 — 메모리 보유, restart 시 초기화 후 다음 사이클부터 재구축.
  // safety FAIL history는 DecisionRingBuffer SSOT가 보유 (recentSafetyHistory).
  private currentWeight = 0;
  private lastPromotionAt = 0;
  private current = { v1: 1, v2: 0 };
  private lastReplicaChangeAt = 0;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly lock: AdvisoryLockService,
    private readonly scrape: MetricsScrapeService,
    private readonly verdict: CategoryVerdictService,
    private readonly safety: SafetyDecisionService,
    private readonly resource: ResourceDecisionService,
    private readonly builder: DecisionBuilderService,
    private readonly action: ActionExecutorService,
    private readonly ringBuffer: DecisionRingBuffer,
  ) {}

  onModuleInit() {
    const handle = setInterval(
      () => void this.runCycle(),
      env.SIM_CONTROLLER_CYCLE_MS,
    );
    this.registry.addInterval("controller-cycle", handle);
    this.logger.info(
      { cycleMs: env.SIM_CONTROLLER_CYCLE_MS },
      "controller cycle scheduled",
    );
  }

  /**
   * spec 01 §5 timeline 1회 실행. lock → scrape → evaluate → safety write → (조건부) resource write → action.
   * 실패는 모두 catch — 다음 사이클이 같은 결정을 다시 적용 (idempotent).
   */
  async runCycle(): Promise<void> {
    const cycleAt = Date.now();
    try {
      const acquired = await this.lock.tryAcquire();
      const result = await this.scrape.scrape();
      if (!acquired) {
        this.logger.debug({ cycleAt }, "standby — scrape only, skip write/action");
        return;
      }
      const verdicts = this.verdict.evaluate(result);
      const confidence =
        result.sources.reduce((a, s) => a + s.weight, 0) /
        Math.max(result.sources.length, 1);
      const safetyOut = this.safety.decide({
        verdicts,
        confidence,
        currentWeight: this.currentWeight,
        history: this.ringBuffer.recentSafetyHistory(10),
        timeSincePromotionMs: Date.now() - this.lastPromotionAt,
      });
      const cycleId = this.builder.newCycleId(cycleAt);
      const safetyRecord = this.builder.buildSafety({
        cycleId,
        cycleAt,
        verdicts,
        decision: safetyOut,
        sources: result.sources,
        signals: result.signals,
        confidence,
      });
      try {
        await this.builder.write(safetyRecord);
        this.ringBuffer.appendSafety(safetyRecord);
      } catch (err) {
        this.logger.error({ err }, "safety write failed; skipping resource");
        return;
      }

      if (safetyOut.verdict !== "rollback") {
        const resOut = this.resource.decide({
          verdicts,
          currentWeight: this.currentWeight,
          current: this.current,
          timeSinceLastChangeMs: Date.now() - this.lastReplicaChangeAt,
          confidence,
        });
        const resourceRecord = this.builder.buildResource({
          cycleId,
          cycleAt,
          verdicts,
          decision: resOut,
          sources: result.sources,
          signals: result.signals,
          confidence,
        });
        try {
          await this.builder.write(resourceRecord);
          this.ringBuffer.appendResource(resourceRecord);
        } catch (err) {
          this.logger.error({ err }, "resource write failed");
        }
        try {
          await this.action.executeResource(resOut.action, this.current);
        } catch (err) {
          this.logger.error(
            { err },
            "resource action failed (retry next cycle)",
          );
        }
        if (resOut.action.kind === "scale") {
          this.current = resOut.action.target;
          this.lastReplicaChangeAt = Date.now();
        }
      }

      try {
        await this.action.executeSafety(safetyOut.action);
      } catch (err) {
        this.logger.error(
          { err },
          "safety action failed (retry next cycle)",
        );
      }

      if (
        safetyOut.action.kind === "weight-update" &&
        safetyOut.verdict === "promote"
      ) {
        this.currentWeight = safetyOut.action.weight;
        this.lastPromotionAt = Date.now();
      }
    } catch (err) {
      this.logger.error({ err }, "cycle failed; next cycle continues");
    }
  }
}
