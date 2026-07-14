/**
 * DSL 종단 E2E: SDK DSL 모드 → address_context → 집계 → 분석
 */

import { describe, it, expect } from 'vitest';
import { DEMO_CATALOG } from 'demo-snapshot';
import { DEMO_DKG_CONFIG } from 'demo-dkg-config';
import { createQaContext } from '@qa-sdk/context';
import { catalogToPrefixSpecs } from '@qa-sdk/spec-core';
import { auditCoverage, traceFlows } from 'dkg';
import { bootstrapDkg } from 'dkg-enrichment';
import {
  aggregateUsageData,
  analyzeCollectionHealth,
  type AddressContextRecord,
  aggregateByDsl,
  aggregateByCategory,
  aggregateByService,
} from '@qa-sdk/convergence';

type ConvergenceEntryUsage = {
  readonly axisId: string;
  readonly entry: string;
  readonly count: number;
};

type DkgEntryUsage = {
  readonly prefixId: string;
  readonly entryId: string;
  readonly count: number;
};

function toDkgEntryUsages(entryUsages: readonly ConvergenceEntryUsage[]): DkgEntryUsage[] {
  const prefixes = Object.values(DEMO_CATALOG.prefixes) as Array<{
    readonly id: string;
    readonly dims: Record<string, { readonly kind: string; readonly axisId?: string }>;
  }>;

  return entryUsages.flatMap((usage) =>
    prefixes
      .filter((prefix) =>
        Object.values(prefix.dims).some(
          (dim) => dim.kind === 'axis' && dim.axisId === usage.axisId,
        ),
      )
      .map((prefix) => ({
        prefixId: prefix.id,
        entryId: usage.entry,
        count: usage.count,
      })),
  );
}

