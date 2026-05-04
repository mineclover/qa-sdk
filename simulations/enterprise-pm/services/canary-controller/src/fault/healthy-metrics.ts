// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
//
// healthy-metrics fault — sim 전용 happy-path 진입 fault.
//
// 배경: scrape 가 호출하는 외부 metrics/insights endpoint 가 미연결/오류 응답인
// 경우 모든 source 가 fail 처리되어 confidence=0.3 → safety verdict=hold 가 영구
// 지속된다 (시나리오 9 #canary-happy-promote 가 assert 를 도달할 수 없는 원인).
//
// 본 fault 는 enabled 시 MetricsScrapeService 의 scrape() 결과를 wrap 하여:
//   1) sources 모두 ok=true / weight=1.0 으로 재기록 (confidence=1.0).
//   2) 모든 신호를 PASS 임계 안의 합성 값으로 채움 — controller 카테고리 verdict
//      이 모두 PASS 가 되어 safety promote 분기 진입.
//
// disabled (기본값) → passthrough. spec §8 fault 패턴과 동일 (PerfWarnFault 참고).
// admin endpoint POST /admin/fault/healthy-metrics body { enabled: true } 로 토글
// 가능하며, 시뮬 부팅 시 SIM_CONTROLLER_HEALTHY_METRICS=true 환경변수가 있으면
// CycleSchedulerService 가 onModuleInit 에서 자동 enable.
//
// scrape 결과 wrap 은 metrics-scrape.service 가 본 fault 인스턴스를 inject 받아
// scrape() 끝에서 applyTo() 를 호출하는 wrapper 패턴 (PerfWarnAware 와 동일).

import { Injectable } from "@nestjs/common";
import {
  buildDecisionSignal,
  type SignalCategory,
  type SignalName,
} from "sim-identifier-grammar";
import type { Fault } from "./types.js";
import type {
  ScrapeResult,
  SignalSample,
  SourceStatus,
} from "../metrics/metrics-scrape.service.js";

/**
 * 카테고리×signal → PASS 합성 값. CategoryVerdictService 의 임계 (perf p95Latency
 * < 0.2 → PASS, replicationLag < 500 → PASS 등) 를 모두 통과하는 안전 마진 값.
 * spec 01 §2 임계 참조.
 */
const PASS_VALUES: ReadonlyArray<readonly [SignalCategory, SignalName, number]> = [
  ["perf", "errorRate", 0.005], // baseline 0.01 × 1.2 = 0.012 미만 → PASS
  ["perf", "p95LatencyDelta", 0.05], // < 0.2 warn → PASS
  ["compatibility", "schemaCompatRate", 1.0], // hard rule: < 1.0 → FAIL → 정확히 1.0
  ["decisionQuality", "denyRateDelta", 0],
  ["decisionQuality", "avgConfidenceDelta", 0],
  ["auditSafety", "criticalAnomalyRate", 0], // hard rule: > 0 → FAIL → 0 유지
  ["replicationHealth", "replicationLagMs", 100], // < 500 warn → PASS
  ["loadPressure", "RPS", 10], // baseline 100 × 0.8 = 80 미만 → PASS
  ["loadPressure", "p95LatencyDelta", 0.05],
  ["resourceHeadroom", "CPU", 30], // baseline 80 × 0.75 = 60 미만 → PASS
  ["resourceHeadroom", "dbPoolUtilization", 0.4],
  ["stability", "timeSinceLastReplicaChange", 999_999], // cooldownUp 보다 큼 → PASS
];

@Injectable()
export class HealthyMetricsFault implements Fault {
  readonly kind = "healthy-metrics" as const;
  private enabled = false;

  async enable(_params: unknown): Promise<void> {
    // params 미사용 — body schema 는 enabled 만 검증하므로 추가 검증 없음.
    this.enabled = true;
  }

  async disable(): Promise<void> {
    this.enabled = false;
  }

  async reset(): Promise<void> {
    await this.disable();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * MetricsScrapeService 가 호출 — enabled 시 scrape result 를 PASS 합성으로 wrap.
   * - sources: 모두 ok=true, weight=1.0 (confidence=1.0)
   * - signals: PASS_VALUES 로 전부 덮어씀 (외부 응답에 해당 signal 없어도 채움)
   *
   * disabled → passthrough.
   */
  applyTo(result: ScrapeResult): ScrapeResult {
    if (!this.enabled) return result;

    const sources: SourceStatus[] = result.sources.map((s) => ({
      name: s.name,
      ok: true,
      weight: 1.0,
    }));

    const signals: Record<string, SignalSample> = { ...result.signals };
    for (const [category, signalName, value] of PASS_VALUES) {
      try {
        const id = buildDecisionSignal({ category, signal: signalName });
        // sourceName 은 grammar 매트릭스 SSOT 와 무관 — 본 fault 가 직접 합성한 값임을
        // 표시하기 위해 "healthy-metrics" 라벨 사용.
        signals[id] = { value, sourceName: "healthy-metrics" };
      } catch {
        // grammar 가 새 카테고리/신호 추가로 거부될 수 있음 — sim 은 fail-open.
      }
    }
    return {
      scrapedAt: result.scrapedAt,
      signals,
      sources,
    };
  }
}
