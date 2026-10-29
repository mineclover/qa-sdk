// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG, encodePrefixByValue } from 'demo-snapshot';
import { DEMO_DKG_CONFIG } from 'demo-dkg-config';
import {
  aggregateUsageData,
  detectAnomalies,
  runConvergenceAnalysis,
  type AddressContextRecord,
} from '@qa-sdk/convergence';
import type { PatternClassification, PatternStats } from '@qa-sdk/core';
import {
  assertDecisionNode,
  assertObservationNode,
  validateDecisionNode,
  validateObservationNode,
} from 'dkg';
import { bootstrapDkg } from './index.js';
import { auditCoverage } from './skills/coverage-audit.js';
import { convergeChain } from './skills/converge-chain.js';

const PROOF_DATE = '2026-10-30';
const PROOF_CLOCK = () => new Date('2026-10-30T12:00:00.000Z');

function entriesMap(): ReadonlyMap<string, readonly string[]> {
  return new Map(
    Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
      const versions = axis.versions as Record<string, { entries: readonly string[] }>;
      const version = Object.keys(versions).at(-1);
      return [id, version ? versions[version].entries : []];
    }),
  );
}

function fixedUsage() {
  const svcRef = DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0];
  const page = encodePrefixByValue(DEMO_CATALOG, 'page_view', 'v1', {
    svc_ref: svcRef,
    page: 'home',
    locale: 'ko',
    userType: 'member',
  });
  const endpoint = encodePrefixByValue(DEMO_CATALOG, 'endpoint', 'v1', {
    svc_ref: svcRef,
    resource_type: 'api',
    http_method: 'GET',
    api_version: 'v1',
  });
  const records: AddressContextRecord[] = Array.from({ length: 5 }, (_, index) => ({
    address_context: {
      page_view: `page_view:v1:${page}`,
      endpoint: `endpoint:v1:${endpoint}`,
    },
    timestamp: `2026-10-30T12:00:0${index}.000Z`,
    session_id: `proof-session-${index}`,
    trace_id: `proof-trace-${index}`,
    event_key: 'proof.request',
  }));
  return aggregateUsageData(DEMO_CATALOG, records);
}

function classification(pattern: PatternClassification['pattern']): PatternClassification {
  return {
    pattern,
    identificationMode: 'identified',
    confidence: pattern === 'unclassified' ? 'unknown' : 'exact',
    matchedRuleId: pattern === 'unclassified' ? 'none' : 'proof-rule',
    eventCount: 2,
    durationMs: 10,
    classifiedAt: '2026-10-30T12:00:00.000Z',
  };
}

function stats(pattern: PatternStats['pattern'], count: number, percentage: number): PatternStats {
  return {
    pattern,
    identificationMode: 'identified',
    count,
    percentage,
    avgEventCount: 2,
    avgDurationMs: 10,
    lastSeen: '2026-10-30T12:00:00.000Z',
  };
}

describe('core logic proof — convergence and DKG', () => {
  it('fixed usage, graph, date, and clock produce byte-stable convergence reports', () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const usage = fixedUsage();
    const options = { date: PROOF_DATE, clock: PROOF_CLOCK, entriesMap: entriesMap() };

    const first = runConvergenceAnalysis(graph, usage, options);
    const second = runConvergenceAnalysis(graph, usage, options);

    expect(second).toEqual(first);
    expect(first.observations.every((observation) => observation.date === PROOF_DATE)).toBe(true);
    for (const observation of first.observations) {
      expect(validateObservationNode(observation).ok).toBe(true);
      assertObservationNode(observation);
    }
  });

  it('convergeChain is stable and structural prefix similarity stays observation-only', () => {
    const makeResult = () =>
      convergeChain(
        DEMO_CATALOG,
        bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG }),
        null,
        { date: PROOF_DATE, entriesMap: entriesMap() },
      );
    const first = makeResult();
    const second = makeResult();

    expect(second).toEqual(first);
    const prefixObservations = first.observations.filter((observation) =>
      observation.id.startsWith('OBS-PREFIX-MERGE-'),
    );
    expect(prefixObservations.length).toBeGreaterThan(0);
    expect(first.actions.filter((action) => action.kind === 'observe')).toHaveLength(
      prefixObservations.length,
    );
    for (const decision of first.decisions) {
      expect(validateDecisionNode(decision).ok).toBe(true);
      assertDecisionNode(decision);
    }
  });

  it('empty coverage produces observation only and no low-traffic decisions', () => {
    const first = auditCoverage(
      DEMO_CATALOG,
      bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG }),
      [],
      [],
      { date: PROOF_DATE },
    );
    const second = auditCoverage(
      DEMO_CATALOG,
      bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG }),
      [],
      [],
      { date: PROOF_DATE },
    );

    expect(second.observations).toEqual(first.observations);
    expect(first.decisions).toHaveLength(0);
    expect(first.observations.map((observation) => observation.id)).toContain('OBS-COV-ZERO');
    for (const observation of first.observations) assertObservationNode(observation);
  });

  it('low-sample anomaly detection is stable and does not promote ratio or volume noise', () => {
    const input = {
      previous: [stats('browse_only', 1, 1)],
      current: [classification('purchase_complete')],
    };
    const first = detectAnomalies(input, { clock: PROOF_CLOCK });
    const second = detectAnomalies(input, { clock: PROOF_CLOCK });

    expect(second).toEqual(first);
    expect(first.filter((anomaly) => anomaly.kind === 'ratio_shift')).toHaveLength(0);
    expect(first.filter((anomaly) => anomaly.kind === 'volume_spike')).toHaveLength(0);
  });
});
