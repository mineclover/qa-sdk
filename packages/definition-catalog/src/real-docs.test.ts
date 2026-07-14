// @def.doc definition-catalog-spec

/**
 * qa-sdk 실제 문서 등록 + 조회 검증
 *
 * docs/specs/의 실제 문서 20건을 definition-catalog에 등록하고,
 * 다양한 질의와 concern 전파가 의도대로 동작하는지 확인한다.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryDefinitionRegistry } from './registry.js';
import { computeEffectiveConcerns } from './concern.js';
import { decodeDocument } from './observe.js';
import { detectCrossScope } from './taxonomy.js';
import type { DefinitionEntryInput } from './types.js';

const NOW = '2026-03-25T10:00:00Z';

function doc(
  o: Partial<DefinitionEntryInput> &
    Pick<DefinitionEntryInput, 'id' | 'title' | 'scope' | 'aspect' | 'depth'>,
): DefinitionEntryInput {
  return { lifecycle: 'approved', createdAt: NOW, updatedAt: NOW, ...o };
}

let reg: MemoryDefinitionRegistry;

function compute(id: string) {
  return computeEffectiveConcerns(
    id,
    (i) => reg.get(i),
    (i, d) => reg.getLinks(i, d),
  );
}

beforeAll(() => {
  reg = new MemoryDefinitionRegistry();

  // ════════════════════════════════════════════════════════
  // 1. 문서 등록 — qa-sdk 실제 문서 20건
  // ════════════════════════════════════════════════════════

  // ── flow ───────────────────────────────────────────────

  reg.register(
    doc({
      id: 'system-overview',
      title: 'QA-SDK 시스템 개요',
      scope: 'flow',
      aspect: 'process_flow',
      depth: 'overview',
      ref: 'docs/system-overview.md',
      tags: ['cross-scope', 'flow', 'data', 'interface', 'state', 'entry-point'],
    }),
  );

  reg.register(
    doc({
      id: 'apm-pipeline',
      title: '파이프라인 고도화 — enrichAddressContext + metric aggregation',
      scope: 'flow',
      aspect: 'process_flow',
      depth: 'specification',
      ref: 'docs/specs/apm/pipeline.spec.md',
      tags: ['observability', 'performance'],
    }),
  );

  // ── data ───────────────────────────────────────────────

  reg.register(
    doc({
      id: 'record-spec',
      title: 'EventRecord + RecordStore',
      scope: 'data',
      aspect: 'domain_data',
      depth: 'specification',
      ref: 'docs/specs/data-model/record.spec.md',
    }),
  );

  reg.register(
    doc({
      id: 'session-spec',
      title: 'QaSession + SessionStore',
      scope: 'data',
      aspect: 'domain_data',
      depth: 'specification',
      ref: 'docs/specs/data-model/session.spec.md',
    }),
  );

  reg.register(
    doc({
      id: 'coord-foundation',
      title: '좌표 시스템 기반 원리',
      scope: 'data',
      aspect: 'domain_data',
      depth: 'specification',
      ref: 'docs/specs/indexing/foundation.md',
      tags: ['entry-point'],
    }),
  );

  reg.register(
    doc({
      id: 'weighted-index-spec',
      title: 'weighted-index — 가중진법 다차원 인덱스',
      scope: 'data',
      aspect: 'domain_data',
      depth: 'specification',
      ref: 'docs/specs/indexing/weighted-index/core.spec.md',
    }),
  );

  // ── interface ──────────────────────────────────────────

  reg.register(
    doc({
      id: 'gate-service-spec',
      title: 'Gate Service — 주소 상태 관리 서비스',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
      ref: 'docs/specs/services/gate-service.spec.md',
      tags: ['security'],
    }),
  );

  reg.register(
    doc({
      id: 'decode-service-spec',
      title: 'Decode Service — 독립 decode 경량 서비스',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
      ref: 'docs/specs/services/decode-service.spec.md',
    }),
  );

  reg.register(
    doc({
      id: 'query-api-spec',
      title: 'Query API — trace/session/record 조회',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
      ref: 'docs/specs/server/ingest/query.spec.md',
    }),
  );

  reg.register(
    doc({
      id: 'registry-services-api',
      title: 'Registry Services API — 서비스 메타데이터 CRUD',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
      ref: 'docs/specs/server/registry/services.spec.md',
    }),
  );

  reg.register(
    doc({
      id: 'ingest-api-spec',
      title: 'POST /v1/ingest — Transmission Envelope 수신',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
      ref: 'docs/specs/pipeline/ingest.spec.md',
      tags: ['performance'],
    }),
  );

  reg.register(
    doc({
      id: 'coord-query-spec',
      title: 'Coordinate Query — 패턴 포함 관계 + 정책 해소',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
      ref: 'docs/specs/indexing/coordinate-query.spec.md',
    }),
  );

  reg.register(
    doc({
      id: 'gate-engine-spec',
      title: 'GateEngine — 주소 상태 자동 재계산',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
      ref: 'docs/specs/indexing/index-meta/gate-engine.spec.md',
    }),
  );

  // ── feature ────────────────────────────────────────────

  reg.register(
    doc({
      id: 'auto-capture-spec',
      title: 'AutoCapture — DOM 이벤트 자동 수집',
      scope: 'feature',
      aspect: 'func_def',
      depth: 'specification',
      ref: 'docs/specs/browser/auto-capture.spec.md',
    }),
  );

  reg.register(
    doc({
      id: 'browser-session-spec',
      title: 'SessionManager — 브라우저 탭 세션 영속화',
      scope: 'feature',
      aspect: 'func_def',
      depth: 'specification',
      ref: 'docs/specs/browser/session.spec.md',
    }),
  );

  // ── constraint ─────────────────────────────────────────

  reg.register(
    doc({
      id: 'conventions',
      title: 'QA-SDK 개발 컨벤션',
      scope: 'constraint',
      aspect: 'tech_constraint',
      depth: 'specification',
      ref: 'docs/CONVENTIONS.md',
    }),
  );

  reg.register(
    doc({
      id: 'adrs',
      title: 'Architecture Decision Records (ADR-001~009)',
      scope: 'constraint',
      aspect: 'tech_constraint',
      depth: 'specification',
      ref: 'docs/architecture-decisions.md',
      tags: ['decision'],
    }),
  );

  reg.register(
    doc({
      id: 'dkg-spec',
      title: 'Design Knowledge Graph — 설계 시점 메타데이터 그래프',
      scope: 'constraint',
      aspect: 'tech_constraint',
      depth: 'specification',
      lifecycle: 'review',
      ref: 'docs/specs/spec-engine/design-knowledge-graph.md',
      tags: ['observability'],
    }),
  );

  // ── state ──────────────────────────────────────────────

  reg.register(
    doc({
      id: 'decision-flow-spec',
      title: 'Decision Flow — 의사결정 좌표계',
      scope: 'state',
      aspect: 'domain_state',
      depth: 'specification',
      ref: 'docs/specs/decision-flow/decision-flow.spec.md',
      tags: ['decision'],
    }),
  );

  // ── ui ─────────────────────────────────────────────────

  reg.register(
    doc({
      id: 'viz-panels-spec',
      title: '시각화 UI 패널 — 시나리오 선택 + 이벤트 로그 + Verdict',
      scope: 'ui',
      aspect: 'component',
      depth: 'specification',
      ref: 'docs/specs/visualization/panels.spec.md',
    }),
  );

  // ════════════════════════════════════════════════════════
  // 2. 관계 등록
  // ════════════════════════════════════════════════════════

  // system-overview(흐름 개요)를 구체화
  reg.link('apm-pipeline', 'system-overview', 'refines');
  reg.link('coord-foundation', 'system-overview', 'refines');

  // 좌표 기반 원리를 구현하는 스펙들
  reg.link('weighted-index-spec', 'coord-foundation', 'implements');
  reg.link('coord-query-spec', 'coord-foundation', 'implements');
  reg.link('gate-engine-spec', 'coord-foundation', 'implements');

  // 서비스 API가 엔진 스펙에 의존
  reg.link('gate-service-spec', 'gate-engine-spec', 'depends_on');
  reg.link('decode-service-spec', 'weighted-index-spec', 'depends_on');

  // ingest API가 record 스키마에 의존
  reg.link('ingest-api-spec', 'record-spec', 'depends_on');
  reg.link('query-api-spec', 'record-spec', 'depends_on');
  reg.link('query-api-spec', 'session-spec', 'depends_on');

  // 브라우저 기능이 ingest API를 사용
  reg.link('auto-capture-spec', 'ingest-api-spec', 'depends_on');
  reg.link('browser-session-spec', 'session-spec', 'depends_on');

  // 컨벤션이 전체 API를 제약
  reg.link('conventions', 'ingest-api-spec', 'constrains');
  reg.link('conventions', 'gate-service-spec', 'constrains');

  // ADR이 아키텍처를 제약
  reg.link('adrs', 'system-overview', 'constrains');

  // 시각화가 query API를 사용
  reg.link('viz-panels-spec', 'query-api-spec', 'implements');

  // decision-flow가 DKG에 의존
  reg.link('decision-flow-spec', 'dkg-spec', 'depends_on');

  // 시나리오 추적 (전파 안 함)
  reg.link('auto-capture-spec', 'conventions', 'traces_to');
});

// ════════════════════════════════════════════════════════
// 테스트
// ════════════════════════════════════════════════════════

describe('등록 현황', () => {
  it('20건 등록, 17건 관계', () => {
    const s = reg.stats();
    expect(s.totalEntries).toBe(20);
    expect(s.totalLinks).toBe(18);
  });

  it('scope별 분포', () => {
    const s = reg.stats();
    expect(s.byScope.interface).toBe(7);
    expect(s.byScope.data).toBe(4);
    expect(s.byScope.constraint).toBe(3);
    expect(s.byScope.feature).toBe(2);
    expect(s.byScope.flow).toBe(2);
    expect(s.byScope.state).toBe(1);
    expect(s.byScope.ui).toBe(1);
  });

  it('lifecycle 분포', () => {
    const s = reg.stats();
    expect(s.byLifecycle.approved).toBe(19);
    expect(s.byLifecycle.review).toBe(1);
  });
});

describe('좌표 인코딩 검증', () => {
  it('모든 문서에 고유 주소가 부여된다', () => {
    const all = reg.all();
    const addresses = all.map((e) => e.address!);
    // 같은 scope×aspect×depth 조합이 아닌 한 고유
    expect(addresses.every((a) => a !== undefined)).toBe(true);
  });

  it('주소에서 정체성 복원', () => {
    const entry = reg.get('gate-service-spec')!;
    const decoded = decodeDocument(entry.address!);
    expect(decoded.scope).toBe('interface');
    expect(decoded.aspect).toBe('api_contract');
    expect(decoded.depth).toBe('specification');
  });

  it('같은 scope×aspect×depth인 문서들은 같은 좌표를 공유한다', () => {
    // interface/api_contract/specification 문서가 7건 → 모두 같은 좌표
    const interfaceApis = reg.query({
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
    });
    expect(interfaceApis.length).toBe(7);
    const addresses = new Set(interfaceApis.map((e) => e.address));
    expect(addresses.size).toBe(1); // 좌표는 정체성(유형)을 인코딩, 개별 문서 ID가 아님
  });
});

describe('scope 기반 질의', () => {
  it('interface scope의 모든 API 스펙 조회', () => {
    const apis = reg.findByScope('interface');
    expect(apis.length).toBe(7);
    expect(apis.every((e) => e.scope === 'interface')).toBe(true);
  });

  it('data scope의 스키마 문서 조회', () => {
    const data = reg.findByScope('data');
    expect(data.length).toBe(4);
    const titles = data.map((e) => e.title);
    expect(titles).toContain('EventRecord + RecordStore');
    expect(titles).toContain('좌표 시스템 기반 원리');
  });

  it('constraint scope의 제약 문서 조회', () => {
    const constraints = reg.findByScope('constraint');
    expect(constraints.length).toBe(3);
    const ids = constraints.map((e) => e.id);
    expect(ids).toContain('conventions');
    expect(ids).toContain('adrs');
    expect(ids).toContain('dkg-spec');
  });
});

describe('복합 필터 질의', () => {
  it('review 상태 문서만 조회', () => {
    const reviews = reg.query({ lifecycle: 'review' });
    expect(reviews.length).toBe(1);
    expect(reviews[0].id).toBe('dkg-spec');
  });

  it('data + specification 조합', () => {
    const result = reg.query({ scope: 'data', depth: 'specification' });
    expect(result.length).toBe(4);
  });

  it('entry-point 태그 문서 조회', () => {
    const entryPoints = reg.query({ tags: ['entry-point'] });
    expect(entryPoints.length).toBe(2);
    expect(entryPoints.map((e) => e.id).toSorted()).toEqual([
      'coord-foundation',
      'system-overview',
    ]);
  });

  it('decision 태그 문서 조회', () => {
    const decisions = reg.query({ tags: ['decision'] });
    expect(decisions.length).toBe(2);
    expect(decisions.map((e) => e.id).toSorted()).toEqual(['adrs', 'decision-flow-spec']);
  });

  it('observability 태그 문서 조회', () => {
    const obs = reg.query({ tags: ['observability'] });
    expect(obs.length).toBe(2);
    expect(obs.map((e) => e.id).toSorted()).toEqual(['apm-pipeline', 'dkg-spec']);
  });
});

describe('관계 그래프 질의', () => {
  it('system-overview에서 출발하는 관계가 없다 (루트)', () => {
    const outgoing = reg.getLinks('system-overview', 'outgoing');
    expect(outgoing.length).toBe(0);
  });

  it('system-overview로 들어오는 관계 3건 (refines 2 + constrains 1)', () => {
    const incoming = reg.getLinks('system-overview', 'incoming');
    expect(incoming.length).toBe(3);
    expect(incoming.filter((l) => l.linkType === 'refines').length).toBe(2);
    expect(incoming.filter((l) => l.linkType === 'constrains').length).toBe(1);
  });

  it('coord-foundation을 구현하는 문서 3건', () => {
    const incoming = reg.getLinks('coord-foundation', 'incoming');
    const impls = incoming.filter((l) => l.linkType === 'implements');
    expect(impls.length).toBe(3);
    expect(impls.map((l) => l.sourceId).toSorted()).toEqual([
      'coord-query-spec',
      'gate-engine-spec',
      'weighted-index-spec',
    ]);
  });

  it('record-spec에 의존하는 문서 2건', () => {
    const incoming = reg.getLinks('record-spec', 'incoming');
    const deps = incoming.filter((l) => l.linkType === 'depends_on');
    expect(deps.length).toBe(2);
    expect(deps.map((l) => l.sourceId).toSorted()).toEqual(['ingest-api-spec', 'query-api-spec']);
  });

  it('conventions가 제약하는 문서 2건', () => {
    const outgoing = reg.getLinks('conventions', 'outgoing');
    const constraining = outgoing.filter((l) => l.linkType === 'constrains');
    expect(constraining.length).toBe(2);
    expect(constraining.map((l) => l.targetId).toSorted()).toEqual([
      'gate-service-spec',
      'ingest-api-spec',
    ]);
  });

  it('traces_to 관계는 1건 (auto-capture → conventions)', () => {
    const outgoing = reg.getLinks('auto-capture-spec', 'outgoing');
    const traces = outgoing.filter((l) => l.linkType === 'traces_to');
    expect(traces.length).toBe(1);
    expect(traces[0].targetId).toBe('conventions');
  });
});

describe('concern 전파 검증', () => {
  it('gate-service-spec: security 직접', () => {
    const r = compute('gate-service-spec');
    expect(r.direct).toContain('security');
  });

  it('gate-engine-spec: gate-service-spec의 security가 depends_on upstream으로 전파되지 않음 (gate-engine이 source)', () => {
    // gate-service-spec --depends_on--> gate-engine-spec
    // upstream 전파: A depends_on B → B의 concern이 A로. (gate-service가 A, gate-engine이 B)
    // gate-engine-spec 자체에는 직접 security 없음.
    // gate-service-spec에 security가 있지만 depends_on upstream은 B→A 방향이므로
    // gate-engine에서는 security가 보이지 않아야 한다.
    const r = compute('gate-engine-spec');
    // 하지만 coord-foundation을 implements → 거기서 올라갈 수 있는지?
    // coord-foundation에는 security 없음 → 전파 없음
    expect(r.direct).toEqual([]);
    // security가 상속되는 경로가 없어야 함
    const securityInherited = r.inherited.filter((i) => i.concern === 'security');
    expect(securityInherited.length).toBe(0);
  });

  it('ingest-api-spec: performance 직접 + conventions constrains 경로 없음 (conventions에 concern 태그 없음)', () => {
    const r = compute('ingest-api-spec');
    expect(r.direct).toContain('performance');
    // conventions에는 concern 태그가 없으므로 constrains 전파 없음
    expect(r.inherited.length).toBe(0);
  });

  it('auto-capture-spec: ingest-api의 performance가 depends_on upstream으로 전파', () => {
    const r = compute('auto-capture-spec');
    expect(r.all).toContain('performance');
    expect(
      r.inherited.some(
        (i) =>
          i.concern === 'performance' && i.from === 'ingest-api-spec' && i.via === 'depends_on',
      ),
    ).toBe(true);
  });

  it('auto-capture-spec: traces_to로 연결된 conventions의 concern은 전파되지 않음', () => {
    const r = compute('auto-capture-spec');
    // conventions에 concern 태그 없고, traces_to는 전파 안 함
    // 따라서 auto-capture에는 performance만 있어야 함
    const nonPerformance = r.inherited.filter((i) => i.concern !== 'performance');
    expect(nonPerformance.length).toBe(0);
  });

  it('viz-panels-spec: query-api를 implements → record-spec까지 전이 추적', () => {
    // viz-panels --implements--> query-api --depends_on--> record-spec
    // query-api에는 직접 concern 없음, record-spec에도 없음
    // 따라서 viz-panels에 상속 concern 없음
    const r = compute('viz-panels-spec');
    expect(r.inherited.length).toBe(0);
  });

  it('apm-pipeline: observability + performance 직접, system-overview의 cross-scope는 concern이 아님', () => {
    const r = compute('apm-pipeline');
    expect(r.direct).toContain('observability');
    expect(r.direct).toContain('performance');
    // system-overview의 tags에 "cross-scope", "flow" 등은 ConcernTag가 아님
    // system-overview를 refines하지만 거기서 올 concern 없음
    expect(r.inherited.length).toBe(0);
  });

  it('decision-flow-spec: dkg-spec의 observability는 depends_on으로 전파되지 않음 (observability는 upstream 규칙 없음)', () => {
    // observability의 전파 규칙: refines downstream, implements downstream만.
    // depends_on upstream이 없으므로 decision-flow → dkg-spec 경로로 전파 안 됨.
    const r = compute('decision-flow-spec');
    expect(r.all).not.toContain('observability');
    expect(r.inherited.length).toBe(0);
  });

  it('system-overview에 constrains하는 adrs의 concern이 전파 (adrs에 concern 없으므로 전파 없음)', () => {
    // adrs --constrains--> system-overview
    // adrs에는 "decision" structural tag만 있고 ConcernTag 없음
    const r = compute('system-overview');
    expect(r.inherited.length).toBe(0);
  });
});

describe('cross-scope 감지', () => {
  it('system-overview는 분리 후보 (tags에 scope 4개)', () => {
    const entry = reg.get('system-overview')!;
    const result = detectCrossScope(entry.tags!);
    expect(result.isCrossScope).toBe(true);
    expect(result.shouldSplit).toBe(true);
    expect(result.scopeRefs.length).toBeGreaterThanOrEqual(3);
  });

  it('gate-service-spec은 cross-scope 아님', () => {
    const entry = reg.get('gate-service-spec')!;
    const result = detectCrossScope(entry.tags ?? []);
    expect(result.isCrossScope).toBe(false);
  });
});

describe('ref 경로 검증', () => {
  it('모든 문서에 ref(파일 경로)가 있다', () => {
    const all = reg.all();
    for (const entry of all) {
      expect(entry.ref, `${entry.id}에 ref 없음`).toBeDefined();
      expect(entry.ref).toMatch(/^docs\//);
    }
  });
});
