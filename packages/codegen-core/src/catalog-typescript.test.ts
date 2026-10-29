import type { Catalog } from '@qa-sdk/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_FIXTURE } from '../../core/src/catalog/snapshot/__fixtures__/snapshot-fixture.js';
import { generateCatalogTypes } from './catalog-typescript.js';
import { GENERATOR_NAME, GENERATOR_VERSION } from './generator-info.js';

/** core snapshot fixture + prefix_ref(refEntries) prefix — dim 정의 변경 검증용 */
const CATALOG: Catalog = {
  ...SNAPSHOT_FIXTURE,
  prefixes: {
    ...SNAPSHOT_FIXTURE.prefixes,
    audit: {
      id: 'audit',
      name: 'audit',
      labels: ['svc_ref', 'role'],
      dims: {
        svc_ref: { kind: 'prefix_ref', prefixId: 'svc' },
        role: { kind: 'axis', axisId: 'role' },
      },
      versions: [
        {
          version: 'v1',
          axisVersions: { role: 'v1' },
          refEntries: { svc_ref: { values: [0, 1, 4], refVersion: 'v2' } },
        },
      ],
    },
  },
};

describe('generateCatalogTypes 결정론', () => {
  afterEach(() => vi.useRealTimers());

  it('실행 시각이 달라도 출력이 같다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const a = generateCatalogTypes(CATALOG);
    vi.setSystemTime(new Date('2027-06-30T12:34:56Z'));
    const b = generateCatalogTypes(CATALOG);
    expect(b.files).toEqual(a.files);
  });

  it('헤더에 generator 이름·버전을 기록하고 시각은 기록하지 않는다', () => {
    const { files } = generateCatalogTypes(CATALOG);
    for (const f of files) {
      const head = f.content.split('\n').slice(0, 3).join('\n');
      expect(head).toContain(`${GENERATOR_NAME}@${GENERATOR_VERSION}`);
      expect(f.content).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });

  it('정렬이 locale에 의존하지 않는다 (code unit 순서)', () => {
    const spy = vi.spyOn(String.prototype, 'localeCompare');
    try {
      const { files } = generateCatalogTypes(CATALOG);
      expect(spy).not.toHaveBeenCalled();
      const prefixIds = files.find((f) => f.path === 'prefix-ids.ts')!.content;
      // 'audit' < 'build_event' < 'svc' (code unit)
      expect(prefixIds).toContain('PREFIX_IDS = ["audit", "build_event", "svc"]');
    } finally {
      spy.mockRestore();
    }
  });
});
