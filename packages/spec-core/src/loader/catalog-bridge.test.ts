// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, it, expect } from 'vitest';
import { catalogToPrefixSpecs, prefixToPrefixSpec } from './catalog-bridge.js';
import { ExportSurfaceRegistry } from '../export-surface/export-surface.registry.js';

/**
 * DEMO_CATALOG의 구조를 그대로 사용하여 브릿지를 검증한다.
 * demo-snapshot에 직접 의존하지 않고 동일한 구조의 테스트 데이터를 사용.
 */
const TEST_CATALOG = {
  prefixes: {
    service: {
      id: 'service',
      name: '서비스',
      description: 'env × region × svc_name × namespace 4차원 서비스 주소 공간',
      labels: ['env', 'region', 'svc_name', 'namespace'],
      dims: {
        env: { kind: 'axis' as const, axisId: 'env' },
        region: { kind: 'axis' as const, axisId: 'region' },
        svc_name: { kind: 'axis' as const, axisId: 'svc_name' },
        namespace: { kind: 'axis' as const, axisId: 'namespace' },
      },
      versions: [{ version: 'v1' }],
    },
    permission: {
      id: 'permission',
      name: '권한',
      description: 'perm_svc(서비스 참조) × role 2차원 권한 주소 공간',
      labels: ['perm_svc', 'role'],
      dims: {
        perm_svc: { kind: 'prefix_ref' as const, prefixId: 'service' },
        role: { kind: 'axis' as const, axisId: 'role' },
      },
      versions: [{ version: 'v1' }, { version: 'v2' }, { version: 'v3' }, { version: 'v4' }],
    },
    cart_event: {
      id: 'cart_event',
      name: '장바구니 이벤트',
      description: 'actor(member) × action × target(item)',
      labels: ['actor', 'action', 'target'],
      dims: {
        actor: { kind: 'table_ref' as const, table: 'members' },
        action: { kind: 'axis' as const, axisId: 'cart_action' },
        target: { kind: 'table_ref' as const, table: 'items' },
      },
      versions: [{ version: 'v1' }],
    },
    order_event: {
      id: 'order_event',
      name: '주문 이벤트',
      description: 'actor(member) × action × order(table) × service_ctx(prefix_ref)',
      labels: ['service_ctx', 'actor', 'action', 'order'],
      dims: {
        service_ctx: { kind: 'prefix_ref' as const, prefixId: 'service' },
        actor: { kind: 'table_ref' as const, table: 'members' },
        action: { kind: 'axis' as const, axisId: 'order_action' },
        order: { kind: 'table_ref' as const, table: 'orders' },
      },
      versions: [{ version: 'v1' }],
    },
    rbac: {
      id: 'rbac',
      name: 'RBAC',
      description: 'role × action × resource 3차원 권한 모델',
      labels: ['role', 'action', 'resource'],
      dims: {
        role: { kind: 'axis' as const, axisId: 'rbac_role' },
        action: { kind: 'axis' as const, axisId: 'action' },
        resource: { kind: 'axis' as const, axisId: 'resource' },
      },
      versions: [{ version: 'v1' }],
    },
  },
} as const;

describe('catalogToPrefixSpecs', () => {
  const specs = catalogToPrefixSpecs(TEST_CATALOG);

  it('converts all prefixes', () => {
    expect(specs).toHaveLength(5);
    const ids = specs.map((s) => s.id);
    expect(ids).toContain('service');
    expect(ids).toContain('permission');
    expect(ids).toContain('cart_event');
    expect(ids).toContain('order_event');
    expect(ids).toContain('rbac');
  });

  it('preserves rationale from description', () => {
    const service = specs.find((s) => s.id === 'service')!;
    expect(service.rationale).toBe('env × region × svc_name × namespace 4차원 서비스 주소 공간');
  });

  it('uses latest version', () => {
    const permission = specs.find((s) => s.id === 'permission')!;
    expect(permission.version).toBe('v4');
  });
});

