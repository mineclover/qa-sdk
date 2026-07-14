// @def.boundary convergence-layer-group
/**
 * 패턴 이상 감지 — 미분류 시퀀스, 비율 급변, 비정상 속도 탐지.
 *
 * @layer 측정 (Measurement)
 */

import type { PatternAnomaly, PatternClassification, PatternStats } from '@qa-sdk/core';

/** 이상 감지 입력: 분류 결과 배열 + 이전 통계 (비교용) */
export interface AnomalyDetectionInput {
  /** 현재 윈도우의 분류 결과 */
  readonly current: readonly PatternClassification[];
  /** 이전 윈도우의 패턴 통계 (비율 비교용) */
  readonly previous?: readonly PatternStats[];
  /** 비율 변동 임계값 (기본 0.3 = 30%) */
  readonly ratioShiftThreshold?: number;
  /** 볼륨 급증 배수 (기본 3.0 = 3배) */
  readonly volumeSpikeMultiplier?: number;
}

/**
 * 분류 결과에서 이상 패턴을 감지한다.
 */
export function detectAnomalies(input: AnomalyDetectionInput): PatternAnomaly[] {
  const anomalies: PatternAnomaly[] = [];
  const now = new Date().toISOString();
  const ratioThreshold = input.ratioShiftThreshold ?? 0.3;
  const spikeMultiplier = input.volumeSpikeMultiplier ?? 3.0;

  // 1. unclassified 감지
  const unclassified = input.current.filter((c) => c.pattern === 'unclassified');
  if (unclassified.length > 0) {
    // 고유 시퀀스별로 그룹
    const seqGroups = new Map<string, number>();
    for (const c of unclassified) {
      const key = `unclassified:${c.eventCount}`;
      seqGroups.set(key, (seqGroups.get(key) ?? 0) + 1);
    }
    for (const [_key, count] of seqGroups) {
      anomalies.push({
        kind: 'unclassified',
        sessionId: `aggregate:${count}`,
        eventSequence: [],
        description: `미분류 패턴 ${count}건 감지. 새 규칙 추가를 검토하세요.`,
        severity: count >= 10 ? 'critical' : count >= 3 ? 'warning' : 'info',
        detectedAt: now,
      });
    }
  }

  // 2. 비율 급변 감지 (이전 통계 필요)
  if (input.previous && input.previous.length > 0) {
    const currentCounts = new Map<string, number>();
    const total = input.current.length || 1;
    for (const c of input.current) {
      currentCounts.set(c.pattern, (currentCounts.get(c.pattern) ?? 0) + 1);
    }

    for (const prev of input.previous) {
      const currentCount = currentCounts.get(prev.pattern) ?? 0;
      const currentRatio = currentCount / total;
      const diff = Math.abs(currentRatio - prev.percentage);

      if (diff >= ratioThreshold) {
        anomalies.push({
          kind: 'ratio_shift',
          sessionId: 'aggregate',
          eventSequence: [],
          description: `${prev.pattern} 비율 급변: ${(prev.percentage * 100).toFixed(1)}% → ${(currentRatio * 100).toFixed(1)}% (변동 ${(diff * 100).toFixed(1)}%)`,
          severity: diff >= 0.5 ? 'critical' : 'warning',
          detectedAt: now,
        });
      }
    }

    // 3. 볼륨 급증 감지
    const _prevTotal = input.previous.reduce((s, p) => s + p.count, 0) || 1;
    for (const [pattern, count] of currentCounts) {
      const prevStat = input.previous.find((p) => p.pattern === pattern);
      const prevCount = prevStat?.count ?? 0;
      // 이전 대비 spikeMultiplier 배 이상 증가
      if (prevCount > 0 && count >= prevCount * spikeMultiplier) {
        anomalies.push({
          kind: 'volume_spike',
          sessionId: 'aggregate',
          eventSequence: [],
          description: `${pattern} 볼륨 급증: ${prevCount} → ${count} (${(count / prevCount).toFixed(1)}배)`,
          severity: count / prevCount >= 10 ? 'critical' : 'warning',
          detectedAt: now,
        });
      }
    }
  }

  // 4. 비정상 속도 세션
  for (const c of input.current) {
    if (c.durationMs > 0 && c.eventCount > 5) {
      const avgInterval = c.durationMs / (c.eventCount - 1);
      if (avgInterval < 100) {
        // 100ms 미만 평균 간격
        anomalies.push({
          kind: 'abnormal_speed',
          sessionId: c.matchedRuleId,
          eventSequence: [],
          description: `비정상 속도: ${c.eventCount}개 이벤트, 평균 간격 ${avgInterval.toFixed(0)}ms`,
          severity: avgInterval < 50 ? 'critical' : 'warning',
          detectedAt: now,
        });
      }
    }
  }

  // 5. 비정상 세션 시간 (30분 이상)
  for (const c of input.current) {
    if (c.durationMs > 30 * 60 * 1000) {
      anomalies.push({
        kind: 'abnormal_duration',
        sessionId: c.matchedRuleId,
        eventSequence: [],
        description: `비정상 세션 시간: ${(c.durationMs / 60000).toFixed(1)}분 (${c.eventCount}개 이벤트)`,
        severity: c.durationMs > 60 * 60 * 1000 ? 'critical' : 'warning',
        detectedAt: now,
      });
    }
  }

  return anomalies;
}
