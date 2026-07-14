// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 경로 합산 prefix 실사용 예시
 *
 * 주문 처리 시스템의 이벤트 분기를 카탈로그에 등록하고
 * 인코딩/디코딩/전이 추적을 수행한다.
 */
import { describe, it, expect } from 'vitest';
import type { PrefixDef, PathSegment } from './catalog.types.js';
import {
  createSegment,
  chainSegments,
  encodeBySegment,
  decodeBySegment,
  totalSize,
  collectTransitions,
  productToSegment,
} from './path-summation.js';

// ═══════════════════════════════════════════════════════
// 예시 1: 기존 전곱 prefix → 합산 단일 세그먼트로 표현
// ═══════════════════════════════════════════════════════

describe('예시 1 — 전곱 prefix (tracking)', () => {
  // 기존 전곱 방식의 tracking prefix
  const trackingPrefix: PrefixDef = {
    id: 'tracking',
    name: '트래킹',
    labels: ['trackAction', 'page', 'userType'],
    dims: {
      trackAction: { kind: 'axis', axisId: 'track_action' },
      page: { kind: 'axis', axisId: 'page' },
      userType: { kind: 'axis', axisId: 'user_type' },
    },
    versions: [
      { version: 'v1', axisVersions: { track_action: 'v1', page: 'v1', user_type: 'v1' } },
    ],
    addressModel: 'product', // 전곱 — 기존과 동일
  };

  it('전곱을 단일 세그먼트로 변환', () => {
    const seg = productToSegment(
      {
        trackAction: { entries: ['view', 'click', 'submit', 'navigate', 'purchase'] },
        page: { entries: ['home', 'product', 'cart', 'checkout', 'login'] },
        userType: { entries: ['guest', 'member', 'admin'] },
      },
      trackingPrefix.labels,
    );

    // 5 × 5 × 3 = 75 주소 (전곱)
    expect(seg.size).toBe(75);
    expect(seg.segmentId).toBe('product');

    // 인코딩: view(0) × home(0) × guest(0) → 0
    expect(encodeBySegment([seg], 'product', [0, 0, 0])).toBe(0);

    // 인코딩: click(1) × product(1) × member(1) → 1*15 + 1*3 + 1 = 19
    expect(encodeBySegment([seg], 'product', [1, 1, 1])).toBe(19);

    // 라운드트립
    const decoded = decodeBySegment([seg], 19);
    expect(decoded.values).toEqual({ trackAction: 1, page: 1, userType: 1 });
  });
});

// ═══════════════════════════════════════════════════════
// 예시 2: 경로 합산 prefix (order_process)
// ═══════════════════════════════════════════════════════

