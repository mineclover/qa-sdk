/**
 * 계층적 컨텍스트 조합 증명
 *
 * decision-flow가 시스템 구조(catalog/DKG)의 5개 레벨을
 * 수직으로 관통하여 정제된 맥락을 조합하는 것을 증명한다.
 */

import { describe, it, expect } from 'vitest';
import { assembleHierarchicalContext, assembleMultiPrefixContext } from './hierarchical-context.js';
import type {
  HierarchySource,
  DomainInfo,
  DslBundleInfo,
  PrefixInfo,
  DimInfo,
} from './hierarchical-context.js';

// ─── qa-sdk 실제 구조를 모사한 fixture ───────────────────

const DOMAINS: DomainInfo[] = [
  {
    id: 'event-domain',
    name: '이벤트 도메인',
    prefixes: ['cart_event', 'order_event', 'auth_event'],
    sharedAxes: ['order_status', 'order_action'],
    boundary: {
      exports: ['order_status', 'auth_state'],
      internal: ['cart_internal_flag'],
    },
  },
  {
    id: 'observation-domain',
    name: '관측 도메인',
    prefixes: ['page_view', 'endpoint', 'flow_point'],
    sharedAxes: ['page', 'env', 'resource_type'],
    boundary: {
      exports: ['page_view_status'],
      internal: [],
    },
  },
];

const DSL_BUNDLES: DslBundleInfo[] = [
  {
    id: 'dsl-checkout',
    name: '결제 파이프라인',
    memberPrefixes: ['page_view', 'endpoint', 'flow_point', 'order_event', 'cart_event'],
    fixedDims: ['svc_ref'],
    invariants: [
      'checkout page_view 없이 flow_point(success)가 관측되면 안 됨',
      'order_event는 반드시 cart_event 이후에 발생',
    ],
  },
  {
    id: 'dsl-commerce',
    name: '커머스 번들',
    memberPrefixes: ['cart_event', 'order_event'],
    fixedDims: ['svc_ref'],
    invariants: ['주문 금액은 0보다 커야 함'],
  },
];

const PREFIXES: Map<string, PrefixInfo> = new Map([
  [
    'cart_event',
    {
      id: 'cart_event',
      name: '장바구니 이벤트',
      category: 'event',
      dims: [
        { label: 'order_status', kind: 'axis', ref: 'order_status' },
        { label: 'order_action', kind: 'axis', ref: 'order_action' },
        { label: 'svc_ref', kind: 'prefix_ref', ref: 'service' },
      ],
      totalSpace: 640,
    },
  ],
  [
    'page_view',
    {
      id: 'page_view',
      name: '페이지 뷰',
      category: 'observation',
      dims: [
        { label: 'page', kind: 'axis', ref: 'page' },
        { label: 'env', kind: 'axis', ref: 'env' },
        { label: 'user_type', kind: 'axis', ref: 'user_type' },
      ],
      totalSpace: 320,
    },
  ],
]);

const AXES: Map<string, DimInfo> = new Map([
  [
    'order_status',
    {
      axisId: 'order_status',
      entries: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      capacity: 8,
      headroom: 3,
    },
  ],
  [
    'order_action',
    {
      axisId: 'order_action',
      entries: ['add_to_cart', 'remove', 'update_quantity', 'checkout', 'cancel'],
      capacity: 8,
      headroom: 3,
    },
  ],
  [
    'page',
    {
      axisId: 'page',
      entries: [
        'home',
        'product',
        'cart',
        'checkout',
        'order_complete',
        'login',
        'search',
        'category',
      ],
      capacity: 16,
      headroom: 8,
    },
  ],
  [
    'env',
    {
      axisId: 'env',
      entries: ['prod', 'staging', 'dev', 'test', 'canary'],
      capacity: 8,
      headroom: 3,
    },
  ],
  [
    'user_type',
    {
      axisId: 'user_type',
      entries: ['guest', 'member', 'admin'],
      capacity: 4,
      headroom: 1, // ⚠ 거의 가득 참
    },
  ],
]);

const SOURCE: HierarchySource = {
  domains: DOMAINS,
  dslBundles: DSL_BUNDLES,
  prefixes: PREFIXES,
  axes: AXES,
};

// ─── 증명 ───────────────────────────────────────────────

