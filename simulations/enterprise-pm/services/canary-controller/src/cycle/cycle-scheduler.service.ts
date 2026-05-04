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

import { Inject, Injectable, Optional, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { AdvisoryLockService } from "../lock/advisory-lock.service.js";
import { MetricsScrapeService } from "../metrics/metrics-scrape.service.js";
import { CategoryVerdictService } from "../verdict/category-verdict.service.js";
import { SafetyDecisionService } from "../decision/safety-decision.service.js";
import { ResourceDecisionService } from "../decision/resource-decision.service.js";
import { DecisionBuilderService } from "../decision/decision-builder.service.js";
import { ActionExecutorService } from "../action/action-executor.service.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";
import { HealthyMetricsFault } from "../fault/healthy-metrics.js";
import { SIM_SERVICE_CATALOG_TOKEN } from "../catalog/tokens.js";
import { InMemorySimServiceCatalog } from "../catalog/catalog.provider.js";
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
    // vitest 환경은 emitDecoratorMetadata 를 무시하므로 @Inject 토큰 명시 (Stage 1a 컨벤션).
    @Inject(SchedulerRegistry) private readonly registry: SchedulerRegistry,
    @Inject(AdvisoryLockService) private readonly lock: AdvisoryLockService,
    @Inject(MetricsScrapeService) private readonly scrape: MetricsScrapeService,
    @Inject(CategoryVerdictService)
    private readonly verdict: CategoryVerdictService,
    @Inject(SafetyDecisionService)
    private readonly safety: SafetyDecisionService,
    @Inject(ResourceDecisionService)
    private readonly resource: ResourceDecisionService,
    @Inject(DecisionBuilderService)
    private readonly builder: DecisionBuilderService,
    @Inject(ActionExecutorService)
    private readonly action: ActionExecutorService,
    @Inject(DecisionRingBuffer)
    private readonly ringBuffer: DecisionRingBuffer,
    // 시뮬 happy-path / catalog 전이 의존 — 테스트 backward compat 위해 optional.
    // production AppModule 은 항상 wire (CycleModule 이 FaultModule + CatalogModule import).
    @Optional()
    @Inject(HealthyMetricsFault)
    private readonly healthyMetrics?: HealthyMetricsFault,
    @Optional()
    @Inject(SIM_SERVICE_CATALOG_TOKEN)
    private readonly catalogPort?: InMemorySimServiceCatalog,
  ) {}

  onModuleInit() {
    // 시뮬 부팅 시 healthy-metrics 자동 enable — 외부 metrics 출처 미연결 환경에서
    // controller 가 자연스럽게 promote 시퀀스 진행. fault toggle 은 admin endpoint 로
    // 런타임 변경 가능 (POST /admin/fault/healthy-metrics).
    if (env.SIM_CONTROLLER_HEALTHY_METRICS && this.healthyMetrics) {
      void this.healthyMetrics.enable({});
      this.logger.info(
        {},
        "healthy-metrics fault auto-enabled (SIM_CONTROLLER_HEALTHY_METRICS=true)",
      );
    }
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
          // spec 2026-05-02 §6 + Task 1b.10 — pin 활성화 service 는 compose SKIP + alert.
          await this.action.executeResource(resOut.action, this.current, {
            cycleId,
          });
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
        const targetPrefix = `sim.svc.${env.SIM_CONTROLLER_TARGET_SERVICE}`;
        // weight=100 도달 시 catalog 전이 — 시뮬에서는 candidate 가 미등록 상태일
        // 수 있으므로 (시나리오 9 setup 가정 v4=undeployed 보존) just-in-time 으로
        // SIM_CONTROLLER_CANDIDATE_VERSION 기반 시드 후 즉시 promote (candidate→stable).
        // 운영에서는 SIM_CONTROLLER_CANDIDATE_VERSION 미설정이라 시드 skip — catalog
        // admin 이 사전 등록한 candidate 만 사용.
        if (
          safetyOut.action.weight === 100 &&
          this.catalogPort !== undefined
        ) {
          if (
            !this.catalogPort.hasCandidate(targetPrefix) &&
            typeof env.SIM_CONTROLLER_CANDIDATE_VERSION === "number"
          ) {
            try {
              this.catalogPort.seedCandidate(
                targetPrefix,
                env.SIM_CONTROLLER_CANDIDATE_VERSION,
              );
              this.logger.info(
                {
                  prefix: targetPrefix,
                  version: env.SIM_CONTROLLER_CANDIDATE_VERSION,
                },
                "catalog candidate seeded (sim mode, on weight=100)",
              );
            } catch (err) {
              this.logger.error(
                { err, prefix: targetPrefix },
                "catalog candidate seed failed",
              );
            }
          }
          if (this.catalogPort.hasCandidate(targetPrefix)) {
            try {
              this.catalogPort.promoteCandidate(targetPrefix);
              this.logger.info(
                { prefix: targetPrefix },
                "catalog candidate promoted to stable (weight=100)",
              );
            } catch (err) {
              this.logger.error(
                { err, prefix: targetPrefix },
                "catalog promote failed",
              );
            }
          }
        }
      }
    } catch (err) {
      this.logger.error({ err }, "cycle failed; next cycle continues");
    }
  }
}
