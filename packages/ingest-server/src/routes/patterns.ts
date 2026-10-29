// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * /v1/patterns — 패턴 분류 상태/통계 API.
 *
 * convergence pipeline의 패턴 분류 결과를 조회.
 */
import { Hono } from 'hono';
import type { Logger } from 'pino';

export interface PatternRouteDeps {
  /** convergence pipeline의 마지막 flush 결과에서 패턴 통계 캐시 */
  getPatternStats?: () => PatternStatsCache | null;
  logger?: Logger;
}

export interface PatternStatsCache {
  lastFlushAt: string;
  sessionsClassified: number;
  /** 분류율 백분율 (0~100) */
  classificationRate: number;
  anomaliesDetected: number;
  /** ratio: 전체 분류 세션 대비 비율 (0~1) */
  topPatterns: Array<{ pattern: string; count: number; ratio: number }>;
  recentAnomalies: Array<{
    kind: string;
    severity: string;
    sessionId: string;
    description: string;
    detectedAt: string;
  }>;
}

export function createPatternRoutes(deps: PatternRouteDeps) {
  const routes = new Hono();

  // GET /v1/patterns/health — 패턴 분류 상태 요약
  routes.get('/v1/patterns/health', (c) => {
    const stats = deps.getPatternStats?.();
    if (!stats) {
      return c.json({
        status: 'inactive',
        message: '패턴 분류 비활성 (PATTERN_CLASSIFICATION_ENABLED=false 또는 flush 미발생)',
      });
    }

    const status =
      stats.classificationRate >= 80
        ? 'healthy'
        : stats.classificationRate >= 50
          ? 'degraded'
          : 'critical';

    return c.json({
      status,
      lastFlushAt: stats.lastFlushAt,
      sessionsClassified: stats.sessionsClassified,
      classificationRate: stats.classificationRate,
      anomaliesDetected: stats.anomaliesDetected,
    });
  });

  // GET /v1/patterns/stats — 상세 통계
  routes.get('/v1/patterns/stats', (c) => {
    const stats = deps.getPatternStats?.();
    if (!stats) return c.json({ patterns: [], anomalies: [] });

    return c.json({
      lastFlushAt: stats.lastFlushAt,
      sessionsClassified: stats.sessionsClassified,
      classificationRate: stats.classificationRate,
      patterns: stats.topPatterns,
      anomalies: stats.recentAnomalies,
    });
  });

  return routes;
}
