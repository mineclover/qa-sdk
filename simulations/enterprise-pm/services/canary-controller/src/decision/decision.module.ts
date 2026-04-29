// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// controller-config.yaml을 부팅 시 1회 파싱 → verdict / safety / resource / builder 서비스 wire.

import { Module } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import {
  CategoryVerdictService,
  type VerdictConfig,
} from "../verdict/category-verdict.service.js";
import {
  SafetyDecisionService,
  type SafetyConfig,
} from "./safety-decision.service.js";
import {
  ResourceDecisionService,
  type ResourceConfig,
} from "./resource-decision.service.js";
import { DecisionBuilderService } from "./decision-builder.service.js";
import { env } from "../config/env.js";

interface ControllerConfigYaml {
  perf: VerdictConfig["perf"];
  decisionQuality: VerdictConfig["decisionQuality"];
  replicationHealth: VerdictConfig["replicationHealth"];
  window: { rollingCycles: number; failQuorum: number };
  dwell: { promotionMs: number };
  confidence: { holdThreshold: number };
  weightSequence: number[];
}

function loadConfig(): ControllerConfigYaml {
  const raw = readFileSync(env.SIM_CONTROLLER_CONFIG_PATH, "utf-8");
  return parseYaml(raw) as ControllerConfigYaml;
}

@Module({
  providers: [
    {
      provide: CategoryVerdictService,
      useFactory: () => {
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
        return new CategoryVerdictService(verdictCfg);
      },
    },
    {
      provide: SafetyDecisionService,
      useFactory: () => {
        const cfg = loadConfig();
        const safetyCfg: SafetyConfig = {
          weightSequence: cfg.weightSequence,
          dwellMs: cfg.dwell.promotionMs,
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
