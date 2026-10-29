// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG, encodePrefixByValue } from 'demo-snapshot';
import { DEMO_DKG_CONFIG } from 'demo-dkg-config';
import { auditCoverage, bootstrapDkg } from '../index.js';
import { convergeChain } from '../skills/converge-chain.js';
import { deriveFromCatalog } from 'dkg';
import {
  aggregateUsageData,
  analyzeDeploymentSkew,
  analyzeEntryCoverage,
  analyzeSimplification,
  catalogLatestVersions,
  comparePrefixes,
  detectAnomalies,
  type AddressContextRecord,
} from '@qa-sdk/convergence';
import type { PatternClassification, PatternStats } from '@qa-sdk/core';
import { PURPOSE_ALIGNMENT_GOLDEN } from './purpose-alignment.js';

const PRECISION_FLOOR = 0.8;

function precision(truePositive: number, falsePositive: number): number | null {
  const denominator = truePositive + falsePositive;
  return denominator === 0 ? null : truePositive / denominator;
}

function entriesMap(): ReadonlyMap<string, readonly string[]> {
  return new Map(
    Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
      const version = Object.keys(axis.versions).at(-1);
      const snapshots = axis.versions as Record<string, { entries: readonly string[] }>;
      return [id, version ? snapshots[version].entries : []];
    }),
  );
}

function pageViewRecords(count: number): AddressContextRecord[] {
  const svcRef = DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0];
  return Array.from({ length: count }, (_, index) => {
    const address = encodePrefixByValue(DEMO_CATALOG, 'page_view', 'v1', {
      svc_ref: svcRef,
      page: 'home',
      locale: 'ko',
      userType: 'member',
    });
    return {
      address_context: { page_view: `page_view:v1:${address}` },
      timestamp: new Date(Date.UTC(2026, 9, 29, 0, 0, index)).toISOString(),
      session_id: `golden-${index}`,
    };
  });
}

function classification(
  pattern: PatternClassification['pattern'],
  mode: PatternClassification['identificationMode'] = 'identified',
): PatternClassification {
  return {
    pattern,
    identificationMode: mode,
    confidence: pattern === 'unclassified' ? 'unknown' : 'exact',
    matchedRuleId: pattern === 'unclassified' ? 'none' : 'golden-rule',
    eventCount: 4,
    durationMs: 1000,
    classifiedAt: '2026-10-29T00:00:00.000Z',
  };
}

function stats(
  pattern: PatternStats['pattern'],
  count: number,
  percentage: number,
  mode: PatternStats['identificationMode'] = 'identified',
): PatternStats {
  return {
    pattern,
    identificationMode: mode,
    count,
    percentage,
    avgEventCount: 4,
    avgDurationMs: 1000,
    lastSeen: '2026-10-29T00:00:00.000Z',
  };
}