describe('계층적 컨텍스트 조합 — 5개 레벨 수직 관통', () => {
  it('cart_event: 5개 레벨 전부에서 맥락이 조합된다', () => {
    const ctx = assembleHierarchicalContext('cart_event', SOURCE);

    // Level 1: 도메인
    expect(ctx.domain).toBeDefined();
    expect(ctx.domain!.id).toBe('event-domain');
    expect(ctx.domain!.sharedAxes).toContain('order_status');

    // Level 2: DSL 번들 (2개에 소속)
    expect(ctx.dslBundles.length).toBe(2);
    expect(ctx.dslBundles.map((b) => b.id)).toContain('dsl-checkout');
    expect(ctx.dslBundles.map((b) => b.id)).toContain('dsl-commerce');

    // Level 3: prefix 자체
    expect(ctx.prefix).toBeDefined();
    expect(ctx.prefix!.category).toBe('event');
    expect(ctx.prefix!.dims.length).toBe(3);

    // Level 4-5: 차원 + 엔트리
    expect(ctx.dimensions.length).toBe(2); // axis 2개 (svc_ref는 prefix_ref이므로 제외)
    const statusDim = ctx.dimensions.find((d) => d.axisId === 'order_status');
    expect(statusDim).toBeDefined();
    expect(statusDim!.entries).toContain('pending');
    expect(statusDim!.headroom).toBe(3);

    // 조합된 제약
    expect(ctx.constraints.length).toBeGreaterThan(0);
    // 도메인 경계 + DSL 불변조건 모두 포함
    const constraintText = ctx.constraints.join(' ');
    expect(constraintText).toContain('도메인 경계');
    expect(constraintText).toContain('checkout page_view 없이');
    expect(constraintText).toContain('주문 금액');

    // 공유 축
    expect(ctx.sharedAxes).toContain('order_status');
    expect(ctx.sharedAxes).toContain('svc_ref');

    // 한 줄 요약
    expect(ctx.summary).toContain('cart_event');
    expect(ctx.summary).toContain('event-domain');
    expect(ctx.summary).toContain('dsl-checkout');
  });

  it('page_view: 다른 도메인/DSL에서 다른 맥락이 조합된다', () => {
    const ctx = assembleHierarchicalContext('page_view', SOURCE);

    expect(ctx.domain!.id).toBe('observation-domain');
    expect(ctx.dslBundles.length).toBe(1);
    expect(ctx.dslBundles[0].id).toBe('dsl-checkout');

    // user_type의 headroom이 1이므로 경고 포함
    const constraintText = ctx.constraints.join(' ');
    expect(constraintText).toContain('⚠ user_type: headroom=1');
  });

  it('존재하지 않는 prefix도 안전하게 처리 (빈 맥락)', () => {
    const ctx = assembleHierarchicalContext('nonexistent', SOURCE);

    expect(ctx.domain).toBeUndefined();
    expect(ctx.dslBundles).toHaveLength(0);
    expect(ctx.prefix).toBeUndefined();
    expect(ctx.dimensions).toHaveLength(0);
    expect(ctx.summary).toContain('nonexistent');
  });

  it('여러 prefix의 맥락을 한 번에 조합 (결정에 관련된 prefix가 복수일 때)', () => {
    const contexts = assembleMultiPrefixContext(['cart_event', 'page_view'], SOURCE);

    expect(contexts.length).toBe(2);
    expect(contexts[0].domain!.id).toBe('event-domain');
    expect(contexts[1].domain!.id).toBe('observation-domain');

    // 두 prefix가 공유하는 DSL 번들
    const sharedDsl = contexts[0].dslBundles.filter((b) =>
      contexts[1].dslBundles.some((b2) => b2.id === b.id),
    );
    expect(sharedDsl.length).toBe(1);
    expect(sharedDsl[0].id).toBe('dsl-checkout');
  });
});

describe('계층 맥락이 의사결정을 쉽게 만든다', () => {
  it('headroom 경고가 자동으로 제약에 포함된다', () => {
    const ctx = assembleHierarchicalContext('page_view', SOURCE);

    // user_type headroom=1 → 경고
    const headroomWarnings = ctx.constraints.filter((c) => c.includes('⚠'));
    expect(headroomWarnings.length).toBe(1);
    expect(headroomWarnings[0]).toContain('user_type');

    // 결정자에게: "user_type 축이 거의 가득 참 — 엔트리 추가 전 capacity 확장 필요"
  });

  it('DSL 불변조건이 결정의 제약으로 표면화된다', () => {
    const ctx = assembleHierarchicalContext('cart_event', SOURCE);

    // dsl-checkout: "checkout page_view 없이 flow_point(success)가 관측되면 안 됨"
    // dsl-commerce: "주문 금액은 0보다 커야 함"
    // → 이 제약들이 cart_event 결정 시 자동 표면화
    const invariants = ctx.constraints.filter((c) => c.startsWith('DSL'));
    expect(invariants.length).toBeGreaterThanOrEqual(2);
  });

  it('도메인 경계가 결정의 범위를 한정한다', () => {
    const ctx = assembleHierarchicalContext('cart_event', SOURCE);

    // event-domain exports: ["order_status", "auth_state"]
    // → cart_event 결정이 도메인 밖에 영향을 줄 때 이 exports를 확인해야 함
    const boundaryConstraints = ctx.constraints.filter((c) => c.includes('도메인 경계'));
    expect(boundaryConstraints.length).toBeGreaterThan(0);
  });
});
