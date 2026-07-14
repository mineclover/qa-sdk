// @def.doc definition-catalog-spec

/**
 * 샘플 문서 구성 + 좌표 추적 + concern 전파 검증
 *
 * qa-sdk의 실제 문서 구조를 기반으로 definition-catalog에 등록하고,
 * 좌표 인코딩, 관계 그래프, concern 전파가 올바르게 동작하는지 확인한다.
 *
 * 시나리오: 쇼핑몰 결제 시스템
 *   - 결제 흐름 개요 (flow)
 *   - 결제 API 명세 (interface)
 *   - 결제 상태 모델 (state)
 *   - 장바구니 컴포넌트 (ui)
 *   - 주문 데이터 스키마 (data)
 *   - 보안 제약 (constraint)
 *   - 결제 기능 시나리오 (feature)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDefinitionRegistry } from './registry.js';
import { computeEffectiveConcerns } from './concern.js';
import { decodeDocument, encodeDocument, serializeDocumentAddress } from './observe.js';
import { detectCrossScope } from './taxonomy.js';
import type { DefinitionEntryInput } from './types.js';

const NOW = '2026-03-25T09:00:00Z';

function doc(overrides: Partial<DefinitionEntryInput>): DefinitionEntryInput {
  return {
    id: 'temp',
    title: 'temp',
    scope: 'feature',
    aspect: 'func_def',
    depth: 'specification',
    lifecycle: 'approved',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('쇼핑몰 결제 시스템 — 샘플 문서 구성', () => {
  let reg: MemoryDefinitionRegistry;

  beforeEach(() => {
    reg = new MemoryDefinitionRegistry();

    // ── 7개 scope에 걸친 문서 등록 ──────────────────────

    // flow: 결제 흐름 개요
    reg.register(
      doc({
        id: 'checkout-flow',
        title: '결제 프로세스 흐름',
        scope: 'flow',
        aspect: 'process_flow',
        depth: 'overview',
        tags: ['security', 'entry-point'],
      }),
    );

    // interface: 결제 API
    reg.register(
      doc({
        id: 'checkout-api',
        title: '결제 API 엔드포인트 명세',
        scope: 'interface',
        aspect: 'api_contract',
        depth: 'specification',
        tags: ['performance'],
      }),
    );

    // interface: 주문 이벤트 계약
    reg.register(
      doc({
        id: 'order-events',
        title: '주문 이벤트 스키마',
        scope: 'interface',
        aspect: 'event_contract',
        depth: 'specification',
      }),
    );

    // state: 결제 상태 모델
    reg.register(
      doc({
        id: 'checkout-state',
        title: '결제 상태 머신 (pending→confirmed→shipped)',
        scope: 'state',
        aspect: 'domain_state',
        depth: 'specification',
      }),
    );

    // ui: 장바구니 컴포넌트
    reg.register(
      doc({
        id: 'cart-component',
        title: '장바구니 UI 컴포넌트',
        scope: 'ui',
        aspect: 'component',
        depth: 'implementation',
      }),
    );

    // data: 주문 데이터 스키마
    reg.register(
      doc({
        id: 'order-schema',
        title: '주문 테이블 스키마 (orders, order_items)',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'specification',
        tags: ['migration'],
      }),
    );

    // constraint: PCI-DSS 보안 제약
    reg.register(
      doc({
        id: 'pci-constraint',
        title: 'PCI-DSS 카드 결제 보안 요구사항',
        scope: 'constraint',
        aspect: 'tech_constraint',
        depth: 'specification',
        tags: ['security'],
      }),
    );

    // feature: 결제 시나리오
    reg.register(
      doc({
        id: 'checkout-scenario',
        title: '결제 성공/실패/타임아웃 시나리오',
        scope: 'feature',
        aspect: 'scenario',
        depth: 'validation',
        tags: ['testing'],
      }),
    );

    // feature: 결제 기능 정의
    reg.register(
      doc({
        id: 'checkout-func',
        title: '결제 기능 명세 — 쿠폰, 포인트, 카드 결합 결제',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'specification',
      }),
    );

    // ── 관계 등록 ───────────────────────────────────────

    // 흐름 → 기능: 흐름이 기능을 구체화
    reg.link('checkout-func', 'checkout-flow', 'refines');

    // API가 기능을 구현
    reg.link('checkout-api', 'checkout-func', 'implements');

    // API가 상태에 의존
    reg.link('checkout-api', 'checkout-state', 'depends_on');

    // API가 이벤트 계약에 의존
    reg.link('checkout-api', 'order-events', 'depends_on');

    // 컴포넌트가 API를 구현
    reg.link('cart-component', 'checkout-api', 'implements');

    // 상태가 데이터 스키마에 의존
    reg.link('checkout-state', 'order-schema', 'depends_on');

    // 보안 제약이 API와 컴포넌트를 제약
    reg.link('pci-constraint', 'checkout-api', 'constrains');
    reg.link('pci-constraint', 'cart-component', 'constrains');

    // 시나리오가 기능을 추적
    reg.link('checkout-scenario', 'checkout-func', 'traces_to');

    // 이벤트 계약이 데이터 스키마를 구체화
    reg.link('order-events', 'order-schema', 'refines');
  });

  function compute(id: string) {
    return computeEffectiveConcerns(
      id,
      (i) => reg.get(i),
      (i, d) => reg.getLinks(i, d),
    );
  }

  // ── 1. 좌표 인코딩 검증 ───────────────────────────────

  describe('좌표 인코딩', () => {
    it('각 문서에 고유 주소가 부여된다', () => {
      const all = reg.all();
      const addresses = all.map((e) => e.address);
      // 모든 주소가 정의됨
      expect(addresses.every((a) => a !== undefined)).toBe(true);
      // 같은 scope×aspect×depth가 아닌 한 주소가 다름
      const uniqueAddresses = new Set(addresses);
      // checkout-api와 order-events는 같은 scope(interface) 다른 aspect → 다른 주소
      expect(reg.get('checkout-api')!.address).not.toBe(reg.get('order-events')!.address);
    });

    it('주소에서 문서 정체성을 복원할 수 있다', () => {
      const entry = reg.get('checkout-flow')!;
      const decoded = decodeDocument(entry.address!);
      expect(decoded.scope).toBe('flow');
      expect(decoded.aspect).toBe('process_flow');
      expect(decoded.depth).toBe('overview');
    });

    it('직렬화된 주소가 올바른 형식이다', () => {
      const entry = reg.get('cart-component')!;
      expect(entry.serialized).toMatch(/^def_document:v1:\d+$/);
    });

    it('같은 정체성은 항상 같은 주소다 (결정론적)', () => {
      const a = encodeDocument({
        scope: 'interface',
        aspect: 'api_contract',
        depth: 'specification',
      });
      const b = encodeDocument({
        scope: 'interface',
        aspect: 'api_contract',
        depth: 'specification',
      });
      expect(a).toBe(b);
    });
  });

  // ── 2. 관계 그래프 검증 ───────────────────────────────

  describe('관계 그래프', () => {
    it('checkout-api의 outgoing 관계 3건', () => {
      const links = reg.getLinks('checkout-api', 'outgoing');
      expect(links.length).toBe(3);
      const types = links.map((l) => `${l.linkType}→${l.targetId}`).toSorted();
      expect(types).toEqual([
        'depends_on→checkout-state',
        'depends_on→order-events',
        'implements→checkout-func',
      ]);
    });

    it('cart-component에 constrains가 걸려 있다', () => {
      const incoming = reg.getLinks('cart-component', 'incoming');
      expect(
        incoming.some((l) => l.linkType === 'constrains' && l.sourceId === 'pci-constraint'),
      ).toBe(true);
    });

    it('checkout-scenario는 traces_to로만 연결 (구조적 제약 아님)', () => {
      const outgoing = reg.getLinks('checkout-scenario', 'outgoing');
      expect(outgoing.length).toBe(1);
      expect(outgoing[0].linkType).toBe('traces_to');
    });

    it('문서 삭제 시 관련 관계도 정리된다', () => {
      const before = reg.getLinks('checkout-api').length;
      expect(before).toBeGreaterThan(0);
      reg.remove('checkout-api');
      // checkout-api에 연결된 모든 관계가 사라짐
      // pci-constraint → checkout-api (constrains) 도 사라져야 함
      const pciLinks = reg.getLinks('pci-constraint', 'outgoing');
      expect(pciLinks.every((l) => l.targetId !== 'checkout-api')).toBe(true);
    });
  });

  // ── 3. concern 전파 검증 ──────────────────────────────

  describe('concern 전파', () => {
    it('checkout-flow: security 직접 (루트 문서)', () => {
      const r = compute('checkout-flow');
      expect(r.direct).toContain('security');
      expect(r.inherited.length).toBe(0);
    });

    it('checkout-func: security 상속 (refines checkout-flow)', () => {
      const r = compute('checkout-func');
      expect(r.all).toContain('security');
      expect(
        r.inherited.some(
          (i) => i.concern === 'security' && i.from === 'checkout-flow' && i.via === 'refines',
        ),
      ).toBe(true);
    });

    it('checkout-api: security 3경로 + performance 직접 + migration 상속', () => {
      const r = compute('checkout-api');

      // security: (1) implements→checkout-func→refines→checkout-flow
      //           (2) constrains←pci-constraint
      //           (3) depends_on→checkout-state→... (없음, state에 security 없음)
      expect(r.all).toContain('security');
      expect(r.inherited.filter((i) => i.concern === 'security').length).toBeGreaterThanOrEqual(2);

      // performance: 직접 태그
      expect(r.direct).toContain('performance');

      // migration: depends_on→checkout-state→depends_on→order-schema(migration)
      expect(r.all).toContain('migration');
    });

    it('cart-component: security 상속 (constrains + implements 체인)', () => {
      const r = compute('cart-component');
      expect(r.all).toContain('security');

      // constrains 경로: pci-constraint → cart-component
      expect(
        r.inherited.some(
          (i) => i.concern === 'security' && i.from === 'pci-constraint' && i.via === 'constrains',
        ),
      ).toBe(true);

      // implements 체인: cart → checkout-api → checkout-func → checkout-flow
      expect(r.inherited.some((i) => i.concern === 'security' && i.from === 'checkout-flow')).toBe(
        true,
      );
    });

    it('order-schema: migration 직접 (전파 출발점)', () => {
      const r = compute('order-schema');
      expect(r.direct).toContain('migration');
    });

    it('checkout-state: migration 상속 (depends_on order-schema)', () => {
      const r = compute('checkout-state');
      expect(r.all).toContain('migration');
      expect(
        r.inherited.some(
          (i) => i.concern === 'migration' && i.from === 'order-schema' && i.via === 'depends_on',
        ),
      ).toBe(true);
    });

    it('checkout-scenario: testing 직접, security 미상속 (traces_to는 전파 안 함)', () => {
      const r = compute('checkout-scenario');
      expect(r.direct).toContain('testing');
      // traces_to는 전파하지 않으므로 checkout-func의 security가 오지 않음
      const securityInherited = r.inherited.filter((i) => i.concern === 'security');
      expect(securityInherited.length).toBe(0);
    });

    it('order-events: migration 상속 (refines order-schema)', () => {
      const r = compute('order-events');
      expect(r.all).toContain('migration');
      expect(
        r.inherited.some(
          (i) => i.concern === 'migration' && i.from === 'order-schema' && i.via === 'refines',
        ),
      ).toBe(true);
    });
  });

  // ── 4. 질의 검증 ─────────────────────────────────────

  describe('질의', () => {
    it('scope별 문서 수', () => {
      expect(reg.findByScope('interface').length).toBe(2);
      expect(reg.findByScope('feature').length).toBe(2);
      expect(reg.findByScope('flow').length).toBe(1);
      expect(reg.findByScope('ui').length).toBe(1);
      expect(reg.findByScope('state').length).toBe(1);
      expect(reg.findByScope('data').length).toBe(1);
      expect(reg.findByScope('constraint').length).toBe(1);
    });

    it('lifecycle 필터', () => {
      expect(reg.findByLifecycle('approved').length).toBe(9);
    });

    it('복합 필터: interface + specification', () => {
      const result = reg.query({ scope: 'interface', depth: 'specification' });
      expect(result.length).toBe(2);
      expect(result.map((e) => e.id).toSorted()).toEqual(['checkout-api', 'order-events']);
    });

    it('태그 필터: security 태그가 직접 부여된 문서', () => {
      const result = reg.query({ tags: ['security'] });
      expect(result.length).toBe(2);
      expect(result.map((e) => e.id).toSorted()).toEqual(['checkout-flow', 'pci-constraint']);
    });

    it('좌표 주소로 직접 조회', () => {
      const entry = reg.get('checkout-flow')!;
      const found = reg.findByAddress(entry.address!);
      expect(found.length).toBe(1);
      expect(found[0].id).toBe('checkout-flow');
    });

    it('통계', () => {
      const s = reg.stats();
      expect(s.totalEntries).toBe(9);
      expect(s.totalLinks).toBe(10);
      expect(s.byScope.interface).toBe(2);
      expect(s.byScope.feature).toBe(2);
    });
  });

  // ── 5. cross-scope 감지 ───────────────────────────────

  describe('cross-scope 감지', () => {
    it('결제 시스템 통합 문서를 만들면 분리 후보로 감지', () => {
      const tags = ['cross-scope', 'flow', 'interface', 'state', 'security'];
      const result = detectCrossScope(tags);
      expect(result.isCrossScope).toBe(true);
      expect(result.shouldSplit).toBe(true); // scope 3개 이상
      expect(result.scopeRefs).toEqual(['flow', 'state', 'interface']);
    });
  });

  // ── 6. lifecycle 변경 시 주소 안정성 ──────────────────

  describe('lifecycle 변경과 주소 안정성', () => {
    it('draft → approved로 변경해도 주소가 바뀌지 않는다', () => {
      reg.register(
        doc({
          id: 'new-doc',
          scope: 'ui',
          aspect: 'layout',
          depth: 'overview',
          lifecycle: 'draft',
        }),
      );
      const before = reg.get('new-doc')!;
      reg.update('new-doc', { lifecycle: 'approved' });
      const after = reg.get('new-doc')!;

      expect(after.address).toBe(before.address);
      expect(after.serialized).toBe(before.serialized);
      expect(after.lifecycle).toBe('approved');
    });
  });
});
