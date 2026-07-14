// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * decode-distribution E2E 테스트
 *
 * 전체 파이프라인 시뮬레이션:
 * 1. MetaRegistry + cross-index refs (permission → service) 생성
 * 2. MetaResolver.getDecodeMapBundle() 호출
 * 3. JSON 직렬화 → 역직렬화 (네트워크 전송 시뮬)
 * 4. PrefixDecoder 생성
 * 5. number / colon / URI 입력으로 decode 검증
 * 6. decodeDeep로 index_ref 체인 해석 검증
 * 7. 서버 측 decode 결과와 일치 확인
 */

import { describe, it, expect } from 'vitest';
import { MetaRegistry, MetaResolver, PrefixDecoder, type PrefixDecoderConfig } from 'index-meta';
import { AXIS } from 'demo-snapshot';

// ── 픽스처: 2-level cross-index ──────────────────────────────────────────────
//
// service = [env(2), region(3)]  → 6 combinations
// permission = [perm_svc(→service, 6), role(3)] → 18 combinations

const createFixture = () => {
  const registry = new MetaRegistry({
    dims: {
      env: {
        kind: { type: 'string_enum' },
        snapshots: {
          v1: { entries: ['prod', 'staging'] },
        },
      },
      region: {
        kind: { type: 'string_enum' },
        snapshots: {
          v1: { entries: ['asia', 'eu', 'us'] },
        },
      },
      perm_svc: {
        kind: { type: 'index_ref', indexId: 'service' },
        snapshots: {
          v1: { entries: [0, 1, 2, 3, 4, 5] },
        },
      },
      role: {
        kind: { type: 'string_enum' },
        snapshots: {
          v1: { entries: [...AXIS.role.entries] },
        },
      },
    },
    indices: {
      service: {
        dims: ['env', 'region'],
        versions: {
          v1: { snapshots: { env: 'v1', region: 'v1' } },
        },
      },
      permission: {
        dims: ['perm_svc', 'role'],
        versions: {
          v1: { snapshots: { perm_svc: 'v1', role: 'v1' } },
        },
      },
    },
  });

  return registry;
};

// ── E2E: 전체 파이프라인 ────────────────────────────────────────────────────

