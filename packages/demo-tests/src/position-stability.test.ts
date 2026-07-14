// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * 위치 안정성 통합 테스트.
 *
 * MetaRegistry 수준에서 v1→v2 마이그레이션 시
 * 기존 엔티티의 position과 주소가 규칙에 따라 변하는지 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { MetaRegistry } from 'index-meta';
import {
  buildDemoRegistryInput,
  DEMO_ROLES_V1,
  DEMO_ROLES_V2,
  DEMO_EVENTS_V1,
  DEMO_EVENTS_V2,
} from 'demo-snapshot';

const registry = new MetaRegistry(buildDemoRegistryInput());

describe('위치 안정성 — MetaRegistry 수준', () => {
  it('v2 role snapshot — v1 역할의 position 동일', () => {
    const v1Snap = registry.getDimSnapshot('role', 'v1');
    const v2Snap = registry.getDimSnapshot('role', 'v2');

    for (let i = 0; i < v1Snap.entries.length; i++) {
      expect(v2Snap.entries[i]).toBe(v1Snap.entries[i]);
    }
  });

  it('v2 event_name snapshot — v1 이벤트의 position 동일', () => {
    const v1Snap = registry.getDimSnapshot('event_name', 'v1');
    const v2Snap = registry.getDimSnapshot('event_name', 'v2');

    for (let i = 0; i < v1Snap.entries.length; i++) {
      expect(v2Snap.entries[i]).toBe(v1Snap.entries[i]);
    }
  });

  it('v1에 존재하는 role의 v2 position — demo-snapshot SSOT와 일치', () => {
    for (let i = 0; i < DEMO_ROLES_V1.length; i++) {
      const v2Idx = DEMO_ROLES_V2.indexOf(DEMO_ROLES_V1[i]);
      expect(v2Idx).toBe(i);
    }
  });

  it('v1에 존재하는 event의 v2 position — demo-snapshot SSOT와 일치', () => {
    for (let i = 0; i < DEMO_EVENTS_V1.length; i++) {
      const v2Idx = DEMO_EVENTS_V2.indexOf(DEMO_EVENTS_V1[i]);
      expect(v2Idx).toBe(i);
    }
  });

  it('동일 엔티티의 v1/v2 권한 주소 — stride 변경만 반영', () => {
    // viewer: v1에서 pos=4, v2에서도 pos=4
    const permSvcPos = 7; // payment:shop
    const viewerPos = DEMO_ROLES_V1.indexOf('viewer') + 1;

    const v1Addr = (permSvcPos - 1) * DEMO_ROLES_V1.length + (viewerPos - 1);
    const v2Addr = (permSvcPos - 1) * DEMO_ROLES_V2.length + (viewerPos - 1);

    // position 동일 → 주소 차이는 stride 변경(5→6)에서만 발생
    expect(v1Addr).toBe((permSvcPos - 1) * 5 + (viewerPos - 1));
    expect(v2Addr).toBe((permSvcPos - 1) * 6 + (viewerPos - 1));
  });

  it('신규 역할(customer)은 v2에서 마지막 position', () => {
    const customerIdx = DEMO_ROLES_V2.indexOf('customer');
    expect(customerIdx).toBe(DEMO_ROLES_V2.length - 1);
    expect(customerIdx).toBeGreaterThanOrEqual(DEMO_ROLES_V1.length);
  });

  it('신규 이벤트는 v2에서 마지막에 추가', () => {
    const v1Set = new Set<string>(DEMO_EVENTS_V1);
    for (let i = 0; i < DEMO_EVENTS_V2.length; i++) {
      if (!v1Set.has(DEMO_EVENTS_V2[i])) {
        expect(i).toBeGreaterThanOrEqual(DEMO_EVENTS_V1.length);
      }
    }
  });
});
