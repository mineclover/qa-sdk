// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import {
  createSegment,
  chainSegments,
  encodeBySegment,
  decodeBySegment,
  totalSize,
  collectTransitions,
  productToSegment,
  validateSegments,
} from './path-summation.js';
import type { PathSegment } from './catalog.types.js';

// ── 세그먼트 생성 ────────────────────────────────────

describe('createSegment', () => {
  it('size = shape의 곱', () => {
    const seg = createSegment('s1', ['a', 'b'], [3, 4], 0);
    expect(seg.size).toBe(12);
    expect(seg.addressOffset).toBe(0);
  });

  it('transition 포함', () => {
    const seg = createSegment('s1', ['a'], [3], 0, {
      transition: { eventKey: 'payment.process', prefixId: 'payment' },
    });
    expect(seg.transition!.eventKey).toBe('payment.process');
  });

  it('dims/shape 길이 불일치 → 에러', () => {
    expect(() => createSegment('s1', ['a', 'b'], [3], 0)).toThrow('길이 불일치');
  });
});

describe('chainSegments', () => {
  it('offset 자동 연접', () => {
    const segs = chainSegments([
      { segmentId: 's1', consumes: ['type', 'payment'], shape: [3, 4] },
      { segmentId: 's2', consumes: ['type', 'shipping'], shape: [3, 2] },
    ]);

    expect(segs[0].addressOffset).toBe(0);
    expect(segs[0].size).toBe(12);
    expect(segs[1].addressOffset).toBe(12);
    expect(segs[1].size).toBe(6);
  });
});

// ── 인코딩/디코딩 ───────────────────────────────────

describe('encodeBySegment + decodeBySegment', () => {
  const segments = chainSegments([
    { segmentId: 'type_payment', consumes: ['orderType', 'paymentMethod'], shape: [3, 4] },
    { segmentId: 'type_shipping', consumes: ['orderType', 'shippingOption'], shape: [3, 2] },
  ]);

  it('세그먼트별 인코딩', () => {
    // normal(0) × card(0) → 0
    expect(encodeBySegment(segments, 'type_payment', [0, 0])).toBe(0);
    // normal(0) × bank(1) → 1
    expect(encodeBySegment(segments, 'type_payment', [0, 1])).toBe(1);
    // express(1) × card(0) → 4
    expect(encodeBySegment(segments, 'type_payment', [1, 0])).toBe(4);
  });

  it('두 번째 세그먼트는 offset 적용', () => {
    // normal(0) × standard(0) → 12 (offset=12)
    expect(encodeBySegment(segments, 'type_shipping', [0, 0])).toBe(12);
    // express(1) × sameDay(1) → 15
    expect(encodeBySegment(segments, 'type_shipping', [1, 1])).toBe(15);
  });

  it('라운드트립: encode → decode', () => {
    for (const seg of segments) {
      for (let addr = seg.addressOffset; addr < seg.addressOffset + seg.size; addr++) {
        const decoded = decodeBySegment(segments, addr);
        const reEncoded = encodeBySegment(segments, decoded.segment.segmentId, decoded.coord);
        expect(reEncoded).toBe(addr);
      }
    }
  });

  it('디코딩 결과에 values 매핑 포함', () => {
    const decoded = decodeBySegment(segments, 5);
    expect(decoded.segment.segmentId).toBe('type_payment');
    expect(decoded.values.orderType).toBeDefined();
    expect(decoded.values.paymentMethod).toBeDefined();
  });

  it('범위 초과 주소 → 에러', () => {
    expect(() => decodeBySegment(segments, 18)).toThrow('속하지 않음');
    expect(() => decodeBySegment(segments, -1)).toThrow('속하지 않음');
  });

  it('존재하지 않는 세그먼트 → 에러', () => {
    expect(() => encodeBySegment(segments, 'no_exist', [0])).toThrow('없음');
  });
});

// ── totalSize ────────────────────────────────────────

describe('totalSize', () => {
  it('전곱 18 = 12 + 6', () => {
    const segs = chainSegments([
      { segmentId: 's1', consumes: ['a', 'b'], shape: [3, 4] },
      { segmentId: 's2', consumes: ['a', 'c'], shape: [3, 2] },
    ]);
    expect(totalSize(segs)).toBe(18);
  });

  it('빈 세그먼트 → 0', () => {
    expect(totalSize([])).toBe(0);
  });
});

// ── transition ───────────────────────────────────────

