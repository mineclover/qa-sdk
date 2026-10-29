import type {
  BrowserCatalog as CodecBrowserCatalog,
  BrowserDimDef as CodecBrowserDimDef,
  BrowserPrefixDef as CodecBrowserPrefixDef,
} from '@qa-sdk/browser-codec';
import { BROWSER_CATALOG, BROWSER_CATALOG_SNAPSHOT } from '@qa-sdk/browser-codec';
import type {
  BrowserCatalog,
  BrowserCatalogSnapshot,
  BrowserDimDef,
  BrowserPrefixDef,
} from '@qa-sdk/core';
import { browserCatalogSnapshotOf, flattenForBrowser } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, expectTypeOf, it } from 'vitest';

describe('browser-codec ↔ core BrowserCatalog 타입 사본', () => {
  it('세 타입이 정본과 상호 할당 가능하다', () => {
    expectTypeOf<CodecBrowserDimDef>().toEqualTypeOf<BrowserDimDef>();
    expectTypeOf<CodecBrowserPrefixDef>().toEqualTypeOf<BrowserPrefixDef>();
    expectTypeOf<CodecBrowserCatalog>().toEqualTypeOf<BrowserCatalog>();
  });

  it('BROWSER_CATALOG_SNAPSHOT이 현재 DEMO_CATALOG 문맥과 일치한다', async () => {
    expectTypeOf(BROWSER_CATALOG_SNAPSHOT).toMatchTypeOf<BrowserCatalogSnapshot>();
    expect(BROWSER_CATALOG_SNAPSHOT).toEqual(await browserCatalogSnapshotOf(DEMO_CATALOG));
    expect(BROWSER_CATALOG).toEqual(flattenForBrowser(DEMO_CATALOG));
  });
});
