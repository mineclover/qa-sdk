import { describe, it, expect } from 'vitest';
import {
  classifyPattern,
  DEMO_PATTERN_RULES,
  detectAnomalies,
  type ClassifierEvent,
} from '@qa-sdk/convergence';
import type { PatternClassification } from '@qa-sdk/core';

function ev(key: string, ms: number = 0, actor?: string, userId?: string): ClassifierEvent {
  return {
    event_key: key,
    timestamp: new Date(2026, 2, 21, 0, 0, 0, ms).toISOString(),
    actor_id: actor,
    user_id: userId,
  };
}

describe('classifyPattern — 기본 규칙', () => {
  it('구매 완료 → purchase_complete', () => {
    const result = classifyPattern(
      {
        events: [
          ev('auth.login', 0, 'user-1', 'u1'),
          ev('page.product_list', 100, 'user-1', 'u1'),
          ev('cart.add', 200, 'user-1', 'u1'),
          ev('checkout.entry', 300, 'user-1', 'u1'),
          ev('payment.success', 400, 'user-1', 'u1'),
          ev('order.complete', 500, 'user-1', 'u1'),
        ],
      },
      DEMO_PATTERN_RULES,
    );

    expect(result.pattern).toBe('purchase_complete');
    expect(result.identificationMode).toBe('identified');
    expect(result.confidence).toBe('exact');
  });

  it('로그인 후 탐색만 → browse_only', () => {
    const result = classifyPattern(
      {
        events: [
          ev('auth.login', 0, 'user-1'),
          ev('page.home', 100, 'user-1'),
          ev('page.product_list', 200, 'user-1'),
          ev('page.product_detail', 300, 'user-1'),
        ],
      },
      DEMO_PATTERN_RULES,
    );

    expect(result.pattern).toBe('browse_only');
  });

  it('장바구니 담기 후 이탈 → cart_abandon', () => {
    const result = classifyPattern(
      {
        events: [
          ev('auth.login', 0, 'user-1'),
          ev('page.products', 100, 'user-1'),
          ev('cart.add', 200, 'user-1'),
          ev('page.products', 300, 'user-1'),
        ],
      },
      DEMO_PATTERN_RULES,
    );

    expect(result.pattern).toBe('cart_abandon');
  });

  it('결제 시도 후 실패 → checkout_fail', () => {
    const result = classifyPattern(
      {
        events: [
          ev('auth.login', 0, 'user-1'),
          ev('cart.add', 100, 'user-1'),
          ev('checkout.entry', 200, 'user-1'),
          ev('checkout.process', 300, 'user-1'),
        ],
      },
      DEMO_PATTERN_RULES,
    );

    expect(result.pattern).toBe('checkout_fail');
  });

  it('비로그인 탐색 → anonymous_browse', () => {
    const result = classifyPattern(
      {
        events: [ev('page.home', 0), ev('page.products', 100), ev('page.detail', 200)],
      },
      DEMO_PATTERN_RULES,
    );

    expect(result.pattern).toBe('anonymous_browse');
    expect(result.identificationMode).toBe('anonymous');
  });

  it('서비스 호출 → api_integration', () => {
    const result = classifyPattern(
      {
        events: [ev('api.products', 0, 'svc-1')],
        platform: 'node',
        ownerType: 'workspace',
      },
      DEMO_PATTERN_RULES,
    );

    expect(result.pattern).toBe('api_integration');
    expect(result.identificationMode).toBe('service');
  });

  it('빈 이벤트 → unclassified', () => {
    const result = classifyPattern({ events: [] }, DEMO_PATTERN_RULES);
    expect(result.pattern).toBe('unclassified');
    expect(result.confidence).toBe('unknown');
  });

  it('어떤 규칙에도 매칭 안 되면 unclassified', () => {
    const result = classifyPattern(
      {
        events: [ev('unknown.event', 0, 'user-1')],
      },
      DEMO_PATTERN_RULES,
    );

    expect(result.pattern).toBe('unclassified');
  });
});

