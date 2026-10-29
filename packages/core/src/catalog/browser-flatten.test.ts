import { describe, expect, it } from 'vitest';
import type { Catalog } from './catalog.types.js';
import { browserCatalogSnapshotOf, flattenForBrowser } from './browser-flatten.js';
import { SNAPSHOT_FIXTURE } from './snapshot/__fixtures__/snapshot-fixture.js';
import { LEGACY_V1_CODEC } from './snapshot/catalog-snapshot.types.js';
import { computeCatalogDigest } from './snapshot/digest.js';

/** fixture + prefix_ref(refEntries)·table_ref·버전별 labels를 가진 prefix */
const CATALOG: Catalog = {
  ...SNAPSHOT_FIXTURE,
  prefixes: {
    ...SNAPSHOT_FIXTURE.prefixes,
    audit: {
      id: 'audit',
      name: 'audit',
      labels: ['role', 'svc_ref', 'row', 'env'],
      dims: {
        svc_ref: { kind: 'prefix_ref', prefixId: 'svc' },
        row: { kind: 'table_ref', table: 'audit_rows' },
        env: { kind: 'axis', axisId: 'env' },
        role: { kind: 'axis', axisId: 'role' },
      },
      versions: [
        { version: 'v1', labels: ['role'], axisVersions: { role: 'v1' } },
        {
          version: 'v2',
          axisVersions: { role: 'v1', env: 'v2' },
          refEntries: { svc_ref: { values: [0, 1, 4], refVersion: 'v2' } },
        },
      ],
    },
    /** prefix_ref에 refEntries가 없고 table_ref만 남는 prefix → 브라우저 표현 불가 */
    opaque: {
      id: 'opaque',
      name: 'opaque',
      labels: ['svc_ref', 'row'],
      dims: {
        svc_ref: { kind: 'prefix_ref', prefixId: 'svc' },
        row: { kind: 'table_ref', table: 'opaque_rows' },
      },
      versions: [{ version: 'v1', axisVersions: {} }],
    },
  },
};

describe('flattenForBrowser', () => {
  it('prefix마다 최신 version 하나와 고정 차원만 담는다', () => {
    const flat = flattenForBrowser(SNAPSHOT_FIXTURE);
    expect(flat.svc.version).toBe('v2');
    expect(flat.svc.labels).toEqual(['env', 'role']);
    expect(flat.svc.dims.env).toMatchObject({
      kind: 'axis',
      entries: ['dev', 'prod', 'stage'],
      capacity: 4,
    });
  });

  it('capacity 미선언 axis는 entries 수를 capacity로 쓴다', () => {
    const flat = flattenForBrowser(SNAPSHOT_FIXTURE);
    expect(flat.svc.dims.role).toEqual({
      kind: 'axis',
      entries: ['viewer', 'editor', 'admin'],
      capacity: 3,
    });
  });

  it('차원 순서는 버전 labels 순서이고 table_ref는 제외, prefix_ref는 refEntries를 인라인한다', () => {
    const flat = flattenForBrowser(CATALOG);
    expect(flat.audit.version).toBe('v2');
    expect(flat.audit.labels).toEqual(['role', 'svc_ref', 'env']);
    expect(flat.audit.dims.svc_ref).toEqual({ kind: 'prefix_ref', values: [0, 1, 4] });
    expect(flat.audit.dims).not.toHaveProperty('row');
  });

  it('최신 버전의 labels가 선언되면 그 목록만 쓴다 (D-8)', () => {
    const v1Only: Catalog = {
      ...CATALOG,
      prefixes: {
        audit: { ...CATALOG.prefixes.audit, versions: [CATALOG.prefixes.audit.versions[0]] },
      },
    };
    expect(flattenForBrowser(v1Only).audit.labels).toEqual(['role']);
  });

  it('고정 차원이 하나도 표현되지 않는 prefix는 제외한다', () => {
    expect(flattenForBrowser(CATALOG)).not.toHaveProperty('opaque');
  });

  it('dims에 없는 label은 오류다', () => {
    const broken: Catalog = {
      ...CATALOG,
      prefixes: {
        svc: {
          ...SNAPSHOT_FIXTURE.prefixes.svc,
          versions: [{ version: 'v1', labels: ['env', 'ghost'], axisVersions: { env: 'v1' } }],
        },
      },
    };
    expect(() => flattenForBrowser(broken)).toThrow(/ghost/);
  });
});

describe('browserCatalogSnapshotOf', () => {
  it('catalog id·전체 digest·codec 버전을 담는다', async () => {
    expect(await browserCatalogSnapshotOf(CATALOG)).toEqual({
      catalog_id: CATALOG.id,
      digest: await computeCatalogDigest(CATALOG),
      codec_version: LEGACY_V1_CODEC,
    });
  });
});
