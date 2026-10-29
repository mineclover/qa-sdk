// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from 'vitest';
import type { Catalog } from './catalog.types.js';
import { isCodecContractError } from './snapshot/codec-errors.js';
import {
  decodePrefix,
  decodePrefixPartial,
  encodePrefix,
  encodePrefixByValue,
  getPrefixShape,
  resolveAddress,
} from './runtime.js';

const TEST_CATALOG: Catalog = {
  id: 'test',
  name: 'Test Catalog',
  axes: {
    env: {
      id: 'env',
      name: '환경',
      versions: { v1: { entries: ['dev', 'prod'], capacity: 4 } },
    },
    role: {
      id: 'role',
      name: '역할',
      versions: { v1: { entries: ['admin', 'viewer'], capacity: 4 } },
    },
  },
  prefixes: {
    service: {
      id: 'service',
      name: '서비스',
      labels: ['env'],
      dims: { env: { kind: 'axis', axisId: 'env' } },
      versions: [{ version: 'v1', axisVersions: { env: 'v1' } }],
    },
    permission: {
      id: 'permission',
      name: '권한',
      labels: ['svc_ref', 'role'],
      dims: {
        svc_ref: { kind: 'prefix_ref', prefixId: 'service' },
        role: { kind: 'axis', axisId: 'role' },
      },
      versions: [
        {
          version: 'v1',
          axisVersions: { role: 'v1' },
          refEntries: { svc_ref: { values: [0, 1], refVersion: 'v1' } },
        },
      ],
    },
  },
};

describe('catalog runtime closed-space boundaries', () => {
  it('encodePrefix rejects positions outside dim capacity', () => {
    expect(() =>
      encodePrefix(TEST_CATALOG, 'permission', 'v1', {
        svc_ref: 2,
        role: 0,
      }),
    ).toThrow(/position.*svc_ref.*\[0, 1\]/);

    expect(() =>
      encodePrefix(TEST_CATALOG, 'permission', 'v1', {
        svc_ref: 0,
        role: -1,
      }),
    ).toThrow(/position.*role.*\[0, 3\]/);
  });

  it('encodePrefixByValue rejects unknown ref values', () => {
    expect(() =>
      encodePrefixByValue(TEST_CATALOG, 'permission', 'v1', {
        svc_ref: 99,
        role: 'admin',
      }),
    ).toThrow(/Unknown ref value 99/);
  });

  it('decodePrefix rejects addresses outside prefix capacity', () => {
    const { capacity } = getPrefixShape(TEST_CATALOG, 'permission', 'v1');
    expect(() => decodePrefix(TEST_CATALOG, 'permission', 'v1', capacity)).toThrow(
      /address.*permission@v1.*\[0, 7\]/,
    );
  });

  it('decodePrefixPartial uses the same address boundary as full decode', () => {
    const { capacity } = getPrefixShape(TEST_CATALOG, 'permission', 'v1');
    expect(() =>
      decodePrefixPartial(TEST_CATALOG, 'permission', 'v1', capacity, ['svc_ref']),
    ).toThrow(/address.*permission@v1.*\[0, 7\]/);
  });

  it('resolveAddress rejects addresses outside prefix capacity before recursive decode', () => {
    const { capacity } = getPrefixShape(TEST_CATALOG, 'permission', 'v1');
    expect(() => resolveAddress(TEST_CATALOG, 'permission', 'v1', capacity)).toThrow(
      /address.*permission@v1.*\[0, 7\]/,
    );
  });
});

describe('버전별 dim 목록 (D-8)', () => {
  const VERSIONED_LABELS_CATALOG: Catalog = {
    id: 'versioned-labels',
    name: 'versioned-labels',
    axes: {
      env: { id: 'env', name: 'env', versions: { v1: { entries: ['dev', 'prod'] } } },
      mod: { id: 'mod', name: 'mod', versions: { v1: { entries: ['a', 'b', 'c'] } } },
    },
    prefixes: {
      p: {
        id: 'p',
        name: 'p',
        labels: ['env', 'mod'],
        dims: { env: { kind: 'axis', axisId: 'env' }, mod: { kind: 'axis', axisId: 'mod' } },
        versions: [
          { version: 'v1', labels: ['env'], axisVersions: { env: 'v1' } },
          { version: 'v2', axisVersions: { env: 'v1', mod: 'v1' } },
        ],
      },
    },
  };

  it('버전에 labels가 있으면 그 버전의 고정 차원만 사용한다', () => {
    expect(getPrefixShape(VERSIONED_LABELS_CATALOG, 'p', 'v1').shape).toEqual([2]);
    expect(getPrefixShape(VERSIONED_LABELS_CATALOG, 'p', 'v2').shape).toEqual([2, 3]);
    expect(decodePrefix(VERSIONED_LABELS_CATALOG, 'p', 'v1', 1)).toEqual({
      env: { position: 1, value: 'prod' },
    });
    expect(encodePrefix(VERSIONED_LABELS_CATALOG, 'p', 'v1', { env: 1 })).toBe(1);
  });

  it('dims에 없는 label을 선언하면 거부한다', () => {
    const broken: Catalog = {
      ...VERSIONED_LABELS_CATALOG,
      prefixes: {
        p: {
          ...VERSIONED_LABELS_CATALOG.prefixes.p,
          versions: [{ version: 'v1', labels: ['env', 'ghost'], axisVersions: { env: 'v1' } }],
        },
      },
    };
    expect(() => getPrefixShape(broken, 'p', 'v1')).toThrow('Unknown dim label in p@v1: ghost');
  });
});