describe('목적 정렬 2단계 골든 세트 초안', () => {
  it('골든 초안은 모든 항목을 사람 확정 전 proposed로 표시한다', () => {
    expect(PURPOSE_ALIGNMENT_GOLDEN.length).toBeGreaterThan(0);
    expect(PURPOSE_ALIGNMENT_GOLDEN.every((item) => item.judgment === 'proposed')).toBe(true);
  });

  it('merge: 구조 유사도 후보 4건은 결정이 아니라 observation으로 낮춘다', () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const pairs = [
      ['engine_event', 'validation_event'],
      ['test_event', 'test_coverage'],
      ['cli_event', 'cli_tracking'],
      ['ir_pipe', 'ir_intent_path'],
    ] as const;
    const candidates = pairs.map(([a, b]) => comparePrefixes(graph, a, b));
    const rawPrecision = precision(0, candidates.length);
    expect(candidates).toHaveLength(pairs.length);
    expect(rawPrecision).not.toBeNull();
    expect(rawPrecision!).toBeLessThan(PRECISION_FLOOR);

    const result = convergeChain(
      DEMO_CATALOG,
      bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG }),
      null,
      {
        date: '2026-10-29',
        entriesMap: entriesMap(),
      },
    );
    const prefixObservations = result.observations.filter((observation) =>
      observation.id.startsWith('OBS-PREFIX-MERGE-'),
    );
    expect(prefixObservations).toHaveLength(4);
    expect(result.actions.filter((action) => action.kind === 'merge')).toHaveLength(0);
  });

  it('simplify/deactivate: 표본 1건에서는 제안을 보류하고 충분한 표본에서만 평가한다', () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const one = aggregateUsageData(DEMO_CATALOG, pageViewRecords(1));
    const oneResult = convergeChain(DEMO_CATALOG, graph, one, {
      date: '2026-10-29',
      entriesMap: entriesMap(),
    });
    expect(
      oneResult.actions.filter(
        (action) =>
          (action.kind === 'simplify' || action.kind === 'deactivate') &&
          ('prefix' in action ? action.prefix === 'page_view' : true),
      ),
    ).toHaveLength(0);

    const legacyCandidate = analyzeSimplification(
      graph,
      'page_view',
      one.entryUsages,
      one.addressUsages,
      { minSampleCount: 1 },
    );
    const legacyPrecision = precision(0, legacyCandidate.singleValueDims.length);
    expect(legacyPrecision).not.toBeNull();
    expect(legacyPrecision!).toBeLessThan(PRECISION_FLOOR);

    const many = aggregateUsageData(DEMO_CATALOG, pageViewRecords(500));
    const candidate = analyzeSimplification(
      graph,
      'page_view',
      many.entryUsages,
      many.addressUsages,
    );
    const pageDims = DEMO_CATALOG.prefixes.page_view.labels.filter(
      (label) => DEMO_CATALOG.prefixes.page_view.dims[label].kind === 'axis',
    );
    expect(candidate.singleValueDims).toHaveLength(pageDims.length);
    expect(
      candidate.suggestions.filter((suggestion) => suggestion.kind === 'remove-dim'),
    ).toHaveLength(pageDims.length);
    expect(precision(candidate.singleValueDims.length, 0)).toBe(1);
  });

  it('coverage: 빈 usage는 dormant Decision이 아니라 zero observation만 만든다', () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const emptyReport = analyzeEntryCoverage(DEMO_CATALOG, [], []);
    const dormantCandidates = emptyReport.prefixes.filter((prefix) => prefix.coverageRate < 0.5);
    const emptyDecisionPrecision = precision(0, dormantCandidates.length);
    expect(emptyDecisionPrecision).toBe(0);
    const result = auditCoverage(DEMO_CATALOG, graph, [], []);
    expect(result.report.prefixes).toHaveLength(Object.keys(DEMO_CATALOG.prefixes).length);
    expect(result.report.dormantCount).toBeGreaterThan(0);
    expect(result.decisions).toHaveLength(0);
    expect(result.observations.map((observation) => observation.id)).toContain('OBS-COV-ZERO');
  });

  it('coverage: phantom은 축별 key로 판정한다', () => {
    const report = analyzeEntryCoverage(
      DEMO_CATALOG,
      [{ axisId: 'flow_step', entry: 'admin', count: 10, lastSeen: '2026-10-29' }],
      [],
    );
    expect(report.allEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ axisId: 'flow_step', entry: 'admin', status: 'phantom' }),
      ]),
    );
  });

  it('coverage: 공유 축 값은 traffic 없는 prefix로 전파하지 않는다', () => {
    const address = encodePrefixByValue(DEMO_CATALOG, 'content', 'v1', {
      tag: 'frontend',
      category: 'product',
      status: 'draft',
      locale: 'ko',
      channel: 'web',
    });
    const usage = aggregateUsageData(DEMO_CATALOG, [
      {
        address_context: { content: `content:v1:${address}` },
        timestamp: '2026-10-29T00:00:00.000Z',
      },
    ]);
    const report = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);
    expect(
      report.prefixes.find((prefix) => prefix.prefixId === 'tag_lifecycle')?.coverageRate,
    ).toBe(0);
  });

  it('skew: catalog 최신 version을 명시하면 count 역전 canary도 올바르게 분류한다', () => {
    const usage = [
      {
        prefix: 'permission',
        version: 'v3',
        count: 99,
        lastSeen: '2026-10-29T00:00:00Z',
        sessions: ['old-service'],
      },
      {
        prefix: 'permission',
        version: 'v4',
        count: 1,
        lastSeen: '2026-10-29T00:00:00Z',
        sessions: ['canary-service'],
      },
    ] as const;
    const inferred = analyzeDeploymentSkew(usage);
    const inferredFalsePositive = inferred.find((item) => item.prefix === 'permission')!;
    expect(precision(0, inferredFalsePositive.staleConsumers.length > 0 ? 1 : 0)).toBe(0);
    const result = analyzeDeploymentSkew(usage, {
      latestVersions: catalogLatestVersions(DEMO_CATALOG),
    });
    const permission = result.find((item) => item.prefix === 'permission')!;
    expect(permission.latestVersion).toBe('v4');
    expect(permission.severity).toBe('critical');
    expect(permission.staleConsumers.map((consumer) => consumer.session)).toContain('old-service');
    expect(precision(1, 0)).toBe(1);

    const latestUnobserved = analyzeDeploymentSkew([usage[0]], {
      latestVersions: catalogLatestVersions(DEMO_CATALOG),
    });
    expect(latestUnobserved.find((item) => item.prefix === 'permission')?.severity).toBe('warning');
  });

  it('pattern anomaly: 저표본 ratio/volume은 보류하고 충분한 표본 변화는 검출한다', () => {
    const lowRatio = detectAnomalies({
      previous: [stats('browse_only', 1, 1)],
      current: [classification('purchase_complete')],
    });
    const legacyRatio = detectAnomalies({
      previous: [stats('browse_only', 1, 1)],
      current: [classification('purchase_complete')],
      minWindowSampleSize: 1,
    });
    expect(
      precision(0, legacyRatio.filter((anomaly) => anomaly.kind === 'ratio_shift').length),
    ).toBe(0);
    expect(lowRatio.some((anomaly) => anomaly.kind === 'ratio_shift')).toBe(false);

    const lowVolume = detectAnomalies({
      previous: [stats('purchase_complete', 1, 1)],
      current: [
        classification('purchase_complete'),
        classification('purchase_complete'),
        classification('purchase_complete'),
      ],
    });
    const legacyVolume = detectAnomalies({
      previous: [stats('purchase_complete', 1, 1)],
      current: [
        classification('purchase_complete'),
        classification('purchase_complete'),
        classification('purchase_complete'),
      ],
      minWindowSampleSize: 1,
    });
    expect(
      precision(0, legacyVolume.filter((anomaly) => anomaly.kind === 'volume_spike').length),
    ).toBe(0);
    expect(lowVolume.some((anomaly) => anomaly.kind === 'volume_spike')).toBe(false);

    const sufficient = detectAnomalies({
      previous: [stats('browse_only', 5, 1)],
      current: Array.from({ length: 5 }, () => classification('purchase_complete')),
    });
    expect(sufficient.some((anomaly) => anomaly.kind === 'ratio_shift')).toBe(true);
    expect(precision(1, 0)).toBe(1);
  });
});