describe('export surface — axis only prefix', () => {
  it('service: 4 axis dims → all in export', () => {
    const spec = prefixToPrefixSpec(TEST_CATALOG.prefixes.service);

    expect(spec.export.dims).toEqual(['env', 'region', 'svc_name', 'namespace']);
    expect(spec.export.pattern).toBe('{env}.{region}.{svc_name}.{namespace}');
    expect(spec.imports).toBeUndefined();
  });

  it('rbac: 3 axis dims → all in export', () => {
    const spec = prefixToPrefixSpec(TEST_CATALOG.prefixes.rbac);

    expect(spec.export.dims).toEqual(['role', 'action', 'resource']);
    expect(spec.export.pattern).toBe('{role}.{action}.{resource}');
  });
});

describe('export surface — prefix_ref included', () => {
  it('permission: prefix_ref + axis → both in export, prefix_ref in imports', () => {
    const spec = prefixToPrefixSpec(TEST_CATALOG.prefixes.permission);

    // perm_svc (prefix_ref) + role (axis) — labels 순서 유지
    expect(spec.export.dims).toEqual(['perm_svc', 'role']);
    expect(spec.export.pattern).toBe('{perm_svc}.{role}');

    // imports에 prefix_ref 매핑
    expect(spec.imports).toEqual({ perm_svc: 'service' });
  });
});

describe('export surface — table_ref excluded', () => {
  it('cart_event: table_ref excluded, only axis in export', () => {
    const spec = prefixToPrefixSpec(TEST_CATALOG.prefixes.cart_event);

    // actor(table_ref), target(table_ref) 제외 → action만
    expect(spec.export.dims).toEqual(['action']);
    expect(spec.export.pattern).toBe('{action}');
    expect(spec.imports).toBeUndefined();
  });

  it('order_event: mixed — prefix_ref + axis in export, table_ref excluded', () => {
    const spec = prefixToPrefixSpec(TEST_CATALOG.prefixes.order_event);

    // service_ctx(prefix_ref) + action(axis) — labels 순서대로
    // actor(table_ref), order(table_ref) 제외
    expect(spec.export.dims).toEqual(['service_ctx', 'action']);
    expect(spec.export.pattern).toBe('{service_ctx}.{action}');

    expect(spec.imports).toEqual({ service_ctx: 'service' });
  });
});

describe('dims conversion', () => {
  it('converts all dim kinds correctly', () => {
    const spec = prefixToPrefixSpec(TEST_CATALOG.prefixes.order_event);

    expect(spec.dims.service_ctx).toEqual({ kind: 'prefix_ref', prefixId: 'service' });
    expect(spec.dims.actor).toEqual({ kind: 'table_ref', table: 'members' });
    expect(spec.dims.action).toEqual({ kind: 'axis', axisId: 'order_action' });
    expect(spec.dims.order).toEqual({ kind: 'table_ref', table: 'orders' });
  });
});

describe('integration with ExportSurfaceRegistry', () => {
  it('registers converted specs and resolves titles', () => {
    const specs = catalogToPrefixSpecs(TEST_CATALOG);
    const registry = new ExportSurfaceRegistry();

    for (const spec of specs) {
      registry.register(spec.id, spec.export);
    }

    // service: 4 axis dims
    expect(
      registry.resolve('service', {
        env: 'prod',
        region: 'asia',
        svc_name: 'shopping-web',
        namespace: 'shop',
      }),
    ).toBe('prod.asia.shopping-web.shop');

    // permission: prefix_ref + axis
    expect(
      registry.resolve('permission', {
        perm_svc: '40',
        role: 'admin',
      }),
    ).toBe('40.admin');

    // cart_event: table_ref excluded
    expect(
      registry.resolve('cart_event', {
        action: 'add',
      }),
    ).toBe('add');

    // rbac: 3 axis dims
    expect(
      registry.resolve('rbac', {
        role: 'admin',
        action: 'read',
        resource: 'teams',
      }),
    ).toBe('admin.read.teams');
  });
});