describe('runtime 오류의 계약 코드 (ADR-010)', () => {
  function codeOf(fn: () => unknown): string | undefined {
    try {
      fn();
    } catch (error) {
      return isCodecContractError(error) ? error.code : `plain:${(error as Error).message}`;
    }
    return undefined;
  }

  it.each([
    ['알 수 없는 prefix', () => decodePrefix(TEST_CATALOG, 'nope', 'v1', 0), 'UnknownPrefix'],
    [
      '알 수 없는 prefix version',
      () => encodePrefix(TEST_CATALOG, 'service', 'v9', { env: 0 }),
      'UnknownPrefix',
    ],
    ['범위 밖 주소', () => decodePrefix(TEST_CATALOG, 'service', 'v1', 4), 'AddressOutOfRange'],
    [
      '정수가 아닌 주소',
      () => resolveAddress(TEST_CATALOG, 'service', 'v1', 1.5),
      'AddressOutOfRange',
    ],
    [
      '범위 밖 position',
      () => encodePrefix(TEST_CATALOG, 'service', 'v1', { env: 4 }),
      'InvalidDimensionValue',
    ],
    [
      'position 누락',
      () => encodePrefix(TEST_CATALOG, 'service', 'v1', {}),
      'InvalidDimensionValue',
    ],
    [
      '알 수 없는 entry',
      () => encodePrefixByValue(TEST_CATALOG, 'service', 'v1', { env: 'qa' }),
      'InvalidDimensionValue',
    ],
    [
      '알 수 없는 ref 값',
      () => encodePrefixByValue(TEST_CATALOG, 'permission', 'v1', { svc_ref: 99, role: 'admin' }),
      'InvalidDimensionValue',
    ],
    [
      '값 누락',
      () => encodePrefixByValue(TEST_CATALOG, 'permission', 'v1', { role: 'admin' }),
      'InvalidDimensionValue',
    ],
  ] as const)('%s → %s', (_name, fn, code) => {
    expect(codeOf(fn)).toBe(code);
  });

  it('catalog 정의 결함은 계약 오류가 아니라 일반 Error로 남긴다', () => {
    const broken: Catalog = {
      ...TEST_CATALOG,
      prefixes: {
        service: {
          ...TEST_CATALOG.prefixes.service,
          versions: [{ version: 'v1', axisVersions: {} }],
        },
      },
    };
    expect(codeOf(() => decodePrefix(broken, 'service', 'v1', 0))).toMatch(
      /^plain:Unknown axis version/,
    );
  });

  it('2^53을 넘는 주소 공간을 number로 encode·decode하면 StrideOverflow', () => {
    const wide: Catalog = {
      id: 'wide',
      name: 'wide',
      axes: {
        big: { id: 'big', name: 'big', versions: { v1: { entries: ['a'], capacity: 2 ** 20 } } },
      },
      prefixes: {
        huge: {
          id: 'huge',
          name: 'huge',
          labels: ['x', 'y', 'z'],
          dims: {
            x: { kind: 'axis', axisId: 'big' },
            y: { kind: 'axis', axisId: 'big' },
            z: { kind: 'axis', axisId: 'big' },
          },
          versions: [{ version: 'v1', axisVersions: { x: 'v1', y: 'v1', z: 'v1' } }],
        },
      },
    };
    expect(codeOf(() => encodePrefix(wide, 'huge', 'v1', { x: 0, y: 0, z: 0 }))).toBe(
      'StrideOverflow',
    );
    expect(codeOf(() => decodePrefix(wide, 'huge', 'v1', 0))).toBe('StrideOverflow');
    // 프로파일 조회는 계속 가능해야 한다 (safePrecision으로 보고)
    expect(getPrefixShape(wide, 'huge', 'v1').shape).toEqual([2 ** 20, 2 ** 20, 2 ** 20]);
  });

  it('메시지는 기존 문구를 유지한다 (부분 문자열 매칭 소비자 호환)', () => {
    expect(() => decodePrefix(TEST_CATALOG, 'nope', 'v1', 0)).toThrow('Unknown prefix: nope');
  });
});
