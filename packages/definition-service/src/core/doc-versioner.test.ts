// @def.doc definition-service

import { describe, expect, it } from 'vitest';
import { decideVersion } from './doc-versioner.js';
import type { DocRecord } from './types.js';

function makeDoc(overrides: Partial<DocRecord> = {}): DocRecord {
  return {
    docId: 'sample-doc',
    title: 'Sample Doc',
    scope: 'flow',
    aspect: 'process_flow',
    depth: 'specification',
    lifecycle: 'approved',
    tags: ['testing'],
    links: [{ target: 'target-doc', type: 'depends_on' }],
    version: 1,
    bodyHash: 'body-hash-1',
    purpose: 'purpose text',
    intent: 'intent text',
    context: 'context text',
    caveat: 'caveat text',
    syncedAt: '2026-03-31T00:00:00.000Z',
    ...overrides,
  };
}

describe('decideVersion', () => {
  it('body가 같아도 frontmatter metadata가 바뀌면 updated로 판정한다', () => {
    const existing = makeDoc({ docVersion: 'v1', revision: 1 });
    const incoming = makeDoc({ docVersion: 'v2', revision: 2 });

    const result = decideVersion(existing, incoming);

    expect(result.action).toBe('updated');
    expect(result.changeType).toBe('updated');
    expect(result.version).toBe(2);
  });

  it('body와 메타데이터가 같고 마커만 바뀌면 marker_edit로 판정한다', () => {
    const existing = makeDoc();
    const incoming = makeDoc({ purpose: 'updated purpose' });

    const result = decideVersion(existing, incoming);

    expect(result.action).toBe('updated');
    expect(result.changeType).toBe('marker_edit');
    expect(result.version).toBe(2);
  });
});
