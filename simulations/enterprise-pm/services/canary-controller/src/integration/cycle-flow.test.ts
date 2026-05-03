// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §5 — 사이클 1회 실행 통합 테스트.
// scrape mock(fetch stub) + advisory lock acquired stub으로 사이클 1회 실행,
// audit POST와 gateway POST와 compose exec spy 검증.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SchedulerRegistry } from "@nestjs/schedule";
import { MetricsScrapeService } from "../metrics/metrics-scrape.service.js";
import {
  CategoryVerdictService,
  type VerdictConfig,
} from "../verdict/category-verdict.service.js";
import {
  SafetyDecisionService,
  type SafetyConfig,
} from "../decision/safety-decision.service.js";
import {
  ResourceDecisionService,
  type ResourceConfig,
} from "../decision/resource-decision.service.js";
import { DecisionBuilderService } from "../decision/decision-builder.service.js";
import {
  ActionExecutorService,
  type SimServiceCatalogPort,
  type PortRegistryPort,
} from "../action/action-executor.service.js";
import { CycleSchedulerService } from "../cycle/cycle-scheduler.service.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";
import type { AdvisoryLockService } from "../lock/advisory-lock.service.js";
import type { SafetyDecisionRecordInput } from "sim-decision-view";

const verdictCfg: VerdictConfig = {
  perf: {
    errorRate: { warn: 1.2, fail: 1.5, baselineMultiplier: true },
    p95LatencyDelta: { warn: 0.2, fail: 0.5 },
  },
  decisionQuality: {
    denyRateDelta: { warn: 0.05, fail: 0.15 },
    avgConfidenceDelta: { warn: -0.05, fail: -0.15 },
  },
  replicationHealth: { replicationLagMs: { warn: 500, fail: 2000 } },
  baselines: {
    errorRate: 0.01,
    RPS: 100,
    CPU: 80,
    dbPoolUtilization: 0.8,
    cooldownUpMs: 60_000,
  },
};

const safetyCfg: SafetyConfig = {
  weightSequence: [5, 25, 50, 100],
  dwellMs: 120_000,
  confidenceHold: 0.6,
  windowCycles: 10,
  failQuorum: 3,
};

const resourceCfg: ResourceConfig = {
  cooldownUpMs: 60_000,
  cooldownDownMs: 180_000,
  minReplicasV1: 1,
  minReplicasV2: 0,
};

interface MetricsValues {
  "perf.errorRate"?: number;
  "perf.p95LatencyDelta"?: number;
  "compatibility.schemaCompatRate"?: number;
  "decisionQuality.denyRateDelta"?: number;
  "decisionQuality.avgConfidenceDelta"?: number;
  "auditSafety.criticalAnomalyRate"?: number;
  "replicationHealth.replicationLagMs"?: number;
  "loadPressure.RPS"?: number;
  "loadPressure.p95LatencyDelta"?: number;
  "resourceHeadroom.CPU"?: number;
  "resourceHeadroom.dbPoolUtilization"?: number;
  "stability.timeSinceLastReplicaChange"?: number;
}

const passValues: MetricsValues = {
  "perf.errorRate": 0.005,
  "perf.p95LatencyDelta": 0.05,
  "compatibility.schemaCompatRate": 1.0,
  "decisionQuality.denyRateDelta": 0,
  "decisionQuality.avgConfidenceDelta": 0,
  "auditSafety.criticalAnomalyRate": 0,
  "replicationHealth.replicationLagMs": 100,
  "loadPressure.RPS": 50,
  "loadPressure.p95LatencyDelta": 0.05,
  "resourceHeadroom.CPU": 30,
  "resourceHeadroom.dbPoolUtilization": 0.4,
  "stability.timeSinceLastReplicaChange": 999_999,
};

interface SetupOptions {
  metricsValues?: MetricsValues;
  currentWeight?: number;
  current?: { v1: number; v2: number };
  timeSincePromotionMs?: number;
  timeSinceLastChangeMs?: number;
  history?: boolean[];
}