describe('예시 2 — 경로 합산 prefix (order_process)', () => {
  /**
   * 주문 처리 이벤트의 분기 구조:
   *
   * order.process
   *   ├── branch: orderType (3: normal, express, subscription)
   *   │   ├── → paymentMethod (4: card, bank, crypto, point)
   *   │   │     → event: payment.process  (전이)
   *   │   └── → shippingOption (2: standard, sameDay)
   *   │         → event: shipping.dispatch (전이)
   *   └── 총: (3×4) + (3×2) = 18 주소
   */
  const orderSegments = chainSegments([
    {
      segmentId: 'order_payment',
      consumes: ['orderType', 'paymentMethod'],
      shape: [3, 4],
      transition: { eventKey: 'payment.process', prefixId: 'payment' },
    },
    {
      segmentId: 'order_shipping',
      consumes: ['orderType', 'shippingOption'],
      shape: [3, 2],
      transition: { eventKey: 'shipping.dispatch', prefixId: 'shipping' },
    },
  ]);

  const orderPrefix: PrefixDef = {
    id: 'order_process',
    name: '주문 처리',
    labels: ['orderType', 'paymentMethod', 'shippingOption'],
    dims: {
      orderType: { kind: 'axis', axisId: 'order_type' },
      paymentMethod: { kind: 'axis', axisId: 'payment_method' },
      shippingOption: { kind: 'axis', axisId: 'shipping_option' },
    },
    versions: [
      {
        version: 'v1',
        axisVersions: { order_type: 'v1', payment_method: 'v1', shipping_option: 'v1' },
        segments: orderSegments,
      },
    ],
    addressModel: 'sum',
  };

  it('총 18 주소 (전곱 24보다 25% 절약)', () => {
    expect(totalSize(orderSegments)).toBe(18);
    // 전곱이었다면: 3 × 4 × 2 = 24
  });

  it('결제 경로 인코딩: normal(0) × card(0) → 0', () => {
    expect(encodeBySegment(orderSegments, 'order_payment', [0, 0])).toBe(0);
  });

  it('결제 경로 인코딩: express(1) × bank(1) → 5', () => {
    expect(encodeBySegment(orderSegments, 'order_payment', [1, 1])).toBe(5);
  });

  it('배송 경로 인코딩: normal(0) × standard(0) → 12 (offset)', () => {
    expect(encodeBySegment(orderSegments, 'order_shipping', [0, 0])).toBe(12);
  });

  it('배송 경로 인코딩: express(1) × sameDay(1) → 15', () => {
    expect(encodeBySegment(orderSegments, 'order_shipping', [1, 1])).toBe(15);
  });

  it('디코딩: 주소 5 → order_payment, express × bank', () => {
    const d = decodeBySegment(orderSegments, 5);
    expect(d.segment.segmentId).toBe('order_payment');
    expect(d.values).toEqual({ orderType: 1, paymentMethod: 1 });
    expect(d.transition!.eventKey).toBe('payment.process');
  });

  it('디코딩: 주소 15 → order_shipping, express × sameDay', () => {
    const d = decodeBySegment(orderSegments, 15);
    expect(d.segment.segmentId).toBe('order_shipping');
    expect(d.values).toEqual({ orderType: 1, shippingOption: 1 });
    expect(d.transition!.eventKey).toBe('shipping.dispatch');
  });

  it('전이 대상 수집', () => {
    const transitions = collectTransitions(orderSegments);
    expect(transitions).toEqual([
      { segmentId: 'order_payment', eventKey: 'payment.process', prefixId: 'payment' },
      { segmentId: 'order_shipping', eventKey: 'shipping.dispatch', prefixId: 'shipping' },
    ]);
  });

  it('전체 라운드트립 — 18개 주소 전수 검증', () => {
    for (let addr = 0; addr < 18; addr++) {
      const decoded = decodeBySegment(orderSegments, addr);
      const reEncoded = encodeBySegment(orderSegments, decoded.segment.segmentId, decoded.coord);
      expect(reEncoded).toBe(addr);
    }
  });
});

// ═══════════════════════════════════════════════════════
// 예시 3: 재귀 세그먼트 (결제 → 카드 → 3DS)
// ═══════════════════════════════════════════════════════

