/**
 * ADR-010 공개 계약 고정 — 패키지 경계를 넘어 같은 값을 가정하는 인터페이스를 한 곳에서 대조한다.
 *
 * - 실패 코드 9종은 HTTP 응답 `error.code`로 외부에 노출되므로 추가·삭제가 곧 계약 변경이다
 * - browser-codec은 core에 의존하지 않아 코드 집합을 복제한다 — 복제본이 정본을 벗어나면 안 된다
 * - Node(codegen-core)·브라우저(viz-3d 생성기) 생성물의 snapshot 문맥은 같은 catalog에서 같아야
 *   ingest snapshot gate가 두 SDK의 envelope을 같은 snapshot으로 판정한다
 */
import { BROWSER_CATALOG_SNAPSHOT, type BrowserCodecErrorCode } from '@qa-sdk/browser-codec';
import {
  CODEC_ERROR_CODES,
  buildCatalogSnapshot,
  catalogSnapshotWireSchema,
  type CatalogSnapshotWire,
  type CodecErrorCode,
} from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { CATALOG_SNAPSHOT } from 'demo-types';
import { describe, expect, expectTypeOf, it } from 'vitest';

describe('CodecContractError 코드 집합', () => {
  it('ADR-010의 9종이다', () => {
    expect([...CODEC_ERROR_CODES].toSorted()).toEqual(
      [
        'AddressOutOfRange',
        'CatalogMismatch',
        'CorruptEnvelope',
        'InvalidDimensionValue',
        'MigrationRequired',
        'StrideOverflow',
        'UnknownCatalogSnapshot',
        'UnknownPrefix',
        'UnsupportedCodecVersion',
      ].toSorted(),
    );
  });

  it('browser-codec 코드는 주소 형식 오류(MalformedAddress)를 뺀 나머지가 정본의 부분집합이다', () => {
    expectTypeOf<
      Exclude<BrowserCodecErrorCode, 'MalformedAddress'>
    >().toMatchTypeOf<CodecErrorCode>();
  });
});

describe('SDK에 넘기는 CatalogSnapshot 문맥', () => {
  it('Node·브라우저 생성물이 같은 문맥을 낸다', () => {
    expect(CATALOG_SNAPSHOT).toEqual(BROWSER_CATALOG_SNAPSHOT);
  });

  it('envelope catalog_snapshot 타입·스키마를 만족한다', () => {
    expectTypeOf(CATALOG_SNAPSHOT).toMatchTypeOf<CatalogSnapshotWire>();
    expectTypeOf(BROWSER_CATALOG_SNAPSHOT).toMatchTypeOf<CatalogSnapshotWire>();
    expect(catalogSnapshotWireSchema.parse(CATALOG_SNAPSHOT)).toEqual(CATALOG_SNAPSHOT);
  });

  it('registry가 같은 catalog로 발행하는 snapshot의 digest와 같다', async () => {
    const { snapshot } = await buildCatalogSnapshot(DEMO_CATALOG, {
      snapshotVersion: 1,
      parentDigest: null,
    });
    expect(CATALOG_SNAPSHOT.digest).toBe(snapshot.digest);
  });
});
