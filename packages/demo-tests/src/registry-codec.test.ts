// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * MetaRegistry + MetaCodec 통합 테스트.
 *
 * demo-snapshot의 스키마 데이터로 MetaRegistry를 생성하고
 * 인코딩/디코딩 라운드트립, 크로스인덱스 참조를 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { MetaRegistry } from 'index-meta';
import {
  buildDemoRegistryInput,
  DEMO_ENVS,
  DEMO_REGIONS,
  DEMO_SVCS,
  DEMO_NSS,
  DEMO_ROLES_V1,
  DEMO_ROLES_V2,
  DEMO_EVENTS_V1,
  DEMO_EVENTS_V2,
} from 'demo-snapshot';

const registryInput = buildDemoRegistryInput();
const registry = new MetaRegistry(registryInput);
const eventSvcRefDim = registryInput.indices.event.dims[0];

function serviceAddr(input: { env: string; region: string; svc_name: string; namespace: string }) {
  return registry.createCodec('service', 'v1').encode(input).value;
}

const permSvcEntriesV2 = registryInput.dims.perm_svc.snapshots.v2.entries as readonly number[];

describe('MetaRegistry — demo 스키마 통합', () => {
  it('서비스 코덱 인코딩/디코딩 라운드트립', () => {
    const codec = registry.createCodec('service', 'v1');
    expect(codec.shape).toEqual([
      DEMO_ENVS.length,
      DEMO_REGIONS.length,
      DEMO_SVCS.length,
      DEMO_NSS.length,
    ]);
    expect(codec.size).toBe(
      DEMO_ENVS.length * DEMO_REGIONS.length * DEMO_SVCS.length * DEMO_NSS.length,
    );

    const vv = codec.encode({
      env: 'prod',
      region: 'asia',
      svc_name: 'payment',
      namespace: 'shop',
    });
    expect(vv.value).toBe(
      serviceAddr({ env: 'prod', region: 'asia', svc_name: 'payment', namespace: 'shop' }),
    );

    const decoded = codec.decode(vv);
    expect(decoded['env']).toBe('prod');
    expect(decoded['svc_name']).toBe('payment');
    expect(decoded['namespace']).toBe('shop');
  });

  it('권한 코덱 v1/v2 shape 차이', () => {
    const v1 = registry.createCodec('permission', 'v1');
    const v2 = registry.createCodec('permission', 'v2');

    expect(v1.shape).toEqual([
      registryInput.dims.perm_svc.snapshots.v1.entries.length,
      DEMO_ROLES_V1.length,
    ]);
    expect(v2.shape).toEqual([
      registryInput.dims.perm_svc.snapshots.v2.entries.length,
      DEMO_ROLES_V2.length,
    ]);
    expect(v2.size).toBeGreaterThan(v1.size);
  });

  it('권한 코덱 — demo-snapshot 헬퍼와 주소 일치', () => {
    const v2 = registry.createCodec('permission', 'v2');
    const paymentShop = serviceAddr({
      env: 'prod',
      region: 'asia',
      svc_name: 'payment',
      namespace: 'shop',
    });
    const paymentShopPos = permSvcEntriesV2.indexOf(paymentShop) + 1;
    const viewerPos = DEMO_ROLES_V2.indexOf('viewer') + 1;

    const viewerAddr = (paymentShopPos - 1) * DEMO_ROLES_V2.length + (viewerPos - 1);
    const vv = v2.encode({ perm_svc: paymentShop, role: 'viewer' });
    expect(vv.value).toBe(viewerAddr);
  });

  it('이벤트 코덱 v1/v2 shape 차이', () => {
    const v1 = registry.createCodec('event', 'v1');
    const v2 = registry.createCodec('event', 'v2');

    expect(v1.shape).toEqual([
      registryInput.dims[eventSvcRefDim].snapshots.v1.entries.length,
      DEMO_EVENTS_V1.length,
      2,
    ]);
    expect(v2.shape).toEqual([
      registryInput.dims[eventSvcRefDim].snapshots.v2.entries.length,
      DEMO_EVENTS_V2.length,
      2,
    ]);
  });

  it('이벤트 코덱 — stride가 demo-snapshot과 일치', () => {
    const v1 = registry.createCodec('event', 'v1');
    const v2 = registry.createCodec('event', 'v2');

    expect(v1.strides[0]).toBe(DEMO_EVENTS_V1.length * 2);
    expect(v2.strides[0]).toBe(DEMO_EVENTS_V2.length * 2);
  });

  it('크로스인덱스 — perm_svc 디코딩 → 서비스 좌표', () => {
    const permCodec = registry.createCodec('permission', 'v2');
    const svcCodec = registry.createCodec('service', 'v1');
    const paymentShop = serviceAddr({
      env: 'prod',
      region: 'asia',
      svc_name: 'payment',
      namespace: 'shop',
    });

    const permVv = permCodec.encode({ perm_svc: paymentShop, role: 'admin' });
    const permDecoded = permCodec.decode(permVv);

    const svcValue = Number(permDecoded['perm_svc']);
    expect(svcValue).toBe(paymentShop);

    const svcDecoded = svcCodec.decodeValue(svcValue);
    expect(svcDecoded['svc_name']).toBe('payment');
    expect(svcDecoded['env']).toBe('prod');
  });

  it('matchRanges — 특정 서비스의 전체 role 범위 쿼리', () => {
    const codec = registry.createCodec('permission', 'v2');
    const roleStride = DEMO_ROLES_V2.length;
    const paymentShop = serviceAddr({
      env: 'prod',
      region: 'asia',
      svc_name: 'payment',
      namespace: 'shop',
    });

    // permSvcPos 7 (payment:shop) 의 모든 roles
    const ranges = codec.matchRanges({ perm_svc: paymentShop, role: null });
    expect(ranges.length).toBe(1);
    expect(ranges[0][1] - ranges[0][0] + 1).toBe(roleStride);
  });
});
