import { describe, expect, it } from 'vitest';
import {
  encodeDecisionEvent,
  encodeDecisionPath,
  encodeEscalation,
  encodeModelApplication,
  encodeForcingResponse,
  decodeObservedEvent,
  serializeObservedEvent,
  parseAndDecodeAddress,
  DECISION_CATALOG,
  DECISION_PREFIX_IDS,
  DECISION_AXIS_IDS,
  DECISION_AXES,
  discretizeConfidence,
} from './index.js';
import type { GateSelection, FlowInstance } from './types.js';

// ─── 카탈로그 구조 검증 ──────────────────────────────────

describe('DECISION_CATALOG', () => {
  it('11개 축이 정의되어 있다', () => {
    expect(DECISION_AXIS_IDS).toHaveLength(11);
  });

  it('5개 prefix가 정의되어 있다', () => {
    expect(DECISION_PREFIX_IDS).toHaveLength(5);
    expect(DECISION_PREFIX_IDS).toContain('decision_event');
    expect(DECISION_PREFIX_IDS).toContain('decision_path');
    expect(DECISION_PREFIX_IDS).toContain('escalation_event');
    expect(DECISION_PREFIX_IDS).toContain('model_apply');
    expect(DECISION_PREFIX_IDS).toContain('forcing_response');
  });

  it('모든 prefix의 dims가 참조하는 axisId가 axes에 존재한다', () => {
    for (const [pid, prefix] of Object.entries(DECISION_CATALOG.prefixes)) {
      for (const [label, dim] of Object.entries(prefix.dims)) {
        if (dim.kind === 'axis') {
          expect(
            DECISION_CATALOG.axes[dim.axisId],
            `prefix "${pid}" dim "${label}" references missing axis "${dim.axisId}"`,
          ).toBeDefined();
        }
      }
    }
  });

  it('모든 축의 capacity가 nextPowerOf2(entries * 2) 이상이다', () => {
    for (const [axisId, axis] of Object.entries(DECISION_AXES)) {
      const v1 = axis.versions.v1;
      const minCapacity = nextPowerOf2(v1.entries.length * 2);
      expect(
        v1.capacity! >= minCapacity,
        `axis "${axisId}": capacity ${v1.capacity} < required ${minCapacity} (entries: ${v1.entries.length})`,
      ).toBe(true);
    }
  });
});

// ─── 관찰 이벤트 인코딩/디코딩 라운드트립 ────────────────

describe('observe roundtrip', () => {
  it('decision_event 라운드트립', () => {
    const sel: GateSelection = {
      gateId: 'risk',
      branchId: 'high',
      evidence: [{ kind: 'data', source: 'scan', content: '외부 API', weight: 0.9 }],
      confidence: 0.85,
      timestamp: '2026-03-23T10:00:00.000Z',
      durationMs: 5000,
    };

    const event = encodeDecisionEvent('ceo_review', 'evaluate', sel);
    expect(event.prefix).toBe('decision_event');
    expect(event.raw.flow_type).toBe('ceo_review');
    expect(event.raw.cognitive_phase).toBe('evaluate');
    expect(event.raw.evidence_kind).toBe('data');
    expect(event.raw.confidence_band).toBe('high');

    const decoded = decodeObservedEvent('decision_event', event.address);
    expect(decoded).toEqual(event.raw);
  });

  it('decision_path 라운드트립', () => {
    const instance: FlowInstance = {
      id: 'test-1',
      schemaId: 'ceo_review',
      schemaVersion: 'v1',
      status: 'completed',
      context: {},
      selections: [],
      startedAt: '2026-03-23T10:00:00.000Z',
      completedAt: '2026-03-23T11:00:00.000Z',
    };

    const event = encodeDecisionPath('ceo_review', instance, 'expansion');
    expect(event.prefix).toBe('decision_path');

    const decoded = decodeObservedEvent('decision_path', event.address);
    expect(decoded.flow_type).toBe('ceo_review');
    expect(decoded.decision_outcome).toBe('completed');
    expect(decoded.scope_mode).toBe('expansion');
  });

  it('escalation_event 라운드트립', () => {
    const event = encodeEscalation('code_review', 'taste', 'decide');
    expect(event.prefix).toBe('escalation_event');

    const decoded = decodeObservedEvent('escalation_event', event.address);
    expect(decoded.flow_type).toBe('code_review');
    expect(decoded.escalation_type).toBe('taste');
    expect(decoded.cognitive_phase).toBe('decide');
  });

  it('model_apply 라운드트립', () => {
    const event = encodeModelApplication('bezos_doors', 'one_way', 'critical');
    expect(event.prefix).toBe('model_apply');

    const decoded = decodeObservedEvent('model_apply', event.address);
    expect(decoded.mental_model).toBe('bezos_doors');
    expect(decoded.reversibility).toBe('one_way');
    expect(decoded.magnitude).toBe('critical');
  });

  it('forcing_response 라운드트립', () => {
    const event = encodeForcingResponse('demand_reality', 'data', 0.9);
    expect(event.prefix).toBe('forcing_response');

    const decoded = decodeObservedEvent('forcing_response', event.address);
    expect(decoded.forcing_question).toBe('demand_reality');
    expect(decoded.evidence_kind).toBe('data');
    expect(decoded.confidence_band).toBe('exact'); // 0.9 → exact
  });
});

// ─── 직렬화/파싱 ─────────────────────────────────────────

describe('serialization', () => {
  it('SemanticAddress 형식 직렬화 + 파싱', () => {
    const event = encodeModelApplication('munger_inversion', 'two_way', 'moderate');
    const serialized = serializeObservedEvent(event);
    expect(serialized).toMatch(/^model_apply:v1:\d+$/);

    const parsed = parseAndDecodeAddress(serialized);
    expect(parsed.prefix).toBe('model_apply');
    expect(parsed.version).toBe('v1');
    expect(parsed.decoded.mental_model).toBe('munger_inversion');
    expect(parsed.decoded.reversibility).toBe('two_way');
    expect(parsed.decoded.magnitude).toBe('moderate');
  });

  it('잘못된 형식은 에러', () => {
    expect(() => parseAndDecodeAddress('bad-format')).toThrow('잘못된 형식');
  });
});

// ─── confidence 이산화 ───────────────────────────────────

describe('discretizeConfidence', () => {
  it('0.9 이상 → exact', () => expect(discretizeConfidence(0.95)).toBe('exact'));
  it('0.7-0.89 → high', () => expect(discretizeConfidence(0.75)).toBe('high'));
  it('0.4-0.69 → medium', () => expect(discretizeConfidence(0.5)).toBe('medium'));
  it('0.39 이하 → low', () => expect(discretizeConfidence(0.2)).toBe('low'));
});

// ─── 유틸 ────────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
