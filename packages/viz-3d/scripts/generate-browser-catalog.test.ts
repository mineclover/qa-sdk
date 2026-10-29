import { readFileSync } from 'node:fs';
import { flattenForBrowser, computeCatalogDigest } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';
import {
  BROWSER_CATALOG,
  BROWSER_CATALOG_SNAPSHOT,
} from '../../browser-codec/src/demo-catalog-browser.js';
import { renderBrowserCatalogSource } from './generate-browser-catalog.js';

describe('BROWSER_CATALOG 생성물', () => {
  it('커밋된 BROWSER_CATALOG가 core flattenForBrowser(DEMO_CATALOG)와 같다', () => {
    expect(BROWSER_CATALOG).toEqual(flattenForBrowser(DEMO_CATALOG));
  });

  it('BROWSER_CATALOG_SNAPSHOT이 DEMO_CATALOG digest를 가리킨다', async () => {
    expect(BROWSER_CATALOG_SNAPSHOT).toEqual({
      catalog_id: DEMO_CATALOG.id,
      digest: await computeCatalogDigest(DEMO_CATALOG),
      codec_version: 'legacy-v1',
    });
  });
});

describe('renderBrowserCatalogSource', () => {
  it('같은 catalog → 같은 바이트, 실행 시각을 쓰지 않는다', async () => {
    const [a, b] = [
      await renderBrowserCatalogSource(DEMO_CATALOG),
      await renderBrowserCatalogSource(DEMO_CATALOG),
    ];
    expect(b).toBe(a);
    expect(a).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it('헤더에 generator 이름@viz-3d 버전과 전체 catalogDigest를 기록한다', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    const head = (await renderBrowserCatalogSource(DEMO_CATALOG)).split('\n').slice(0, 3);
    expect(head[0]).toContain(`by generate-browser-catalog@${pkg.version}`);
    expect(head[1]).toBe(`// catalogDigest: ${await computeCatalogDigest(DEMO_CATALOG)}`);
  });
});
