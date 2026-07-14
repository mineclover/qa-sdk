import { describe, it, expect } from 'vitest';
import type { CognitivePhase, GateDependency, GateWeight } from 'decision-flow';
import type { DecisionFile } from '../src/decision-file.js';
import { toFlowSchema, extractEvidence } from '../src/to-flow-schema.js';

function decision(overrides: {
  meta?: Partial<DecisionFile['meta']>;
  purpose?: string;
  options?: Array<{ id: string; body: string }>;
  evidence?: DecisionFile['markers']['evidence'];
  outcome?: string;
  phase?: CognitivePhase;
  weight?: GateWeight;
  dependsOn?: GateDependency[];
}): DecisionFile {
  return {
    meta: {
      id: 'lesson-builder.layer.cue',
      subject: 'tax:lesson-builder-content:layer.cue',
      lifecycle: 'review',
      created: '2026-05-22T00:00:00Z',
      updated: '2026-05-22T00:00:00Z',
      ...overrides.meta,
    },
    markers: {
      purpose: overrides.purpose,
      options: overrides.options ?? [],
      evidence: overrides.evidence ?? [],
      outcome: overrides.outcome,
      phase: overrides.phase,
      weight: overrides.weight,
      dependsOn: overrides.dependsOn ?? [],
      gates: [],
    },
    body: '',
  };
}

