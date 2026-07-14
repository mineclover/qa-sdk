// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * invariants.test.ts — 변환 불변조건 갭 보강 테스트
 *
 * 기존 테스트에서 이미 커버되는 불변조건은 중복 작성하지 않으며,
 * 커버리지 갭이 있는 영역만 보강한다.
 *
 * [INV-G1] gate inactive 주소 decode 보존 (INV-6 보강)
 * [INV-G2] deepDecode through serialization (INV-11 full stack 보강)
 * [INV-G3] BigInt/Number 교차 검증 (INV-9 보강)
 * [INV-G4] Full stack 4-protocol roundtrip (INV-11 + INV-12 보강)
 */

import { describe, it, expect } from 'vitest';
import {
  WeightedIndex,
  WeightedIndexBig,
  colonProtocol,
  uriProtocol,
  compactProtocol,
  createLayoutProtocol,
  PACK_FORMATS,
  type AddressProtocol,
} from 'weighted-index';
import {
  MetaRegistry,
  deepDecode,
  computeStateRanges,
  checkGate,
  type DimStateSpec,
} from 'index-meta';

// ── 공통 픽스처 ──────────────────────────────────────────────

/** 2-level cross-index registry for deepDecode tests */
function createCrossIndexFixture() {
  return new MetaRegistry({
    dims: {
      format: {
        kind: { type: 'string_enum' },
        snapshots: {
          v1: { entries: ['HTML', 'PDF', 'EPUB'] },
        },
      },
      lang: {
        kind: { type: 'string_enum' },
        snapshots: {
          v1: { entries: ['en', 'ko'] },
        },
      },
      tier: {
        kind: { type: 'index_ref', indexId: 'doc_meta' },
        snapshots: {
          // doc_meta: format(3) × lang(2) = 6
          v1: { entries: [0, 1, 2, 3, 4, 5] },
        },
      },
      priority: {
        kind: { type: 'number_enum' },
        snapshots: {
          v1: { entries: [0, 1, 2] },
        },
      },
    },
    indices: {
      doc_meta: {
        dims: ['format', 'lang'],
        versions: {
          v1: { snapshots: { format: 'v1', lang: 'v1' } },
        },
      },
      article: {
        dims: ['tier', 'priority'],
        versions: {
          v1: { snapshots: { tier: 'v1', priority: 'v1' } },
        },
      },
    },
    address: {
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 4,
      schemas: { doc_meta: 1, article: 2 },
      versions: { v1: 1 },
    },
  });
}

// ── INV-G1: gate inactive 주소 decode 보존 ───────────────────

describe('[INV-G1] inactive 주소는 decode 가능, encode 불가 (INV-6 보강)', () => {
  it('entry 비활성 → checkGate encode=false → MetaCodec.decode 정상', () => {
    // shape [4, 3] → capacity 12
    // dim0 position 3 = inactive
    const shape = [4, 3];
    const specs: DimStateSpec[] = [{ dimIndex: 0, state: 'inactive', coords: '3' }];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(shape, specs);

    // dim0 position 3의 주소 범위: (3-1)*3 = 6 ~ 8
    const addr = 6; // (role=3, action=1)
    const gate = checkGate(addr, reservedRanges, inactiveRanges, openRanges);
    expect(gate.encode).toBe(false);
    expect(gate.decode).toBe(true);
    expect(gate.state).toBe('inactive');

    // MetaCodec를 사용한 decode — inactive 주소도 정상적으로 decode 가능해야 한다
    const registry = new MetaRegistry({
      dims: {
        role: {
          kind: { type: 'string_enum' },
          snapshots: {
            v1: { entries: ['admin', 'editor', 'viewer', 'guest'] },
          },
        },
        action: {
          kind: { type: 'string_enum' },
          snapshots: {
            v1: { entries: ['read', 'write', 'delete'] },
          },
        },
      },
      indices: {
        perm: {
          dims: ['role', 'action'],
          versions: {
            v1: { snapshots: { role: 'v1', action: 'v1' } },
          },
        },
      },
    });

    const codec = registry.createCodec('perm', 'v1');
    // addr=6 → role=3(viewer), action=1(read) in 1-based → viewer, read
    const decoded = codec.decodeValue(addr);
    expect(decoded.role).toBe('viewer');
    expect(decoded.action).toBe('read');
  });
});

// ── INV-G2: deepDecode through serialization ─────────────────

