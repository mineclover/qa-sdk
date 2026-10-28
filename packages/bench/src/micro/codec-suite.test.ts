import { DEMO_CATALOG } from 'demo-snapshot';
import { latestPrefixVersion } from '@qa-sdk/core';
import { DEFAULT_BATCH_SIZE } from '@qa-sdk/logger';
import { describe, expect, it } from 'vitest';
import { createCodecSuite } from './codec-suite.js';
import { measureCase } from './measure.js';

describe('createCodecSuite', () => {
  it('catalog의 모든 prefix에 대해 encode·decode case를 만든다', () => {
    const suite = createCodecSuite(DEMO_CATALOG);
    const prefixCount = Object.keys(DEMO_CATALOG.prefixes).length;
    expect(suite.filter((c) => c.id.startsWith('core.encodePrefix/'))).toHaveLength(prefixCount);
    expect(suite.filter((c) => c.id.startsWith('core.decodePrefix/'))).toHaveLength(prefixCount);
    expect(suite.some((c) => c.id.startsWith('envelope.json/'))).toBe(true);
  });

  it('case id의 version은 latestPrefixVersion에서 파생한다', () => {
    const suite = createCodecSuite(DEMO_CATALOG);
    for (const prefixId of Object.keys(DEMO_CATALOG.prefixes)) {
      const version = latestPrefixVersion(DEMO_CATALOG, prefixId);
      expect(suite.some((c) => c.id === `core.encodePrefix/${prefixId}@${version}`)).toBe(true);
    }
  });

  it('case id는 고유하다', () => {
    const ids = createCodecSuite(DEMO_CATALOG).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('envelope case는 단건과 logger 기본 batch 크기를 포함한다', () => {
    const ids = createCodecSuite(DEMO_CATALOG).map((c) => c.id);
    expect(ids).toContain('envelope.json/1');
    expect(ids).toContain(`envelope.json/${DEFAULT_BATCH_SIZE}`);
  });

  it('browser-codec과 주소 파싱 case를 대표 prefix 1개로 만든다', () => {
    const ids = createCodecSuite(DEMO_CATALOG).map((c) => c.id);
    expect(ids.filter((id) => id.startsWith('browser-codec.encode/'))).toHaveLength(1);
    expect(ids.filter((id) => id.startsWith('browser-codec.decode/'))).toHaveLength(1);
    expect(ids).toContain('core.parseSerializedAddress');
  });

  it('실패하는 case가 있어도 suite 전체가 측정 가능하다', () => {
    const results = createCodecSuite(DEMO_CATALOG).map((c) =>
      measureCase({ id: c.id, warm: false, iterations: 1, run: c.run }),
    );
    expect(results.every((r) => r.status === 'ok' || typeof r.skipReason === 'string')).toBe(true);
    expect(results.some((r) => r.status === 'ok')).toBe(true);
  });
});