describe('예시 3 — 재귀 분기 (payment prefix)', () => {
  /**
   * payment.process 이벤트의 재귀 분기:
   *
   * payment.process
   *   ├── card (gateway: 2종)
   *   │   ├── gateway=domestic → (자체 완결)
   *   │   └── gateway=overseas → event: auth.3ds.verify  (전이)
   *   ├── bank (verification: 3종)
   *   │   └── → event: bank.confirm (전이)
   *   └── crypto (network: 2종)
   *       └── → event: crypto.settle (전이)
   *
   * 세그먼트 구조:
   *   seg[0]: card_gateway [2] offset=0
   *     └── child: overseas_3ds [1] offset=1, transition→auth.3ds
   *   seg[1]: bank_verify [3] offset=2, transition→bank.confirm
   *   seg[2]: crypto_net [2] offset=5, transition→crypto.settle
   */

  const overseas3ds = createSegment('overseas_3ds', ['require_3ds'], [1], 1, {
    transition: { eventKey: 'auth.3ds.verify' },
  });

  const segments = chainSegments([
    {
      segmentId: 'card_gateway',
      consumes: ['gateway'],
      shape: [2],
      children: [overseas3ds],
    },
    {
      segmentId: 'bank_verify',
      consumes: ['verification'],
      shape: [3],
      transition: { eventKey: 'bank.confirm' },
    },
    {
      segmentId: 'crypto_net',
      consumes: ['network'],
      shape: [2],
      transition: { eventKey: 'crypto.settle' },
    },
  ]);

  it('총 7 주소 (2 + 3 + 2)', () => {
    expect(totalSize(segments)).toBe(7);
  });

  it('card/domestic(0) → 주소 0, 전이 없음', () => {
    const d = decodeBySegment(segments, 0);
    expect(d.segment.segmentId).toBe('card_gateway');
    expect(d.transition).toBeUndefined();
  });

  it('card/overseas(1) → 주소 1, 하위에서 3DS 전이 감지', () => {
    const d = decodeBySegment(segments, 1);
    // 하위 세그먼트 overseas_3ds가 매칭됨
    expect(d.segment.segmentId).toBe('overseas_3ds');
    expect(d.transition!.eventKey).toBe('auth.3ds.verify');
  });

  it('bank/verify=2 → 주소 4, bank.confirm 전이', () => {
    const d = decodeBySegment(segments, 4);
    expect(d.segment.segmentId).toBe('bank_verify');
    expect(d.values.verification).toBe(2);
    expect(d.transition!.eventKey).toBe('bank.confirm');
  });

  it('전이 3건 수집 (재귀 포함)', () => {
    const t = collectTransitions(segments);
    expect(t).toHaveLength(3);
    expect(t.map((x) => x.eventKey).toSorted()).toEqual([
      'auth.3ds.verify',
      'bank.confirm',
      'crypto.settle',
    ]);
  });
});

// ═══════════════════════════════════════════════════════
// 예시 4: PrefixDef에 실제 등록한 모습
// ═══════════════════════════════════════════════════════

describe('예시 4 — PrefixDef 등록 형태', () => {
  it('카탈로그에 sum prefix 등록', () => {
    const segments = chainSegments([
      {
        segmentId: 'type_payment',
        consumes: ['orderType', 'paymentMethod'],
        shape: [3, 4],
        transition: { eventKey: 'payment.process' },
      },
      {
        segmentId: 'type_shipping',
        consumes: ['orderType', 'shippingOption'],
        shape: [3, 2],
        transition: { eventKey: 'shipping.dispatch' },
      },
    ]);

    const prefix: PrefixDef = {
      id: 'order_process',
      name: '주문 처리',
      labels: ['orderType', 'paymentMethod', 'shippingOption'],
      dims: {
        orderType: { kind: 'axis', axisId: 'order_type' },
        paymentMethod: { kind: 'axis', axisId: 'payment_method' },
        shippingOption: { kind: 'axis', axisId: 'shipping_option' },
      },
      versions: [
        {
          version: 'v1',
          axisVersions: { order_type: 'v1', payment_method: 'v1', shipping_option: 'v1' },
          segments,
        },
      ],
      addressModel: 'sum',
    };

    const v1 = prefix.versions[0];

    expect(prefix.id).toBe('order_process');
    expect(prefix.addressModel).toBe('sum');
    expect(v1.segments).toHaveLength(2);

    // 버전별 세그먼트로 인코딩/디코딩
    const addr = encodeBySegment(v1.segments!, 'type_payment', [2, 3]);
    expect(addr).toBe(11); // subscription(2) × point(3)

    const decoded = decodeBySegment(v1.segments!, addr);
    expect(decoded.values).toEqual({ orderType: 2, paymentMethod: 3 });
    expect(decoded.transition!.eventKey).toBe('payment.process');
  });
});

// ═══════════════════════════════════════════════════════
// 예시 4b: v1 → v2 버전 업그레이드 흐름
// ═══════════════════════════════════════════════════════

