// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * D-1 계약: PermissionCodec._buildMap()과 LabelRegistry._buildCache()의 동등성.
 *
 * 같은 ID 배열 → 같은 1-based index 매핑을 검증한다.
 * Phase 1에서 PermissionCodec이 LabelRegistry로 위임할 때 이 계약이 안전망이 된다.
 */
import { describe, expect, it } from 'vitest';
import { PermissionCodec, type CodecDims } from 'permission-engine';
import { createLabelRegistry } from 'weighted-index';

const DIMS: CodecDims = {
  services: ['shop/payment', 'cms/auth', 'api/gateway'],
  types: ['api', 'page', 'action'],
  resources: ['admin/teams', 'billing/invoices', 'dashboard', 'settings'],
  actions: ['GET', 'POST', 'PUT', 'DELETE'],
};

describe('D-1: label→index 맵 동등성', () => {
  it('PermissionCodec과 LabelRegistry가 같은 ID에 같은 1-based index를 부여한다', () => {
    const codec = new PermissionCodec('v1', DIMS);
    const labels = createLabelRegistry({
      service: [{ version: 'v1', ids: [...DIMS.services] }],
      type: [{ version: 'v1', ids: [...DIMS.types] }],
      resource: [{ version: 'v1', ids: [...DIMS.resources] }],
      action: [{ version: 'v1', ids: [...DIMS.actions] }],
    });

    // encode → 같은 좌표 → 같은 주소
    for (const service of DIMS.services) {
      for (const type of DIMS.types) {
        for (const resource of DIMS.resources) {
          for (const action of DIMS.actions) {
            const permAddr = codec.encodeRaw(service, type, resource, action);
            const coords = [
              labels.getIndex('service', 'v1', service),
              labels.getIndex('type', 'v1', type),
              labels.getIndex('resource', 'v1', resource),
              labels.getIndex('action', 'v1', action),
            ];
            // LabelRegistry index는 1-based, WeightedIndex.encode도 1-based
            // 같은 좌표로 같은 WeightedIndex를 사용하면 같은 주소
            const wi = codec.index;
            expect(wi.encode(coords)).toBe(permAddr);
          }
        }
      }
    }
  });

  it('decode 결과도 동일하다 — LabelRegistry의 역방향 맵과 PermissionCodec의 배열 인덱싱이 일치', () => {
    const codec = new PermissionCodec('v1', DIMS);
    const labels = createLabelRegistry({
      service: [{ version: 'v1', ids: [...DIMS.services] }],
      type: [{ version: 'v1', ids: [...DIMS.types] }],
      resource: [{ version: 'v1', ids: [...DIMS.resources] }],
      action: [{ version: 'v1', ids: [...DIMS.actions] }],
    });

    for (let address = 0; address < codec.size; address++) {
      const decoded = codec.decode(address);
      const coords = codec.index.decode(address);

      // LabelRegistry 역방향 맵이 같은 entity ID를 반환
      expect(labels.getEntityId('service', 'v1', coords[0])).toBe(decoded.service);
      expect(labels.getEntityId('type', 'v1', coords[1])).toBe(decoded.type);
      expect(labels.getEntityId('resource', 'v1', coords[2])).toBe(decoded.resource);
      expect(labels.getEntityId('action', 'v1', coords[3])).toBe(decoded.action);
    }
  });

  it('duplicate ID 거부 동작이 동일하다', () => {
    expect(
      () =>
        new PermissionCodec('v1', {
          ...DIMS,
          services: ['shop/payment', 'shop/payment'],
        }),
    ).toThrow(/[Dd]uplicate/);

    expect(() =>
      createLabelRegistry({
        service: [{ version: 'v1', ids: ['shop/payment', 'shop/payment'] }],
      }),
    ).toThrow(/[Dd]uplicate/);
  });

  it('빈 배열 거부 동작이 동일하다', () => {
    expect(
      () =>
        new PermissionCodec('v1', {
          ...DIMS,
          services: [],
        }),
    ).toThrow();

    expect(() =>
      createLabelRegistry({
        service: [{ version: 'v1', ids: [] }],
      }),
    ).toThrow();
  });

  it('특수문자가 포함된 ID도 동일하게 처리된다', () => {
    const specialDims: CodecDims = {
      services: ['ns/svc-1', 'ns/svc.2', 'ns/svc_3'],
      types: ['api'],
      resources: ['admin/teams/sub', 'a/b/c/d'],
      actions: ['GET'],
    };

    const codec = new PermissionCodec('v1', specialDims);
    const labels = createLabelRegistry({
      service: [{ version: 'v1', ids: [...specialDims.services] }],
      type: [{ version: 'v1', ids: [...specialDims.types] }],
      resource: [{ version: 'v1', ids: [...specialDims.resources] }],
      action: [{ version: 'v1', ids: [...specialDims.actions] }],
    });

    for (const svc of specialDims.services) {
      const permIdx = codec.encodeRaw(svc, 'api', 'admin/teams/sub', 'GET');
      const labelIdx = labels.getIndex('service', 'v1', svc);
      const coords = codec.index.decode(permIdx);
      expect(coords[0]).toBe(labelIdx);
    }
  });
});