describe('[INV-G2] full stack: encode → serialize → parse → deepDecode (INV-11 보강)', () => {
  it('encode composite → serialize(colon) → parse → deepDecode → entity 일치', () => {
    const registry = createCrossIndexFixture();

    // encode article entity
    const articleCodec = registry.createCodec('article', 'v1');
    const docMetaCodec = registry.createCodec('doc_meta', 'v1');

    // doc_meta: format=PDF(2), lang=ko(2) → value = (2-1)*2 + (2-1) = 3
    const docMetaVV = docMetaCodec.encode({ format: 'PDF', lang: 'ko' });
    expect(docMetaVV.value).toBe(3);

    // article: tier=3 (doc_meta addr=3), priority=1 (value=0)
    const articleVV = articleCodec.encode({ tier: 3, priority: 0 });

    // serialize → parse roundtrip (colon)
    const serialized = registry.serialize(articleVV, 'colon');
    const parsed = registry.parse(serialized);
    expect(parsed).toEqual(articleVV);

    // deepDecode from parsed value
    const result = deepDecode(parsed, registry);
    expect(result.layers.has('article')).toBe(true);
    expect(result.layers.has('doc_meta')).toBe(true);

    const docMetaLayer = result.layers.get('doc_meta')!;
    expect(docMetaLayer.format).toBe('PDF');
    expect(docMetaLayer.lang).toBe('ko');
  });
});

// ── INV-G3: BigInt/Number 교차 검증 ─────────────────────────

describe('[INV-G3] BigInt/Number 동일 결과 (INV-9 보강)', () => {
  it('동일 shape에서 WeightedIndex vs WeightedIndexBig 결과 동일', () => {
    const shape = [5, 8, 3];
    const shapeBig = shape.map(BigInt);

    const wi = new WeightedIndex(shape);
    const wiBig = new WeightedIndexBig(shapeBig);

    expect(Number(wiBig.size)).toBe(wi.size);

    // 모든 주소에 대해 encode/decode roundtrip 일치
    for (let v = 0; v < wi.size; v++) {
      const coords = wi.decode(v);
      const coordsBig = wiBig.decode(BigInt(v));

      // 좌표 일치
      expect(coordsBig.map(Number)).toEqual(coords);

      // 재encode 일치
      expect(Number(wiBig.encode(coordsBig))).toBe(wi.encode(coords));
    }
  });

  it('비대칭 shape에서도 일치', () => {
    const shape = [2, 10, 7, 3];
    const shapeBig = shape.map(BigInt);

    const wi = new WeightedIndex(shape);
    const wiBig = new WeightedIndexBig(shapeBig);

    // 샘플링: 첫/마지막/중간 주소
    const samples = [0, 1, wi.size - 1, Math.floor(wi.size / 2), Math.floor(wi.size / 3)];
    for (const v of samples) {
      const coords = wi.decode(v);
      const coordsBig = wiBig.decode(BigInt(v));
      expect(coordsBig.map(Number)).toEqual(coords);
      expect(Number(wiBig.encode(coordsBig))).toBe(v);
    }
  });
});

// ── INV-G4: Full stack 4-protocol roundtrip ──────────────────

describe('[INV-G4] Full stack 4-protocol roundtrip (INV-11 + INV-12 보강)', () => {
  const registry = createCrossIndexFixture();
  const codec = registry.createCodec('doc_meta', 'v1');

  // 4개 프로토콜: colon, uri, compact, layout:uuid
  const layoutProto = createLayoutProtocol({
    format: PACK_FORMATS.uuid,
    schemaChars: 4,
    versionChars: 4,
    schemas: { doc_meta: 1 },
    versions: { v1: 1 },
  });

  const protocols: [string, AddressProtocol][] = [
    ['colon', colonProtocol],
    ['uri', uriProtocol],
    ['compact', compactProtocol],
    ['layout:uuid', layoutProto],
  ];

  it('encode → serialize(p) → parse → decode 를 4개 프로토콜 각각', () => {
    // encode entity
    const entities = { format: 'EPUB', lang: 'en' };
    const vv = codec.encode(entities);

    for (const [name, proto] of protocols) {
      // serialize
      const addr = { schema: vv.indexId, version: vv.versionId, index: vv.value };
      const serialized = proto.serialize(addr);

      // parse
      const parsed = proto.parse(serialized);
      expect(parsed.schema).toBe(vv.indexId);
      expect(parsed.version).toBe(vv.versionId);
      expect(parsed.index).toBe(vv.value);

      // decode back
      const decoded = codec.decodeValue(parsed.index);
      expect(decoded).toEqual(entities);
    }
  });

  it('cross-protocol: serialize(p1) → convert to p2 → parse(p2) → 동일 VersionedValue', () => {
    const entities = { format: 'HTML', lang: 'ko' };
    const vv = codec.encode(entities);
    const addr = { schema: vv.indexId, version: vv.versionId, index: vv.value };

    // 모든 프로토콜 쌍에 대해 cross-convert roundtrip
    for (const [name1, proto1] of protocols) {
      const serialized1 = proto1.serialize(addr);

      for (const [name2, proto2] of protocols) {
        // p1 → parse → p2 → serialize → parse → 비교
        const intermediate = proto1.parse(serialized1);
        const serialized2 = proto2.serialize(intermediate);
        const final = proto2.parse(serialized2);

        expect(final.schema).toBe(addr.schema);
        expect(final.version).toBe(addr.version);
        expect(final.index).toBe(addr.index);
      }
    }
  });
});