interface Spies {
  fetchSpy: ReturnType<typeof vi.fn>;
  routingPushSpy: ReturnType<typeof vi.fn>;
  auditPostSpy: ReturnType<typeof vi.fn>;
  scaleExecSpy: ReturnType<typeof vi.fn>;
  scheduler: CycleSchedulerService;
}

function setupCycle(opts: SetupOptions = {}): Spies {
  const values: MetricsValues = { ...passValues, ...opts.metricsValues };
  const auditPostSpy = vi.fn(async () => new Response(null, { status: 200 }));
  const routingPushSpy = vi.fn(async () => new Response(null, { status: 200 }));

  const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/admin/routing")) return routingPushSpy(url, init);
    if (url.includes("/v1/decisions")) return auditPostSpy(url, init);
    if (url.includes("/metrics")) {
      return new Response(
        JSON.stringify({
          errorRate: values["perf.errorRate"],
          p95LatencyDelta: values["perf.p95LatencyDelta"],
          RPS: values["loadPressure.RPS"],
          CPU: values["resourceHeadroom.CPU"],
          dbPoolUtilization: values["resourceHeadroom.dbPoolUtilization"],
        }),
      );
    }
    if (url.includes("schema-compat")) {
      return new Response(
        JSON.stringify({
          schemaCompatRate: values["compatibility.schemaCompatRate"],
        }),
      );
    }
    return new Response(
      JSON.stringify({
        criticalAnomalyRate: values["auditSafety.criticalAnomalyRate"],
        denyRateDelta: values["decisionQuality.denyRateDelta"],
        avgConfidenceDelta: values["decisionQuality.avgConfidenceDelta"],
        replicationLagMs: values["replicationHealth.replicationLagMs"],
        timeSinceLastReplicaChange:
          values["stability.timeSinceLastReplicaChange"],
      }),
    );
  });
  vi.stubGlobal("fetch", fetchSpy);

  const scaleExecSpy = vi.fn(async () => ({ stdout: "", stderr: "" }));

  const lock = {
    tryAcquire: async () => true,
    release: async () => {},
    isHolding: () => true,
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
  } as unknown as AdvisoryLockService;
  const scrape = new MetricsScrapeService({
    metricsUrl: "http://m",
    ingestUrl: "http://i",
    auditUrl: "http://a",
  });
  const verdict = new CategoryVerdictService(verdictCfg);
  const safety = new SafetyDecisionService(safetyCfg);
  const resource = new ResourceDecisionService(resourceCfg);
  const builder = new DecisionBuilderService({
    controllerId: "CTRL0001",
    auditUrl: "http://audit",
  });
  // Stage 1b — ActionExecutorService 가 catalog/portRegistry/serviceName 필수.
  // executeSafety 에서 routing push body 합성에 사용. executeResource 는 catalog 미사용.
  const catalog: SimServiceCatalogPort = {
    getCurrentTopology: async () => ({
      stable: { value: 1 },
      candidate: { value: 2 },
      retired: [],
    }),
  };
  const portRegistry: PortRegistryPort = {
    getUpstream: (svc: string) => `http://${svc}:4600`,
  };
  const action = new ActionExecutorService({
    gatewayUrl: "http://gw",
    composeProject: "enterprise-pm",
    serviceName: "approval",
    catalog,
    portRegistry,
    scaleExec: scaleExecSpy,
  });
  // Stage 1a — DecisionRingBuffer 가 9번째 의존. recentSafetyHistory(10) 의 SSOT.
  const ringBuffer = new DecisionRingBuffer({ maxSize: 100 });
  // history opts 가 주어지면 가짜 safety record 를 ring 에 append (true=rollback,false=promote).
  // 그 외 필드는 기존처럼 Object.assign 으로 private 주입 (currentWeight 등은 여전히 필드).
  const history = opts.history ?? [];
  for (let i = 0; i < history.length; i += 1) {
    const isFail = history[i] === true;
    const fake: SafetyDecisionRecordInput = {
      decisionId: `FAKE-HIST-${i}`,
      cycleId: `FAKE-CYCLE-${i}`,
      cycleAt: new Date(Date.now() - (history.length - i) * 1000).toISOString(),
      pass: "safety",
      verdict: isFail ? "rollback" : "promote",
      triggerSignals: [],
      categoryVerdicts: {} as SafetyDecisionRecordInput["categoryVerdicts"],
      confidence: 1,
    };
    ringBuffer.appendSafety(fake);
  }
  const scheduler = new CycleSchedulerService(
    {} as unknown as SchedulerRegistry,
    lock,
    scrape,
    verdict,
    safety,
    resource,
    builder,
    action,
    ringBuffer,
  );
  // 사이클 상태 주입 (private — Object.assign 통해 직접 설정).
  // history 필드는 Stage 1a 에서 제거됨 (ring SSOT 로 이전).
  Object.assign(scheduler, {
    currentWeight: opts.currentWeight ?? 0,
    lastPromotionAt: Date.now() - (opts.timeSincePromotionMs ?? 0),
    current: opts.current ?? { v1: 1, v2: 0 },
    lastReplicaChangeAt:
      Date.now() - (opts.timeSinceLastChangeMs ?? 0),
  });

  return { fetchSpy, routingPushSpy, auditPostSpy, scaleExecSpy, scheduler };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Integration: 사이클 1회 흐름 (spec 01 §5)", () => {
  it("(a) all PASS + dwellTime 경과 → promote 5→25 + routing push", async () => {
    const { routingPushSpy, auditPostSpy, scheduler } = setupCycle({
      currentWeight: 5,
      timeSincePromotionMs: 130_000,
    });
    await scheduler.runCycle();
    expect(auditPostSpy).toHaveBeenCalled();
    expect(routingPushSpy).toHaveBeenCalled();
    // spec 2026-05-02 §7 #21 — RoutingPushSchema body shape:
    //   { services: { <serviceName>: { weight, revision, stable, candidate, ... } } }.
    const body = JSON.parse(
      routingPushSpy.mock.calls[0][1]?.body ?? "{}",
    );
    expect(body.services.approval.weight).toBe(25);
  });

  it("(b) compatibility FAIL → hard rollback weight=0", async () => {
    const { routingPushSpy, scheduler } = setupCycle({
      metricsValues: { "compatibility.schemaCompatRate": 0.9 },
      currentWeight: 25,
      timeSincePromotionMs: 200_000,
    });
    await scheduler.runCycle();
    expect(routingPushSpy).toHaveBeenCalled();
    const body = JSON.parse(
      routingPushSpy.mock.calls[0][1]?.body ?? "{}",
    );
    expect(body.services.approval.weight).toBe(0);
  });

  it("(c) auditSafety FAIL → hard rollback", async () => {
    const { routingPushSpy, scheduler } = setupCycle({
      metricsValues: { "auditSafety.criticalAnomalyRate": 1 },
      currentWeight: 25,
      timeSincePromotionMs: 200_000,
    });
    await scheduler.runCycle();
    const body = JSON.parse(
      routingPushSpy.mock.calls[0][1]?.body ?? "{}",
    );
    expect(body.services.approval.weight).toBe(0);
  });

  it("(d) perf WARN → hold (no routing push)", async () => {
    const { routingPushSpy, scheduler } = setupCycle({
      metricsValues: { "perf.p95LatencyDelta": 0.3 },
      currentWeight: 25,
      timeSincePromotionMs: 200_000,
    });
    await scheduler.runCycle();
    expect(routingPushSpy).not.toHaveBeenCalled();
  });

  it("(e) confidence < 0.6 → hold", async () => {
    // ingest fetch 실패 시 weight=0.3, audit/metrics 정상 → confidence = (1+0.3+1)/3 ≈ 0.77.
    // 0.6 미달 confidence를 강제하려면 두 source down — metrics down + audit down.
    const auditPostSpy = vi.fn(async () => new Response(null, { status: 200 }));
    const routingPushSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/admin/routing")) return routingPushSpy(url, init);
        if (url.includes("/v1/decisions")) return auditPostSpy(url, init);
        // 모든 scrape source 실패 → weight 0.3씩, confidence=0.3
        throw new Error("ECONNREFUSED");
      }),
    );
    const lock = {
      tryAcquire: async () => true,
      isHolding: () => true,
    } as unknown as AdvisoryLockService;
    const scrape = new MetricsScrapeService({
      metricsUrl: "http://m",
      ingestUrl: "http://i",
      auditUrl: "http://a",
    });
    const verdict = new CategoryVerdictService(verdictCfg);
    const safety = new SafetyDecisionService(safetyCfg);
    const resource = new ResourceDecisionService(resourceCfg);
    const builder = new DecisionBuilderService({
      controllerId: "CTRL0001",
      auditUrl: "http://audit",
    });
    const catalog: SimServiceCatalogPort = {
      getCurrentTopology: async () => ({
        stable: { value: 1 },
        candidate: { value: 2 },
        retired: [],
      }),
    };
    const portRegistry: PortRegistryPort = {
      getUpstream: (svc: string) => `http://${svc}:4600`,
    };
    const action = new ActionExecutorService({
      gatewayUrl: "http://gw",
      composeProject: "enterprise-pm",
      serviceName: "approval",
      catalog,
      portRegistry,
      scaleExec: vi.fn(async () => ({ stdout: "", stderr: "" })),
    });
    const ringBuffer = new DecisionRingBuffer({ maxSize: 100 });
    const scheduler = new CycleSchedulerService(
      {} as unknown as SchedulerRegistry,
      lock,
      scrape,
      verdict,
      safety,
      resource,
      builder,
      action,
      ringBuffer,
    );
    Object.assign(scheduler, {
      currentWeight: 5,
      lastPromotionAt: Date.now() - 200_000,
      current: { v1: 1, v2: 0 },
      lastReplicaChangeAt: 0,
    });
    await scheduler.runCycle();
    expect(routingPushSpy).not.toHaveBeenCalled();
  });

  it("(f) load FAIL + headroom OK + canary 25% → scale-up v2+1", async () => {
    const { scaleExecSpy, scheduler } = setupCycle({
      metricsValues: {
        "loadPressure.RPS": 110,
        "resourceHeadroom.CPU": 30,
      },
      currentWeight: 25,
      current: { v1: 2, v2: 1 },
      timeSinceLastChangeMs: 200_000,
      timeSincePromotionMs: 200_000,
      // perf WARN을 회피하기 위해 전체 PASS 위에 loadPressure만 변형
    });
    await scheduler.runCycle();
    expect(scaleExecSpy).toHaveBeenCalled();
    const argv = scaleExecSpy.mock.calls[0][0] as string[];
    expect(argv).toContain("sim-approval-api-v2=2");
  });

  it("(g) load + headroom 둘 다 FAIL → rejected (no scale exec)", async () => {
    const { scaleExecSpy, scheduler } = setupCycle({
      metricsValues: {
        "loadPressure.RPS": 110,
        "resourceHeadroom.CPU": 90,
      },
      currentWeight: 25,
      current: { v1: 2, v2: 1 },
      timeSinceLastChangeMs: 200_000,
      timeSincePromotionMs: 200_000,
    });
    await scheduler.runCycle();
    expect(scaleExecSpy).not.toHaveBeenCalled();
  });

  it("(h) all PASS + cooldownDown 경과 + replicas>min → scale-down v1-1", async () => {
    const { scaleExecSpy, scheduler } = setupCycle({
      currentWeight: 100,
      current: { v1: 3, v2: 0 },
      timeSinceLastChangeMs: 200_000,
      timeSincePromotionMs: 200_000,
    });
    await scheduler.runCycle();
    expect(scaleExecSpy).toHaveBeenCalled();
    const argv = scaleExecSpy.mock.calls[0][0] as string[];
    expect(argv).toContain("sim-approval-api-v1=2");
  });
});