describe('collectTransitions', () => {
  it('전이 대상 수집', () => {
    const segs = chainSegments([
      { segmentId: 's1', consumes: ['a'], shape: [3], transition: { eventKey: 'payment.process' } },
      { segmentId: 's2', consumes: ['a'], shape: [2] },
      {
        segmentId: 's3',
        consumes: ['a'],
        shape: [2],
        transition: { eventKey: 'shipping.dispatch', prefixId: 'shipping' },
      },
    ]);

    const transitions = collectTransitions(segs);
    expect(transitions).toHaveLength(2);
    expect(transitions[0].eventKey).toBe('payment.process');
    expect(transitions[1].prefixId).toBe('shipping');
  });

  it('재귀 하위에서도 수집', () => {
    const child = createSegment('child', ['x'], [2], 0, {
      transition: { eventKey: 'deep.event' },
    });
    const parent = createSegment('parent', ['a'], [3], 0, {
      children: [child],
    });

    const transitions = collectTransitions([parent]);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].segmentId).toBe('child');
  });

  it('디코딩 결과에 transition 포함', () => {
    const segs = chainSegments([
      { segmentId: 's1', consumes: ['a'], shape: [3], transition: { eventKey: 'next.event' } },
    ]);
    const decoded = decodeBySegment(segs, 1);
    expect(decoded.transition!.eventKey).toBe('next.event');
  });
});

// ── productToSegment ─────────────────────────────────

describe('productToSegment', () => {
  it('전곱 → 단일 세그먼트 변환', () => {
    const seg = productToSegment(
      {
        env: { entries: ['dev', 'staging', 'prod'] },
        region: { entries: ['kr', 'us'] },
      },
      ['env', 'region'],
    );

    expect(seg.segmentId).toBe('product');
    expect(seg.shape).toEqual([3, 2]);
    expect(seg.size).toBe(6);
    expect(seg.addressOffset).toBe(0);
  });
});

// ── validateSegments ─────────────────────────────────

describe('validateSegments', () => {
  it('정상 세그먼트 → 에러 0', () => {
    const segs = chainSegments([
      { segmentId: 's1', consumes: ['a'], shape: [3] },
      { segmentId: 's2', consumes: ['b'], shape: [4] },
    ]);
    expect(validateSegments(segs)).toHaveLength(0);
  });

  it('중복 ID → 에러', () => {
    const segs = chainSegments([
      { segmentId: 'dup', consumes: ['a'], shape: [3] },
      { segmentId: 'dup', consumes: ['b'], shape: [4] },
    ]);
    const errors = validateSegments(segs);
    expect(errors.some((e) => e.includes('중복'))).toBe(true);
  });

  it('offset 불연속 → 에러', () => {
    const segs: PathSegment[] = [
      createSegment('s1', ['a'], [3], 0),
      createSegment('s2', ['b'], [4], 10), // gap
    ];
    const errors = validateSegments(segs);
    expect(errors.some((e) => e.includes('offset'))).toBe(true);
  });
});

// ── 재귀 세그먼트 ────────────────────────────────────

describe('재귀 세그먼트', () => {
  it('하위 세그먼트에서 인코딩/디코딩', () => {
    const child1 = createSegment('card_gateway', ['gateway'], [2], 0);
    const child2 = createSegment('bank_verify', ['verification'], [3], 2);
    const parent = createSegment('payment', ['method'], [5], 0, {
      children: [child1, child2],
    });

    // child1: gateway=0 → 0, gateway=1 → 1
    expect(encodeBySegment([parent], 'card_gateway', [0])).toBe(0);
    expect(encodeBySegment([parent], 'card_gateway', [1])).toBe(1);

    // child2: verification=0 → 2, verification=2 → 4
    expect(encodeBySegment([parent], 'bank_verify', [0])).toBe(2);
    expect(encodeBySegment([parent], 'bank_verify', [2])).toBe(4);

    // 디코딩: 주소 3 → child2의 verification=1
    const decoded = decodeBySegment([parent], 3);
    expect(decoded.segment.segmentId).toBe('bank_verify');
    expect(decoded.values.verification).toBe(1);
  });

  it('이벤트 전이 + 재귀 복합', () => {
    const child = createSegment('card_3ds', ['require_3ds'], [2], 0, {
      transition: { eventKey: 'auth.3ds.verify' },
    });
    const parent = createSegment('payment_card', ['card_type'], [3], 0, {
      children: [child],
    });

    const decoded = decodeBySegment([parent], 1);
    expect(decoded.segment.segmentId).toBe('card_3ds');
    expect(decoded.transition!.eventKey).toBe('auth.3ds.verify');
  });
});