describe('classifyPattern — identification_mode 판별', () => {
  it('user_id 있으면 identified', () => {
    const result = classifyPattern(
      {
        events: [ev('page.home', 0, 'a1', 'u1')],
      },
      [],
    );
    expect(result.identificationMode).toBe('identified');
  });

  it('actor_id만 있으면 pseudonymized', () => {
    const result = classifyPattern(
      {
        events: [ev('page.home', 0, 'token-abc')],
      },
      [],
    );
    expect(result.identificationMode).toBe('pseudonymized');
  });

  it('actor 없으면 anonymous', () => {
    const result = classifyPattern(
      {
        events: [ev('page.home', 0)],
      },
      [],
    );
    expect(result.identificationMode).toBe('anonymous');
  });

  it('platform=node + workspace → service', () => {
    const result = classifyPattern(
      {
        events: [ev('api.call', 0, 'svc')],
        platform: 'node',
        ownerType: 'workspace',
      },
      [],
    );
    expect(result.identificationMode).toBe('service');
  });
});

describe('detectAnomalies', () => {
  it('unclassified 감지', () => {
    const current: PatternClassification[] = [
      {
        pattern: 'unclassified',
        identificationMode: 'anonymous',
        confidence: 'unknown',
        matchedRuleId: 'none',
        eventCount: 3,
        durationMs: 1000,
        classifiedAt: '',
      },
      {
        pattern: 'unclassified',
        identificationMode: 'anonymous',
        confidence: 'unknown',
        matchedRuleId: 'none',
        eventCount: 5,
        durationMs: 2000,
        classifiedAt: '',
      },
      {
        pattern: 'unclassified',
        identificationMode: 'anonymous',
        confidence: 'unknown',
        matchedRuleId: 'none',
        eventCount: 3,
        durationMs: 1000,
        classifiedAt: '',
      },
    ];

    const anomalies = detectAnomalies({ current });
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies.some((a) => a.kind === 'unclassified')).toBe(true);
  });

  it('비율 급변 감지', () => {
    const current: PatternClassification[] = Array.from({ length: 10 }, () => ({
      pattern: 'purchase_complete' as const,
      identificationMode: 'identified' as const,
      confidence: 'exact' as const,
      matchedRuleId: 'r1',
      eventCount: 5,
      durationMs: 1000,
      classifiedAt: '',
    }));

    const previous = [
      {
        pattern: 'purchase_complete' as const,
        identificationMode: 'identified' as const,
        count: 2,
        percentage: 0.2,
        avgEventCount: 5,
        avgDurationMs: 1000,
        lastSeen: '',
      },
      {
        pattern: 'browse_only' as const,
        identificationMode: 'identified' as const,
        count: 8,
        percentage: 0.8,
        avgEventCount: 3,
        avgDurationMs: 500,
        lastSeen: '',
      },
    ];

    const anomalies = detectAnomalies({ current, previous });
    expect(anomalies.some((a) => a.kind === 'ratio_shift')).toBe(true);
  });

  it('비정상 속도 감지', () => {
    const current: PatternClassification[] = [
      {
        pattern: 'anonymous_browse',
        identificationMode: 'anonymous',
        confidence: 'medium',
        matchedRuleId: 'r1',
        eventCount: 20,
        durationMs: 500, // 20 events in 500ms = 25ms avg interval
        classifiedAt: '',
      },
    ];

    const anomalies = detectAnomalies({ current });
    expect(anomalies.some((a) => a.kind === 'abnormal_speed')).toBe(true);
  });

  it('이상 없으면 빈 배열', () => {
    const current: PatternClassification[] = [
      {
        pattern: 'purchase_complete',
        identificationMode: 'identified',
        confidence: 'exact',
        matchedRuleId: 'r1',
        eventCount: 6,
        durationMs: 60000,
        classifiedAt: '',
      },
    ];

    const anomalies = detectAnomalies({ current });
    expect(anomalies.length).toBe(0);
  });
});