describe('DSL 종단 E2E', () => {
  const qa = createQaContext({
    env: 'prod',
    region: 'asia',
    service: 'shopping-web',
    namespace: 'shop',
    catalog: DEMO_CATALOG,
    executionMode: 'test',
    executionId: 'e2e-dsl',
  });

  const session = qa.useDsl('dsl-checkout', [
    'page_view',
    'endpoint',
    'flow_point',
    'order_event',
    'permission',
  ]);

  it('1. DSL track → 집계 → 건전성 100%', () => {
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 100; i++) {
      const result = session.track({
        page_view: { page: 'checkout', locale: 'ko', userType: 'member' },
        endpoint: { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
        flow_point: {
          flow_name: 'checkout',
          flow_step: Math.random() < 0.8 ? 'success' : 'failure',
          flow_variant: 'default',
        },
      });
      records.push({
        address_context: result.address_context,
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        execution_mode: 'test',
        execution_id: 'e2e-dsl',
        trace_id: `t-${i}`,
        session_id: 'e2e-session',
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const health = analyzeCollectionHealth(DEMO_CATALOG, records);

    console.log(`\n══ DSL E2E ══`);
    console.log(
      `  records=${usage.sourceStats!.totalRecords} health=${(health.healthRate * 100).toFixed(0)}%`,
    );
    console.log(`  mode=${JSON.stringify(usage.sourceStats!.byExecutionMode)}`);

    expect(health.healthRate).toBe(1);
    expect(health.orphans.length).toBe(0);
    expect(usage.sourceStats!.byExecutionMode.test).toBe(100);
  });

  it('2. coverage-audit → dormant + OBS/DEC 생성', () => {
    const records: AddressContextRecord[] = [];
    for (let i = 0; i < 200; i++) {
      const r = session.track({
        endpoint: { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
        flow_point: { flow_name: 'checkout', flow_step: 'success', flow_variant: 'default' },
      });
      records.push({
        address_context: r.address_context,
        timestamp: new Date(2026, 2, 20, 1, 0, i).toISOString(),
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const graph = bootstrapDkg({
      catalog: DEMO_CATALOG,
      config: DEMO_DKG_CONFIG,
      date: '2026-03-20',
    });
    const audit = auditCoverage(DEMO_CATALOG, graph, toDkgEntryUsages(usage.entryUsages), [], {
      date: '2026-03-20',
    });

    console.log(
      `  coverage: dormant=${audit.report.dormantCount} phantom=${audit.report.phantomCount}`,
    );
    console.log(`  OBS=${audit.observations.length} DEC=${audit.decisions.length}`);

    expect(audit.report.dormantCount).toBeGreaterThan(0);
    expect(audit.observations.length).toBeGreaterThan(0);
  });

  it('3. flow-trace — DSL 우회 시 invariant 위반 감지 (의도적 시나리오)', () => {
    // 시나리오: 개발자가 useDsl()을 쓰지 않고 qa.encode()로 직접 인코딩했을 때
    // page_view 없이 flow_point만 보내는 상황을 시뮬레이션.
    // 실 서비스에서는 봇/크롤러 접근 또는 DSL 미적용 코드에서 발생 가능.
    const records: AddressContextRecord[] = [];

    // 정상 50건: DSL session 사용 → page_view + flow_point 모두 포함
    for (let i = 0; i < 50; i++) {
      const r = session.track({
        page_view: { page: 'checkout', locale: 'ko', userType: 'member' },
        flow_point: { flow_name: 'checkout', flow_step: 'success', flow_variant: 'default' },
      });
      records.push({
        address_context: r.address_context,
        timestamp: new Date(2026, 2, 20, 2, 0, i).toISOString(),
      });
    }

    // 위반 20건: DSL 우회 — qa.encode() 직접 사용, page_view 누락
    for (let i = 0; i < 20; i++) {
      const fp = qa.encode('flow_point', {
        flow_name: 'checkout',
        flow_step: 'success',
        flow_variant: 'default',
      });
      records.push({
        address_context: { flow_point: fp },
        timestamp: new Date(2026, 2, 20, 3, 0, i).toISOString(),
      });
    }

    const graph = bootstrapDkg({
      catalog: DEMO_CATALOG,
      config: DEMO_DKG_CONFIG,
      date: '2026-03-20',
    });
    const trace = traceFlows(graph, records, { date: '2026-03-20' });

    console.log(`  flow-trace: ${trace.summary}`);

    expect(trace.violations.length).toBeGreaterThan(0);
    expect(trace.observations.length).toBeGreaterThan(0);
  });

  it('4. 분기 지점/결과 수집 — flow_step 분포 + verdict_result 분포', () => {
    const records: AddressContextRecord[] = [];

    // checkout 흐름: success 70%, failure 20%, timeout 10%
    const outcomes = [
      { step: 'success', weight: 70 },
      { step: 'failure', weight: 20 },
      { step: 'timeout', weight: 10 },
    ];

    for (let i = 0; i < 300; i++) {
      const rand = Math.random() * 100;
      const step = rand < 70 ? 'success' : rand < 90 ? 'failure' : 'timeout';

      const r = session.track({
        page_view: { page: 'checkout', locale: 'ko', userType: 'member' },
        endpoint: { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
        flow_point: { flow_name: 'checkout', flow_step: step, flow_variant: 'default' },
      });
      records.push({
        address_context: r.address_context,
        timestamp: new Date(2026, 2, 20, 4, 0, i).toISOString(),
        execution_mode: 'test',
        session_id: 'branch-test',
        event_key: `checkout.${step}`,
      });
    }

    // pipeline_point로 분기 결과도 추적
    for (let i = 0; i < 100; i++) {
      const verdict = Math.random() < 0.85 ? 'pass' : Math.random() < 0.5 ? 'fail' : 'warn';
      const ppAddr = qa.encode('pipeline_point', {
        pipeline_phase: 'verdict',
        validation_mode: 'strict',
        verdict_result: verdict,
        temporal_strategy: 'span_local',
      });
      records.push({
        address_context: { pipeline_point: ppAddr },
        timestamp: new Date(2026, 2, 20, 5, 0, i).toISOString(),
        execution_mode: 'test',
        event_key: `verdict.${verdict}`,
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);

    // 분기 지점별 분포 추출
    const flowStepEntries = usage.entryUsages.filter((e) => e.axisId === 'flow_step');
    const verdictEntries = usage.entryUsages.filter((e) => e.axisId === 'verdict_result');
    const eventKeys = usage.sourceStats!.eventKeys;

    console.log(`\n══ 분기 수집 검증 ══`);
    console.log(`  records: ${usage.sourceStats!.totalRecords}`);

    console.log(`\n  [분기 지점: flow_step]`);
    for (const e of flowStepEntries.toSorted((a, b) => b.count - a.count)) {
      const pct = ((e.count / 300) * 100).toFixed(1);
      console.log(`    ${e.entry.padEnd(10)} ${e.count}건 (${pct}%)`);
    }

    console.log(`\n  [분기 결과: verdict_result]`);
    for (const e of verdictEntries.toSorted((a, b) => b.count - a.count)) {
      const pct = ((e.count / 100) * 100).toFixed(1);
      console.log(`    ${e.entry.padEnd(10)} ${e.count}건 (${pct}%)`);
    }

    console.log(`\n  [이벤트 키 분포]`);
    const keyGroups = new Map<string, number>();
    for (const r of records) {
      if (r.event_key) keyGroups.set(r.event_key, (keyGroups.get(r.event_key) ?? 0) + 1);
    }
    for (const [key, count] of [...keyGroups.entries()].toSorted((a, b) => b[1] - a[1])) {
      console.log(`    ${key.padEnd(20)} ${count}건`);
    }

    // 검증: 분기가 수집됨
    expect(flowStepEntries.length).toBe(3); // success, failure, timeout
    expect(flowStepEntries.find((e) => e.entry === 'success')!.count).toBeGreaterThan(150);
    expect(flowStepEntries.find((e) => e.entry === 'failure')!.count).toBeGreaterThan(30);
    expect(flowStepEntries.find((e) => e.entry === 'timeout')!.count).toBeGreaterThan(10);

    // verdict도 수집됨
    expect(verdictEntries.length).toBeGreaterThanOrEqual(2);
    expect(verdictEntries.find((e) => e.entry === 'pass')!.count).toBeGreaterThan(50);

    // event_key에서 분기별 카운트 추적 가능
    expect(eventKeys).toContain('checkout.success');
    expect(eventKeys).toContain('checkout.failure');
    expect(eventKeys).toContain('checkout.timeout');
    expect(eventKeys).toContain('verdict.pass');
  });

  it('5. 영역 분리 — DSL별 / category별 / 서비스별 독립 집계', () => {
    const records: AddressContextRecord[] = [];

    // dsl-checkout 영역: checkout 흐름 150건
    for (let i = 0; i < 150; i++) {
      const step = Math.random() < 0.8 ? 'success' : 'failure';
      const r = session.track({
        page_view: { page: 'checkout', locale: 'ko', userType: 'member' },
        endpoint: { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
        flow_point: { flow_name: 'checkout', flow_step: step, flow_variant: 'default' },
      });
      records.push({
        address_context: r.address_context,
        timestamp: new Date(2026, 2, 20, 6, 0, i).toISOString(),
        event_key: `checkout.${step}`,
      });
    }

    // dsl-infra 영역: deploy + health 50건
    const infraSession = qa.useDsl('dsl-infra', ['deploy_event', 'health_event', 'endpoint']);
    for (let i = 0; i < 50; i++) {
      const ppAddr = qa.encode('pipeline_point', {
        pipeline_phase: 'verdict',
        validation_mode: 'strict',
        verdict_result: 'pass',
        temporal_strategy: 'span_local',
      });
      records.push({
        address_context: { pipeline_point: ppAddr },
        timestamp: new Date(2026, 2, 20, 7, 0, i).toISOString(),
        event_key: 'verdict.pass',
      });
    }

    // DSL별 분리
    const dslMembers = new Map<string, readonly string[]>([
      ['dsl-checkout', ['page_view', 'endpoint', 'flow_point', 'order_event', 'permission']],
      [
        'dsl-pipeline',
        ['pipeline_point', 'data_policy', 'engine_event', 'schema_event', 'endpoint'],
      ],
    ]);
    const byDsl = aggregateByDsl(DEMO_CATALOG, records, dslMembers);

    console.log(`\n══ 영역 분리: DSL별 ══`);
    console.log(`  ${byDsl.summary}`);
    for (const scope of byDsl.scopes) {
      console.log(`  [${scope.scopeKey}] ${scope.recordCount}건`);
    }
    for (const b of byDsl.branches) {
      console.log(
        `  분기 ${b.axisId}: ${b.entries.map((e) => `${e.entry}=${e.count}(${e.pct.toFixed(0)}%)`).join(', ')}`,
      );
    }

    expect(byDsl.scopes.length).toBeGreaterThanOrEqual(2);

    // Category별 분리
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const catMap = new Map(specs.map((s) => [s.id, s.schema?.category ?? 'entity']));
    const byCat = aggregateByCategory(DEMO_CATALOG, records, catMap);

    console.log(`\n══ 영역 분리: Category별 ══`);
    for (const scope of byCat.scopes) {
      console.log(`  [${scope.scopeKey}] ${scope.recordCount}건`);
    }

    // page_view(observation) + pipeline_point(observation) → 같은 category로 합쳐짐
    expect(byCat.scopes.length).toBeGreaterThanOrEqual(1);

    // 서비스별 분리
    const bySvc = aggregateByService(DEMO_CATALOG, records);

    console.log(`\n══ 영역 분리: Service별 ══`);
    for (const scope of bySvc.scopes) {
      console.log(`  [${scope.scopeKey}] ${scope.recordCount}건`);
    }

    expect(bySvc.scopes.length).toBeGreaterThanOrEqual(1);
  });

  it('6. 비멤버 차단 + 경고', () => {
    const r = session.track({
      endpoint: { resource_type: 'api', http_method: 'GET', api_version: 'v1' },
      deploy_event: { deploy_action: 'deploy' },
    });

    expect(r.address_context.deploy_event).toBeUndefined();
    expect(r.warnings.some((w) => w.includes('멤버가 아닙니다'))).toBe(true);
  });
});
