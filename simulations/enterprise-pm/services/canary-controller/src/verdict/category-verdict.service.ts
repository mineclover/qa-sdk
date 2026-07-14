// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §2 — 8 카테고리 신호 매트릭스 1:1.
// 카테고리 verdict = 신호 verdict 최악값.
// hard rule(compatibility, auditSafety) 단일 사이클 즉시 FAIL — yaml override 무시.

import { Injectable } from '@nestjs/common';
import type { ScrapeResult } from '../metrics/metrics-scrape.service.js';

export type Verdict = 'PASS' | 'WARN' | 'FAIL';

export interface VerdictConfig {
  perf: {
    errorRate: { warn: number; fail: number; baselineMultiplier: boolean };
    p95LatencyDelta: { warn: number; fail: number };
  };
  decisionQuality: {
    denyRateDelta: { warn: number; fail: number };
    avgConfidenceDelta: { warn: number; fail: number };
  };
  replicationHealth: { replicationLagMs: { warn: number; fail: number } };
  baselines: {
    errorRate: number;
    RPS: number;
    CPU: number;
    dbPoolUtilization: number;
    cooldownUpMs: number;
  };
}

export interface CategoryVerdicts {
  perf: Verdict;
  compatibility: Verdict;
  decisionQuality: Verdict;
  auditSafety: Verdict;
  replicationHealth: Verdict;
  loadPressure: Verdict;
  resourceHeadroom: Verdict;
  stability: Verdict;
  /** spec 01 §2 hard rule 위반 카테고리. */
  hardFail: string[];
  /** PASS 외 verdict를 발생시킨 신호 id 목록. */
  triggerSignals: string[];
}

const worse = (a: Verdict, b: Verdict): Verdict =>
  a === 'FAIL' || b === 'FAIL' ? 'FAIL' : a === 'WARN' || b === 'WARN' ? 'WARN' : 'PASS';

const band = (v: number | null, warn: number, fail: number): Verdict =>
  v === null ? 'PASS' : v > fail ? 'FAIL' : v > warn ? 'WARN' : 'PASS';

const bandAbs = (v: number | null, warn: number, fail: number): Verdict =>
  v === null ? 'PASS' : Math.abs(v) > fail ? 'FAIL' : Math.abs(v) > warn ? 'WARN' : 'PASS';

@Injectable()
export class CategoryVerdictService {
  constructor(private readonly cfg: VerdictConfig) {}

  evaluate(scrape: ScrapeResult): CategoryVerdicts {
    const sig = (id: string): number | null => scrape.signals[id]?.value ?? null;
    const triggers: string[] = [];
    const hardFail: string[] = [];
    const push = (id: string, v: Verdict) => {
      if (v !== 'PASS') triggers.push(id);
    };

    // perf — errorRate는 baseline 곱 임계
    const baseErr = this.cfg.baselines.errorRate;
    const perfErr = band(sig('perf.errorRate'), baseErr * 1.2, baseErr * 1.5);
    const perfLat = band(sig('perf.p95LatencyDelta'), 0.2, 0.5);
    push('perf.errorRate', perfErr);
    push('perf.p95LatencyDelta', perfLat);
    const perf = worse(perfErr, perfLat);

    // compatibility — hard rule: < 1.0 → FAIL
    const sc = sig('compatibility.schemaCompatRate');
    let compatibility: Verdict = 'PASS';
    if (sc !== null && sc < 1.0) {
      compatibility = 'FAIL';
      hardFail.push('compatibility');
      triggers.push('compatibility.schemaCompatRate');
    }

    // decisionQuality — denyRateDelta는 절대값, avgConfidenceDelta는 음수 방향
    const drV = bandAbs(sig('decisionQuality.denyRateDelta'), 0.05, 0.15);
    const acRaw = sig('decisionQuality.avgConfidenceDelta');
    const acV: Verdict =
      acRaw === null ? 'PASS' : acRaw < -0.15 ? 'FAIL' : acRaw < -0.05 ? 'WARN' : 'PASS';
    push('decisionQuality.denyRateDelta', drV);
    push('decisionQuality.avgConfidenceDelta', acV);
    const decisionQuality = worse(drV, acV);

    // auditSafety — hard rule: > 0 → FAIL
    const ca = sig('auditSafety.criticalAnomalyRate');
    let auditSafety: Verdict = 'PASS';
    if (ca !== null && ca > 0) {
      auditSafety = 'FAIL';
      hardFail.push('auditSafety');
      triggers.push('auditSafety.criticalAnomalyRate');
    }

    // replicationHealth
    const replicationHealth = band(sig('replicationHealth.replicationLagMs'), 500, 2000);
    push('replicationHealth.replicationLagMs', replicationHealth);

    // loadPressure
    const rpsT = this.cfg.baselines.RPS;
    const rps = sig('loadPressure.RPS');
    const rpsV: Verdict =
      rps === null ? 'PASS' : rps >= rpsT ? 'FAIL' : rps >= rpsT * 0.8 ? 'WARN' : 'PASS';
    const lat2V = band(sig('loadPressure.p95LatencyDelta'), 0.3, 0.5);
    push('loadPressure.RPS', rpsV);
    push('loadPressure.p95LatencyDelta', lat2V);
    const loadPressure = worse(rpsV, lat2V);

    // resourceHeadroom
    const cpuT = this.cfg.baselines.CPU;
    const poolT = this.cfg.baselines.dbPoolUtilization;
    const cpuV = band(sig('resourceHeadroom.CPU'), cpuT * 0.75, cpuT);
    const poolV = band(sig('resourceHeadroom.dbPoolUtilization'), poolT * 0.75, poolT);
    push('resourceHeadroom.CPU', cpuV);
    push('resourceHeadroom.dbPoolUtilization', poolV);
    const resourceHeadroom = worse(cpuV, poolV);

    // stability — cooldownUp 이내 변경 시 WARN
    const since = sig('stability.timeSinceLastReplicaChange');
    let stability: Verdict = 'PASS';
    if (since !== null && since < this.cfg.baselines.cooldownUpMs) {
      stability = 'WARN';
      triggers.push('stability.timeSinceLastReplicaChange');
    }

    return {
      perf,
      compatibility,
      decisionQuality,
      auditSafety,
      replicationHealth,
      loadPressure,
      resourceHeadroom,
      stability,
      hardFail,
      triggerSignals: triggers,
    };
  }
}