describe('예시 4b — v1 → v2 세그먼트 버전 업그레이드', () => {
  /**
   * v1: orderType(3) × paymentMethod(4) + orderType(3) × shippingOption(2) = 18
   * v2 변경사항:
   *   - paymentMethod에 "point_plus" 추가 → 5종
   *   - 새 세그먼트 "order_insurance" 추가: orderType(3) × insuranceOption(2) = 6
   *   → v2 총: (3×5) + (3×2) + (3×2) = 15 + 6 + 6 = 27
   */

  const v1Segments = chainSegments([
    {
      segmentId: 'order_payment',
      consumes: ['orderType', 'paymentMethod'],
      shape: [3, 4],
      transition: { eventKey: 'payment.process' },
    },
    {
      segmentId: 'order_shipping',
      consumes: ['orderType', 'shippingOption'],
      shape: [3, 2],
      transition: { eventKey: 'shipping.dispatch' },
    },
  ]);

  const v2Segments = chainSegments([
    {
      segmentId: 'order_payment',
      consumes: ['orderType', 'paymentMethod'],
      shape: [3, 5],
      transition: { eventKey: 'payment.process' },
      routes: [
        {
          when: { axis: 'paymentMethod', eq: 4 },
          transition: { eventKey: 'payment.point_plus.process' },
        },
      ],
    },
    {
      segmentId: 'order_shipping',
      consumes: ['orderType', 'shippingOption'],
      shape: [3, 2],
      transition: { eventKey: 'shipping.dispatch' },
    },
    {
      segmentId: 'order_insurance',
      consumes: ['orderType', 'insuranceOption'],
      shape: [3, 2],
      transition: { eventKey: 'insurance.apply' },
    },
  ]);

  const prefix: PrefixDef = {
    id: 'order_process',
    name: '주문 처리',
    labels: ['orderType', 'paymentMethod', 'shippingOption', 'insuranceOption'],
    dims: {
      orderType: { kind: 'axis', axisId: 'order_type' },
      paymentMethod: { kind: 'axis', axisId: 'payment_method' },
      shippingOption: { kind: 'axis', axisId: 'shipping_option' },
      insuranceOption: { kind: 'axis', axisId: 'insurance_option' },
    },
    versions: [
      {
        version: 'v1',
        axisVersions: { order_type: 'v1', payment_method: 'v1', shipping_option: 'v1' },
        segments: v1Segments,
      },
      {
        version: 'v2',
        axisVersions: {
          order_type: 'v1',
          payment_method: 'v2',
          shipping_option: 'v1',
          insurance_option: 'v1',
        },
        segments: v2Segments,
      },
    ],
    addressModel: 'sum',
  };

  function getSegments(version: string) {
    return prefix.versions.find((v) => v.version === version)!.segments!;
  }

  // ── 주소 공간 크기 ───────────────────────────────

  it('v1 = 18 주소, v2 = 27 주소', () => {
    expect(totalSize(getSegments('v1'))).toBe(18);
    expect(totalSize(getSegments('v2'))).toBe(27);
  });

  // ── v1 주소 불변 — v1으로 발급된 주소는 v1 스펙으로 항상 동일 디코딩 ──

  it('v1 주소 5 → v1 스펙으로 디코딩 항상 동일', () => {
    const d = decodeBySegment(getSegments('v1'), 5);
    expect(d.segment.segmentId).toBe('order_payment');
    expect(d.values).toEqual({ orderType: 1, paymentMethod: 1 }); // express × bank
    expect(d.transition!.eventKey).toBe('payment.process');
  });

  it('v1 주소 14 → v1 스펙으로 디코딩 항상 동일', () => {
    const d = decodeBySegment(getSegments('v1'), 14);
    expect(d.segment.segmentId).toBe('order_shipping');
    expect(d.values).toEqual({ orderType: 1, shippingOption: 0 }); // express × standard
  });

  // ── v2 새 주소 — v2에서 확장된 주소 공간 ──────────

  it('v2 주소 4 → paymentMethod=4 (point_plus, 신규) → 분기 라우팅', () => {
    const d = decodeBySegment(getSegments('v2'), 4);
    expect(d.segment.segmentId).toBe('order_payment');
    expect(d.values.paymentMethod).toBe(4); // point_plus (v2에서 추가)
    expect(d.transition!.eventKey).toBe('payment.point_plus.process'); // route 매칭
  });

  it('v2 seg[1] offset 변경 — v2 shipping은 offset 15 (v1은 12)', () => {
    // v2: seg[0] size=15 (3×5), seg[1] offset=15
    const d = decodeBySegment(getSegments('v2'), 15);
    expect(d.segment.segmentId).toBe('order_shipping');
    expect(d.values).toEqual({ orderType: 0, shippingOption: 0 });
  });

  it('v2 새 세그먼트 insurance — offset 21', () => {
    // v2: seg[2] offset = 15 + 6 = 21
    const d = decodeBySegment(getSegments('v2'), 21);
    expect(d.segment.segmentId).toBe('order_insurance');
    expect(d.values).toEqual({ orderType: 0, insuranceOption: 0 });
    expect(d.transition!.eventKey).toBe('insurance.apply');
  });

  // ── 핵심: v1 주소를 v2 스펙으로 디코딩하면 다른 결과 ──

  it('v1 주소 14를 v2 스펙으로 디코딩하면 다른 의미 (이래서 버전이 필요)', () => {
    const v1d = decodeBySegment(getSegments('v1'), 14);
    const v2d = decodeBySegment(getSegments('v2'), 14);

    // v1: 주소 14 = order_shipping, orderType=1, shippingOption=0
    expect(v1d.segment.segmentId).toBe('order_shipping');

    // v2: 주소 14 = order_payment(size 15이므로 여전히 seg[0] 범위), orderType=2, paymentMethod=4
    expect(v2d.segment.segmentId).toBe('order_payment');

    // 같은 주소 14인데 버전에 따라 완전히 다른 의미 → envelope에 version 필수
  });

  // ── 라운드트립: v1/v2 각각 전수 검증 ──────────────

  it('v1 전수 라운드트립 (18개)', () => {
    const segs = getSegments('v1');
    for (let addr = 0; addr < totalSize(segs); addr++) {
      const decoded = decodeBySegment(segs, addr);
      const re = encodeBySegment(segs, decoded.segment.segmentId, decoded.coord);
      expect(re).toBe(addr);
    }
  });

  it('v2 전수 라운드트립 (27개)', () => {
    const segs = getSegments('v2');
    for (let addr = 0; addr < totalSize(segs); addr++) {
      const decoded = decodeBySegment(segs, addr);
      const re = encodeBySegment(segs, decoded.segment.segmentId, decoded.coord);
      expect(re).toBe(addr);
    }
  });

  // ── collectTransitions: 버전별 전이 목록 ──────────

  it('v1 전이 2건, v2 전이 4건 (route 포함)', () => {
    expect(collectTransitions(getSegments('v1'))).toHaveLength(2);
    // v2: route 1건 + segment transition 3건 = 4건
    expect(collectTransitions(getSegments('v2'))).toHaveLength(4);
  });
});