describe('decode distribution E2E', () => {
  it('서버 번들 → JSON 전송 → PrefixDecoder 생성 → decode 일치', () => {
    // 1. 서버 측: MetaRegistry + MetaResolver
    const registry = createFixture();
    const resolver = new MetaResolver(registry);

    // 2. 번들 생성
    const bundle = resolver.getDecodeMapBundle('permission', 'v1');
    expect(bundle.map.indexId).toBe('permission');
    expect(bundle.refs).toBeDefined();
    expect(bundle.refs!['service']).toBeDefined();

    // 3. JSON 직렬화 → 역직렬화 (네트워크 전송 시뮬)
    const json = JSON.stringify(bundle);
    const received: PrefixDecoderConfig = JSON.parse(json);

    // 4. PrefixDecoder 생성
    const decoder = new PrefixDecoder(received);
    expect(decoder.indexId).toBe('permission');
    expect(decoder.size).toBe(18);

    // 5. 서버 측 코덱으로 참조 decode
    const serverPermCodec = registry.createCodec('permission', 'v1');
    const serverSvcCodec = registry.createCodec('service', 'v1');

    // 6. 모든 주소에 대해 서버 vs 클라이언트 일치 확인
    for (let value = 0; value < 18; value++) {
      // 서버 측 decode
      const serverDecoded = serverPermCodec.decodeValue(value);

      // 클라이언트 decode(number)
      const clientDecoded = decoder.decode(value);
      expect(clientDecoded).toEqual(serverDecoded);

      // 클라이언트 decode(colon)
      const colonStr = `permission:v1:${value}`;
      const clientFromColon = decoder.decode(colonStr);
      expect(clientFromColon).toEqual(serverDecoded);

      // 클라이언트 decode(URI)
      const uriStr = `wi://permission/v1/${value}`;
      const clientFromUri = decoder.decode(uriStr);
      expect(clientFromUri).toEqual(serverDecoded);

      // decodeDeep: index_ref 1-level 확장
      const deep = decoder.decodeDeep(value);
      expect(deep.entities).toEqual(serverDecoded);

      // index_ref dim 검증: perm_svc의 값을 service codec으로 해석
      const svcValue = serverDecoded.perm_svc as number;
      const serverSvcDecoded = serverSvcCodec.decodeValue(svcValue);
      expect(deep.refs.perm_svc).toEqual(serverSvcDecoded);
    }
  });

  it('refs 없는 index의 번들 생성/사용', () => {
    const registry = createFixture();
    const resolver = new MetaResolver(registry);

    // service는 index_ref dim이 없으므로 refs 미포함
    const bundle = resolver.getDecodeMapBundle('service', 'v1');
    expect(bundle.refs).toBeUndefined();

    // JSON round-trip
    const received: PrefixDecoderConfig = JSON.parse(JSON.stringify(bundle));
    const decoder = new PrefixDecoder(received);

    expect(decoder.size).toBe(6);
    expect(decoder.decode(0)).toEqual({ env: 'prod', region: 'asia' });
    expect(decoder.decode(5)).toEqual({ env: 'staging', region: 'us' });
  });

  it('encode → serialize → decode round-trip', () => {
    const registry = createFixture();
    const resolver = new MetaResolver(registry);
    const bundle = resolver.getDecodeMapBundle('permission', 'v1');
    const decoder = new PrefixDecoder(JSON.parse(JSON.stringify(bundle)));

    // encode
    const entities = { perm_svc: 3, role: 'editor' };
    const vv = decoder.encode(entities);

    // serialize (colon)
    const serialized = decoder.serialize(vv);
    expect(serialized).toBe(`permission:v1:${vv.value}`);

    // decode from string
    const decoded = decoder.decode(serialized);
    expect(decoded).toEqual(entities);
  });

  it('decodeBatch: 혼합 입력 배열', () => {
    const registry = createFixture();
    const resolver = new MetaResolver(registry);
    const bundle = resolver.getDecodeMapBundle('permission', 'v1');
    const decoder = new PrefixDecoder(JSON.parse(JSON.stringify(bundle)));

    const results = decoder.decodeBatch([0, 'permission:v1:5', 'wi://permission/v1/17']);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ perm_svc: 0, role: 'admin' });
    expect(results[1]).toEqual({ perm_svc: 1, role: 'viewer' });
    expect(results[2]).toEqual({ perm_svc: 5, role: 'viewer' });
  });

  it('resolveRef: decodeDeep과 동일 결과', () => {
    const registry = createFixture();
    const resolver = new MetaResolver(registry);
    const bundle = resolver.getDecodeMapBundle('permission', 'v1');
    const decoder = new PrefixDecoder(JSON.parse(JSON.stringify(bundle)));

    for (let value = 0; value < decoder.size; value++) {
      const deep = decoder.decodeDeep(value);
      const ref = decoder.resolveRef(value, 'perm_svc');
      expect(ref).toEqual(deep.refs.perm_svc);
    }
  });

  it('matchRanges: cross-index 조건 검증', () => {
    const registry = createFixture();
    const resolver = new MetaResolver(registry);
    const bundle = resolver.getDecodeMapBundle('permission', 'v1');
    const decoder = new PrefixDecoder(JSON.parse(JSON.stringify(bundle)));

    // perm_svc=0 (service: env=prod, region=asia) → value range
    const ranges = decoder.matchRanges({ perm_svc: 0 });
    expect(ranges).toEqual([[0, 2]]);

    // 범위 내 모든 값이 perm_svc=0인지 확인
    for (const [from, to] of ranges) {
      for (let v = from; v <= to; v++) {
        const decoded = decoder.decode(v);
        expect(decoded.perm_svc).toBe(0);
      }
    }
  });
});
