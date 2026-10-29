import type { Catalog, DkgConfig } from '@qa-sdk/core';
import { computeCatalogDigest, shortDigest } from '@qa-sdk/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_FIXTURE } from '../../core/src/catalog/snapshot/__fixtures__/snapshot-fixture.js';
import { generateCatalogTypes } from './catalog-typescript.js';
import { GENERATOR_NAME, GENERATOR_VERSION } from './generator-info.js';

/** DkgConfig 최소 형태 — 필수 필드만 */
function dkg(overrides: Partial<DkgConfig> = {}): DkgConfig {
  return {
    domains: [],
    consumers: [],
    constraints: [],
    dslBundles: [],
    intentLinks: [],
    skills: [],
    ...overrides,
  };
}

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

  it('실행 시각이 달라도 출력이 같다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const a = await generateCatalogTypes(CATALOG);
    vi.setSystemTime(new Date('2027-06-30T12:34:56Z'));
    const b = await generateCatalogTypes(CATALOG);
    expect(b.files).toEqual(a.files);
  });

  it('헤더에 generator 이름·버전을 기록하고 시각은 기록하지 않는다', async () => {
    const { files } = await generateCatalogTypes(CATALOG);
    for (const f of files) {
      const head = f.content.split('\n').slice(0, 3).join('\n');
      expect(head).toContain(`${GENERATOR_NAME}@${GENERATOR_VERSION}`);
      expect(f.content).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });

  it('정렬이 locale에 의존하지 않는다 (code unit 순서)', async () => {
    const spy = vi.spyOn(String.prototype, 'localeCompare');
    try {
      const { files } = await generateCatalogTypes(CATALOG);
      expect(spy).not.toHaveBeenCalled();
      const prefixIds = files.find((f) => f.path === 'prefix-ids.ts')!.content;
      // 'audit' < 'build_event' < 'svc' (code unit)
      expect(prefixIds).toContain('PREFIX_IDS = ["audit", "build_event", "svc"]');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('generateCatalogTypes digest', () => {
  it('contentHash는 catalog digest의 표시용 축약이다', async () => {
    const r = await generateCatalogTypes(CATALOG);
    expect(r.catalogDigest).toBe(await computeCatalogDigest(CATALOG));
    expect(r.contentHash).toBe(shortDigest(r.catalogDigest));
  });

  it('헤더에 전체 catalogDigest·sourceDigest를 기록한다', async () => {
    const r = await generateCatalogTypes(CATALOG, dkg());
    for (const f of r.files) {
      const head = f.content.split('\n').slice(0, 3).join('\n');
      expect(head).toContain(`catalogDigest: ${r.catalogDigest}`);
      expect(head).toContain(`sourceDigest: ${r.sourceDigest}`);
    }
    expect(r.catalogDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(r.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('GENERATION과 VERSION_META가 catalog digest 기반이다', async () => {
    const r = await generateCatalogTypes(CATALOG);
    const prefixIds = r.files.find((f) => f.path === 'prefix-ids.ts')!.content;
    expect(prefixIds).toContain(`GENERATION = "${CATALOG.id}:${r.contentHash}"`);
    expect(prefixIds).toContain(`catalogDigest: "${r.catalogDigest}"`);
    expect(prefixIds).toContain('codecVersion: "legacy-v1"');
  });

  it('refEntries만 바뀌어도 catalogDigest가 바뀐다', async () => {
    const changed = structuredClone(CATALOG) as Catalog;
    const audit = changed.prefixes.audit.versions[0];
    (audit.refEntries as Record<string, { values: number[] }>).svc_ref.values = [4, 1, 0];
    const [a, b] = await Promise.all([
      generateCatalogTypes(CATALOG),
      generateCatalogTypes(changed),
    ]);
    expect(b.catalogDigest).not.toBe(a.catalogDigest);
  });

  it('dim kind만 바뀌어도 catalogDigest가 바뀐다', async () => {
    const changed = structuredClone(CATALOG) as Catalog;
    (changed.prefixes.audit.dims as Record<string, unknown>).svc_ref = {
      kind: 'table_ref',
      table: 'svc',
    };
    const [a, b] = await Promise.all([
      generateCatalogTypes(CATALOG),
      generateCatalogTypes(changed),
    ]);
    expect(b.catalogDigest).not.toBe(a.catalogDigest);
  });

  it('dkgConfig만 바뀌면 catalogDigest는 같고 sourceDigest·dsl.ts는 다르다', async () => {
    const a = await generateCatalogTypes(CATALOG, dkg());
    const b = await generateCatalogTypes(
      CATALOG,
      dkg({ constraints: [{ id: 'CON-X' } as DkgConfig['constraints'][number]] }),
    );
    expect(b.catalogDigest).toBe(a.catalogDigest);
    expect(b.sourceDigest).not.toBe(a.sourceDigest);
    const dsl = (r: typeof a) => r.files.find((f) => f.path === 'dsl.ts')!.content;
    expect(dsl(b)).not.toBe(dsl(a));
  });

  it('options(lockVersion)만 바뀌면 sourceDigest가 바뀐다', async () => {
    const a = await generateCatalogTypes(CATALOG);
    const b = await generateCatalogTypes(CATALOG, undefined, { lockVersion: 'v1' });
    expect(b.catalogDigest).toBe(a.catalogDigest);
    expect(b.sourceDigest).not.toBe(a.sourceDigest);
  });

  it('options 미지정과 lockVersion undefined는 같은 sourceDigest다', async () => {
    const a = await generateCatalogTypes(CATALOG);
    const b = await generateCatalogTypes(CATALOG, undefined, { lockVersion: undefined });
    expect(b.sourceDigest).toBe(a.sourceDigest);
  });
});
