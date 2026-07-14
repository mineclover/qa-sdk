// @def.doc definition-catalog-spec

import { describe, it, expect } from 'vitest';
import {
  encodeDocument,
  decodeDocument,
  serializeDocumentAddress,
  parseDocumentAddress,
  encodeLink,
  decodeLink,
  documentTotalSpace,
  linkTotalSpace,
} from './observe.js';
import {
  DEF_LEVEL,
  DEF_SCOPE,
  DEF_ASPECT,
  DEF_DEPTH,
  DEF_LIFECYCLE,
  LINK_TYPE,
} from './vocabulary.js';
import { allValidCombinations } from './taxonomy.js';

describe('def_document 좌표 인코딩/디코딩', () => {
  it('라운드트립: 인코딩 → 디코딩 → 원본 복원', () => {
    const coord = {
      scope: 'ui' as const,
      aspect: 'layout' as const,
      depth: 'specification' as const,
    };
    const address = encodeDocument(coord);
    const decoded = decodeDocument(address);
    expect(decoded).toEqual(coord);
  });

  it('모든 유효 scope-aspect 조합의 라운드트립 통과', () => {
    for (const { scope, aspect } of allValidCombinations()) {
      for (const depth of DEF_DEPTH.entries) {
        const coord = { scope, aspect, depth };
        const address = encodeDocument(coord);
        const decoded = decodeDocument(address);
        expect(decoded).toEqual(coord);
      }
    }
  });

  it('다른 좌표는 다른 주소를 생성한다', () => {
    const a = encodeDocument({ scope: 'ui', aspect: 'layout', depth: 'overview' });
    const b = encodeDocument({ scope: 'ui', aspect: 'component', depth: 'overview' });
    const c = encodeDocument({ scope: 'data', aspect: 'domain_data', depth: 'overview' });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('level은 좌표에 포함하지 않는다 (메타데이터)', () => {
    // level이 달라도 같은 scope×aspect×depth면 같은 주소
    const a = encodeDocument({ scope: 'feature', aspect: 'func_def', depth: 'overview' });
    const b = encodeDocument({ scope: 'feature', aspect: 'func_def', depth: 'overview' });
    expect(a).toBe(b);
    // level은 frontmatter에서 파싱되지만 주소 인코딩에 사용되지 않음
  });

  it('존재하지 않는 entry로 인코딩하면 에러', () => {
    expect(() =>
      encodeDocument({
        scope: 'invalid' as any,
        aspect: 'layout',
        depth: 'overview',
      }),
    ).toThrow();
  });
});

describe('직렬화/파싱', () => {
  it('직렬화 형식: def_document:v1:<address>', () => {
    const address = encodeDocument({ scope: 'ui', aspect: 'layout', depth: 'overview' });
    const serialized = serializeDocumentAddress(address);
    expect(serialized).toMatch(/^def_document:v1:\d+$/);
  });

  it('파싱 라운드트립', () => {
    const address = encodeDocument({
      scope: 'feature',
      aspect: 'func_def',
      depth: 'specification',
    });
    const serialized = serializeDocumentAddress(address);
    const parsed = parseDocumentAddress(serialized);
    expect(parsed).toBe(address);
  });

  it('유효하지 않은 문자열은 null 반환', () => {
    expect(parseDocumentAddress('invalid')).toBeNull();
    expect(parseDocumentAddress('def_link:v1:42')).toBeNull();
    expect(parseDocumentAddress('')).toBeNull();
  });
});

describe('def_link 좌표 인코딩/디코딩', () => {
  it('라운드트립', () => {
    const coord = {
      scope: 'ui' as const,
      aspect: 'component' as const,
      linkType: 'depends_on' as const,
    };
    const address = encodeLink(coord);
    const decoded = decodeLink(address);
    expect(decoded).toEqual(coord);
  });

  it('모든 link_type에 대해 라운드트립 통과', () => {
    for (const lt of LINK_TYPE.entries) {
      const coord = { scope: 'feature' as const, aspect: 'func_def' as const, linkType: lt };
      const address = encodeLink(coord);
      const decoded = decodeLink(address);
      expect(decoded.linkType).toBe(lt);
    }
  });
});

describe('주소 공간', () => {
  it('def_document totalSpace = scope.cap × aspect.cap × depth.cap (level, lifecycle 제외)', () => {
    const expected = DEF_SCOPE.capacity * DEF_ASPECT.capacity * DEF_DEPTH.capacity;
    expect(documentTotalSpace()).toBe(expected);
  });

  it('def_link totalSpace = scope.cap × aspect.cap × link_type.cap', () => {
    const expected = DEF_SCOPE.capacity * DEF_ASPECT.capacity * LINK_TYPE.capacity;
    expect(linkTotalSpace()).toBe(expected);
  });

  it('totalSpace ≤ MAX_SAFE_INTEGER (safePrecision)', () => {
    expect(documentTotalSpace()).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(linkTotalSpace()).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});

describe('축 capacity 규칙', () => {
  function nextPowerOf2(n: number): number {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  it('모든 축이 nextPowerOf2(entries.length * 2) 이상', () => {
    const axes = [
      { name: 'def_level', entries: DEF_LEVEL.entries, capacity: DEF_LEVEL.capacity },
      { name: 'def_scope', entries: DEF_SCOPE.entries, capacity: DEF_SCOPE.capacity },
      { name: 'def_aspect', entries: DEF_ASPECT.entries, capacity: DEF_ASPECT.capacity },
      { name: 'def_depth', entries: DEF_DEPTH.entries, capacity: DEF_DEPTH.capacity },
      { name: 'def_lifecycle', entries: DEF_LIFECYCLE.entries, capacity: DEF_LIFECYCLE.capacity },
      { name: 'link_type', entries: LINK_TYPE.entries, capacity: LINK_TYPE.capacity },
    ];

    for (const axis of axes) {
      const minCap = nextPowerOf2(axis.entries.length * 2);
      expect(
        axis.capacity,
        `${axis.name}: capacity ${axis.capacity} < min ${minCap}`,
      ).toBeGreaterThanOrEqual(minCap);
    }
  });
});
