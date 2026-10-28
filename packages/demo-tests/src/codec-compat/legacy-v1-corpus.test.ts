import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decode as browserDecode } from '@qa-sdk/browser-codec';
import { decodePrefix, flattenForBrowser } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';
import { buildLegacyCorpus, type LegacyCorpus } from './corpus.js';

const CORPUS_URL = new URL(
  '../../../../fixtures/coordinate-compatibility/legacy-v1/demo.json',
  import.meta.url,
);

function readCorpus(): LegacyCorpus {
  return JSON.parse(readFileSync(CORPUS_URL, 'utf8')) as LegacyCorpus;
}

describe('legacy-v1 golden corpus', () => {
  it.runIf(process.env.UPDATE_CORPUS === '1')('corpus 파일을 갱신한다', async () => {
    mkdirSync(new URL('.', CORPUS_URL), { recursive: true });
    writeFileSync(
      CORPUS_URL,
      `${JSON.stringify(await buildLegacyCorpus(DEMO_CATALOG), null, 2)}\n`,
    );
  });

  it('저장된 주소가 현재 runtime에서 같은 값으로 decode된다', () => {
    const corpus = readCorpus();
    expect(corpus.codecVersion).toBe('legacy-v1');
    expect(corpus.cases.length).toBeGreaterThan(0);
    for (const c of corpus.cases) {
      const [prefixId, version] = c.key.split('@');
      const decoded = decodePrefix(DEMO_CATALOG, prefixId, version, c.address);
      expect(Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, v.value]))).toEqual(
        c.values,
      );
    }
  });

  it('browser-codec도 최신 version 주소를 같은 값으로 decode한다', () => {
    const browserCatalog = flattenForBrowser(DEMO_CATALOG);
    const latest = readCorpus().cases.filter(
      (c) => browserCatalog[c.key.split('@')[0]]?.version === c.key.split('@')[1],
    );
    expect(latest.length).toBeGreaterThan(0);
    for (const c of latest) {
      expect(browserDecode(browserCatalog, c.serialized)?.values).toEqual(c.values);
    }
  });

  it('corpus 생성은 결정론적이다', async () => {
    expect(await buildLegacyCorpus(DEMO_CATALOG)).toEqual(
      await buildLegacyCorpus(structuredClone(DEMO_CATALOG)),
    );
  });
});