// ═══════════════════════════════════════════════════════
// 예시 5: 분기 라우팅 — 축 값에 따라 다른 이벤트로 전이
// ═══════════════════════════════════════════════════════

describe('예시 5 — 분기 라우팅 (값별 이벤트 전이)', () => {
  /**
   * payment.process 이벤트:
   *   paymentMethod 축 값에 따라 다른 이벤트로 전이
   *
   *   paymentMethod=0 (card)   → payment.card.process
   *   paymentMethod=1 (bank)   → payment.bank.confirm
   *   paymentMethod=2 (crypto) → payment.crypto.settle
   *   paymentMethod=3 (point)  → (자체 완결, 전이 없음)
   */
  const segments = chainSegments([
    {
      segmentId: 'payment_dispatch',
      consumes: ['paymentMethod'],
      shape: [4],
      // segment 전체 전이 없음 — route로 값별 분기
      routes: [
        {
          when: { axis: 'paymentMethod', eq: 0 },
          transition: { eventKey: 'payment.card.process' },
        },
        {
          when: { axis: 'paymentMethod', eq: 1 },
          transition: { eventKey: 'payment.bank.confirm' },
        },
        {
          when: { axis: 'paymentMethod', eq: 2 },
          transition: { eventKey: 'payment.crypto.settle' },
        },
        // value=3 (point): route 없음 → 자체 완결
      ],
    },
  ]);

  it('card(0) → payment.card.process 전이', () => {
    const d = decodeBySegment(segments, 0);
    expect(d.values.paymentMethod).toBe(0);
    expect(d.transition!.eventKey).toBe('payment.card.process');
  });

  it('bank(1) → payment.bank.confirm 전이', () => {
    const d = decodeBySegment(segments, 1);
    expect(d.transition!.eventKey).toBe('payment.bank.confirm');
  });

  it('crypto(2) → payment.crypto.settle 전이', () => {
    const d = decodeBySegment(segments, 2);
    expect(d.transition!.eventKey).toBe('payment.crypto.settle');
  });

  it('point(3) → 전이 없음 (자체 완결)', () => {
    const d = decodeBySegment(segments, 3);
    expect(d.values.paymentMethod).toBe(3);
    expect(d.transition).toBeUndefined();
  });

  it('collectTransitions — route 4건 (조건 포함)', () => {
    const t = collectTransitions(segments);
    expect(t).toHaveLength(3); // route 3건 (point는 route 없음)
    expect(t[0]).toEqual({
      segmentId: 'payment_dispatch',
      eventKey: 'payment.card.process',
      condition: { axis: 'paymentMethod', eq: 0 },
    });
  });
});

