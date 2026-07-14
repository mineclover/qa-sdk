// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// controller-config.yaml 을 부팅 시 1회 파싱 → verdict / safety / resource / builder 서비스 wire.
// spec 2026-05-02 §8 — CategoryVerdictService 의 evaluate(scrape) 결과 perf 필드를
//                       PerfWarnFault.applyTo 로 wrap (enabled 시 PASS → WARN 격상,
//                       FAIL/WARN 보존).

import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  CategoryVerdictService,
  type VerdictConfig,
  type CategoryVerdicts,
} from '../verdict/category-verdict.service.js';
import { SafetyDecisionService, type SafetyConfig } from './safety-decision.service.js';
import { ResourceDecisionService, type ResourceConfig } from './resource-decision.service.js';
import { DecisionBuilderService } from './decision-builder.service.js';
import { PerfWarnFault } from '../fault/perf-warn.js';
import { FaultModule } from '../fault/fault.module.js';
import type { ScrapeResult } from '../metrics/metrics-scrape.service.js';
import { env } from '../config/env.js';

/**
 * spec §8 perf-warn — CategoryVerdictService 결과 perf 필드를 wrap.
 * fault disabled → passthrough. enabled → PASS → WARN, FAIL 보존, WARN 그대로.
 */
class PerfWarnAwareVerdictService extends CategoryVerdictService {
  constructor(
    cfg: VerdictConfig,
    private readonly perfWarn: PerfWarnFault,
  ) {
    super(cfg);
  }
  override evaluate(scrape: ScrapeResult): CategoryVerdicts {
    const result = super.evaluate(scrape);
    result.perf = this.perfWarn.applyTo(result.perf);
    return result;
  }
}

interface ControllerConfigYaml {
  perf: VerdictConfig['perf'];
  decisionQuality: VerdictConfig['decisionQuality'];
  replicationHealth: VerdictConfig['replicationHealth'];
  window: { rollingCycles: number; failQuorum: number };
  dwell: { promotionMs: number };
  confidence: { holdThreshold: number };
  weightSequence: number[];
}

function loadConfig(): ControllerConfigYaml {
  const raw = readFileSync(env.SIM_CONTROLLER_CONFIG_PATH, 'utf-8');
  return parseYaml(raw) as ControllerConfigYaml;
}

@Module({
  imports: [FaultModule],
  providers: [
    {
      provide: CategoryVerdictService,
      useFactory: (perfWarn: PerfWarnFault) => {
        const cfg = loadConfig();
        const verdictCfg: VerdictConfig = {
          perf: cfg.perf,
          decisionQuality: cfg.decisionQuality,
          replicationHealth: cfg.replicationHealth,
          baselines: {
            // perf.errorRate baseline은 spec 01 §2 (production observed). dev 환경에서는
            // 0.01 fallback (테스트 케이스에서 검증된 임계와 일치).
            errorRate: 0.01,
            RPS: env.SIM_LOAD_RPS_THRESHOLD,
            CPU: env.SIM_CPU_HIGH_PCT,
            dbPoolUtilization: env.SIM_DB_POOL_HIGH_PCT / 100,
            cooldownUpMs: env.SIM_SCALE_COOLDOWN_UP_MS,
          },
        };
        return new PerfWarnAwareVerdictService(verdictCfg, perfWarn);
      },
      inject: [PerfWarnFault],
    },
    {
      provide: SafetyDecisionService,
      useFactory: () => {
        const cfg = loadConfig();
        // env.SIM_CONTROLLER_DWELL_MS 가 설정되면 yaml 보다 우선 — sim 환경에서
        // 사이클 시간 단축에 비례하여 dwellMs 도 단축 (production 변경은 yaml).
        const dwellMs = env.SIM_CONTROLLER_DWELL_MS ?? cfg.dwell.promotionMs;
        const safetyCfg: SafetyConfig = {
          weightSequence: cfg.weightSequence,
          dwellMs,
          confidenceHold: cfg.confidence.holdThreshold,
          windowCycles: cfg.window.rollingCycles,
          failQuorum: cfg.window.failQuorum,
        };
        return new SafetyDecisionService(safetyCfg);
      },
    },
    {
      provide: ResourceDecisionService,
      useFactory: () => {
        const resourceCfg: ResourceConfig = {
          cooldownUpMs: env.SIM_SCALE_COOLDOWN_UP_MS,
          cooldownDownMs: env.SIM_SCALE_COOLDOWN_DOWN_MS,
          minReplicasV1: 1,
          minReplicasV2: 0,
        };
        return new ResourceDecisionService(resourceCfg);
      },
    },
    {
      provide: DecisionBuilderService,
      useFactory: () =>
        new DecisionBuilderService({
          controllerId: env.SIM_CONTROLLER_ID,
          auditUrl: env.SIM_AUDIT_RECORDER_URL,
        }),
    },
  ],
  exports: [
    CategoryVerdictService,
    SafetyDecisionService,
    ResourceDecisionService,
    DecisionBuilderService,
  ],
})
export class DecisionModule {}
