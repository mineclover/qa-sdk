// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, expect, it } from 'vitest';
import {
  extractClaimUnits,
  extractClaimsFromSection,
  extractClaimsFromSections,
} from './claim-extractor.js';

describe('extractClaimUnits', () => {
  it('bullet list를 claim 여러 건으로 분리한다', () => {
    expect(
      extractClaimUnits(`
- userId는 필수다
- email은 optional이다
`),
    ).toEqual(['userId는 필수다', 'email은 optional이다']);
  });

  it('numbered list도 분리한다', () => {
    expect(
      extractClaimUnits(`
1. draft에서 review로 전이된다
2. review에서 approved로 전이된다
`),
    ).toEqual(['draft에서 review로 전이된다', 'review에서 approved로 전이된다']);
  });

  it('list가 없으면 paragraph 단위로 추출한다', () => {
    expect(
      extractClaimUnits(`
GET /docs/:id는 문서를 조회한다.

존재하지 않으면 404를 반환한다.
`),
    ).toEqual(['GET /docs/:id는 문서를 조회한다', '존재하지 않으면 404를 반환한다']);
  });
});

describe('extractClaimsFromSection', () => {
  it('claimId를 안정적으로 생성한다', () => {
    const claims = extractClaimsFromSection({
      specId: 'def-svc-api-contract',
      subjectRef: 'endpoint:/docs/:id',
      marker: 'inputs',
      sourceId: 'def-svc-api-contract',
      body: '- docId는 path parameter다',
    });

    expect(claims).toHaveLength(1);
    expect(claims[0]!.claimId).toBe(
      'def-svc-api-contract:def-svc-api-contract:inputs:01:docid는-path-parameter다',
    );
    expect(claims[0]!.sourceId).toBe('def-svc-api-contract');
  });

  it('여러 섹션을 합쳐 전체 claim 배열을 만든다', () => {
    const claims = extractClaimsFromSections([
      {
        specId: 'gate-api',
        subjectRef: 'endpoint:/check',
        marker: 'inputs',
        sourceId: 'gate-api',
        body: '- prefix는 필수다',
      },
      {
        specId: 'gate-api',
        subjectRef: 'endpoint:/check',
        marker: 'outputs',
        sourceId: 'gate-api',
        body: '- state를 반환한다',
      },
    ]);

    expect(claims).toHaveLength(2);
    expect(claims.map((claim) => claim.marker)).toEqual(['inputs', 'outputs']);
  });
});