// ═══════════════════════════════════════════════════════
// 예시 6: 선택적 소비 + 분기 라우팅 복합
// ═══════════════════════════════════════════════════════

describe('예시 6 — 선택적 소비 + 분기 라우팅 복합', () => {
  /**
   * order.process prefix: dims pool = [orderType, paymentMethod, shippingOption]
   *
   * seg[0]: consumes [orderType, paymentMethod] — 주문유형×결제방법
   *   routes: paymentMethod=0(card) → payment.card
   *           paymentMethod=1(bank) → payment.bank
   *           나머지 → segment transition (payment.other)
   *
   * seg[1]: consumes [orderType, shippingOption] — 주문유형×배송
   *   transition: shipping.dispatch (전체 전이, route 없음)
   */
  const segments = chainSegments([
    {
      segmentId: 'order_payment',
      consumes: ['orderType', 'paymentMethod'],
      shape: [3, 4],
      transition: { eventKey: 'payment.other' }, // route 미매칭 시 폴백
      routes: [
        { when: { axis: 'paymentMethod', eq: 0 }, transition: { eventKey: 'payment.card' } },
        { when: { axis: 'paymentMethod', eq: 1 }, transition: { eventKey: 'payment.bank' } },
      ],
    },
    {
      segmentId: 'order_shipping',
      consumes: ['orderType', 'shippingOption'],
      shape: [3, 2],
      transition: { eventKey: 'shipping.dispatch' },
    },
  ]);

  it('normal(0) × card(0) → payment.card (route 매칭)', () => {
    const d = decodeBySegment(segments, 0); // [0,0]
    expect(d.transition!.eventKey).toBe('payment.card');
  });

  it('normal(0) × bank(1) → payment.bank (route 매칭)', () => {
    const d = decodeBySegment(segments, 1); // [0,1]
    expect(d.transition!.eventKey).toBe('payment.bank');
  });

  it('normal(0) × crypto(2) → payment.other (route 미매칭 → segment transition 폴백)', () => {
    const d = decodeBySegment(segments, 2); // [0,2]
    expect(d.transition!.eventKey).toBe('payment.other');
  });

  it('express(1) × standard(0) → shipping.dispatch (seg[1] 전체 전이)', () => {
    const d = decodeBySegment(segments, 14); // offset 12 + [1,0]=2 → 14
    expect(d.transition!.eventKey).toBe('shipping.dispatch');
  });

  it('collectTransitions — route 2건 + segment 2건 = 4건', () => {
    const t = collectTransitions(segments);
    expect(t).toHaveLength(4);
    const eventKeys = t.map((x) => x.eventKey).toSorted();
    expect(eventKeys).toEqual([
      'payment.bank',
      'payment.card',
      'payment.other',
      'shipping.dispatch',
    ]);
  });
});