describe('toFlowSchema', () => {
  it('기본 매핑: meta + purpose + 단일 gate', () => {
    const schema = toFlowSchema(decision({ purpose: 'interaction 경계 정의 필요' }));
    expect(schema.id).toBe('lesson-builder.layer.cue');
    expect(schema.name).toContain('layer.cue');
    expect(schema.description).toBe('interaction 경계 정의 필요');
    expect(schema.version).toBe('1');
    expect(schema.gates).toHaveLength(1);
    expect(schema.gates[0].id).toBe('decide');
    expect(schema.gates[0].phase).toBe('decide');
    expect(schema.gates[0].weight).toBe('tactical');
    expect(schema.gates[0].branches).toEqual([]);
    expect(schema.unit?.topic).toBe('tax:lesson-builder-content:layer.cue');
    expect(schema.unit?.objective).toBe('interaction 경계 정의 필요');
    expect(schema.unit?.successCriteria).toEqual([]);
  });

  it('options → branches', () => {
    const schema = toFlowSchema(
      decision({
        options: [
          { id: 'cue-includes', body: 'Cue가 포함' },
          { id: 'beat-separate', body: 'Beat을 분리' },
        ],
      }),
    );
    expect(schema.gates[0].branches).toEqual([
      { id: 'cue-includes', label: 'Cue가 포함' },
      { id: 'beat-separate', label: 'Beat을 분리' },
    ]);
  });

  it('option body 빈 문자열 → id를 label로', () => {
    const schema = toFlowSchema(decision({ options: [{ id: 'fallback', body: '' }] }));
    expect(schema.gates[0].branches?.[0].label).toBe('fallback');
  });

  it('evidence kind 중복 제거 + requiredEvidence', () => {
    const schema = toFlowSchema(
      decision({
        evidence: [
          { kind: 'data', weight: 1, content: 'x', source: '' },
          { kind: 'precedent', weight: 0.8, content: 'y', source: '' },
          { kind: 'data', weight: 0.5, content: 'z', source: '' },
        ],
      }),
    );
    expect(schema.gates[0].requiredEvidence).toEqual(['data', 'precedent']);
  });

  it('evidence 0건 → requiredEvidence undefined', () => {
    const schema = toFlowSchema(decision({}));
    expect(schema.gates[0].requiredEvidence).toBeUndefined();
  });

  it('lifecycle approved + outcome → outcomes[1]', () => {
    const schema = toFlowSchema(
      decision({
        meta: { lifecycle: 'approved' },
        outcome: 'Beat을 별도 entry로 분리',
      }),
    );
    expect(schema.outcomes).toEqual([{ id: 'approved', label: 'Beat을 별도 entry로 분리' }]);
  });

  it('lifecycle review + outcome 있어도 outcomes undefined (결정 미완료)', () => {
    const schema = toFlowSchema(decision({ meta: { lifecycle: 'review' }, outcome: '임시' }));
    expect(schema.outcomes).toBeUndefined();
  });

  it("purpose 누락 → '(목적 미정)' default", () => {
    const schema = toFlowSchema(decision({}));
    expect(schema.description).toBe('(목적 미정)');
    expect(schema.unit?.objective).toBe('(목적 미정)');
  });

  it('phase/weight 마커 있으면 default 대신 사용', () => {
    const schema = toFlowSchema(decision({ phase: 'evaluate', weight: 'core' }));
    expect(schema.gates[0].phase).toBe('evaluate');
    expect(schema.gates[0].weight).toBe('core');
  });

  it('phase/weight 마커 없으면 default(decide/tactical)', () => {
    const schema = toFlowSchema(decision({}));
    expect(schema.gates[0].phase).toBe('decide');
    expect(schema.gates[0].weight).toBe('tactical');
  });

  it('dependsOn → gate.affects 매핑', () => {
    const schema = toFlowSchema(
      decision({
        dependsOn: [
          { gateId: 'scope-mode', kind: 'constrains' },
          { gateId: 'architecture', kind: 'enables' },
        ],
      }),
    );
    expect(schema.gates[0].affects).toEqual([
      { gateId: 'scope-mode', kind: 'constrains' },
      { gateId: 'architecture', kind: 'enables' },
    ]);
  });

  it('dependsOn 비어있으면 affects undefined', () => {
    const schema = toFlowSchema(decision({}));
    expect(schema.gates[0].affects).toBeUndefined();
  });

  it('markers.gates 채워졌으면 multi-gate N gates 반환', () => {
    const file = decision({});
    file.markers.gates = [
      {
        id: 'risk',
        options: [
          { id: 'low', body: '낮음' },
          { id: 'high', body: '높음' },
        ],
        evidence: [{ kind: 'data', weight: 0.5, content: 'x', source: '' }],
        dependsOn: [],
        phase: 'evaluate',
        weight: 'core',
      },
      {
        id: 'scope',
        options: [{ id: 'expand', body: '확장' }],
        evidence: [],
        dependsOn: [{ gateId: 'risk', kind: 'constrains' }],
      },
    ];
    const schema = toFlowSchema(file);
    expect(schema.gates).toHaveLength(2);
    expect(schema.gates[0].id).toBe('risk');
    expect(schema.gates[0].phase).toBe('evaluate');
    expect(schema.gates[0].weight).toBe('core');
    expect(schema.gates[0].branches).toHaveLength(2);
    expect(schema.gates[0].requiredEvidence).toEqual(['data']);
    expect(schema.gates[1].id).toBe('scope');
    expect(schema.gates[1].phase).toBe('decide'); // default
    expect(schema.gates[1].weight).toBe('tactical'); // default
    expect(schema.gates[1].affects).toEqual([{ gateId: 'risk', kind: 'constrains' }]);
  });
});

describe('extractEvidence', () => {
  it('markers.evidence를 그대로 반환 (source 보존)', () => {
    const evidence = extractEvidence(
      decision({
        evidence: [
          { kind: 'data', weight: 1, content: 'x', source: '' },
          { kind: 'precedent', weight: 0.8, content: 'y', source: 'fixed' },
        ],
      }),
      { sourcePath: '/path/to/file.md' },
    );
    expect(evidence).toEqual([
      { kind: 'data', weight: 1, content: 'x', source: '/path/to/file.md' },
      { kind: 'precedent', weight: 0.8, content: 'y', source: 'fixed' },
    ]);
  });

  it('sourcePath 없으면 빈 문자열', () => {
    const evidence = extractEvidence(
      decision({
        evidence: [{ kind: 'data', weight: 1, content: 'x', source: '' }],
      }),
    );
    expect(evidence[0].source).toBe('');
  });
});
