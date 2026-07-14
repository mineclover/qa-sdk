// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, expect, it } from 'vitest';
import { generateVerificationClaimAudit } from './claim-audit.js';

describe('generateVerificationClaimAudit', () => {
  const sections = [
    {
      specId: 'gate-api',
      subjectRef: 'endpoint:/check',
      marker: 'inputs' as const,
      sourceId: 'gate-api',
      body: '- prefix는 필수다',
    },
    {
      specId: 'gate-api',
      subjectRef: 'endpoint:/check',
      marker: 'postcondition' as const,
      sourceId: 'gate-api',
      body: '- state를 반환한다',
    },
  ];

  it('gate verified + review accepted를 validation claim에 투영한다', () => {
    const report = generateVerificationClaimAudit({
      sections,
      bindings: [
        {
          marker: 'inputs',
          implementation: {
            bindings: ['docs.controller.ts'],
            implementedBindings: ['docs.controller.ts'],
          },
        },
        {
          marker: 'postcondition',
          implementation: {
            bindings: ['docs.controller.ts'],
            implementedBindings: ['docs.controller.ts'],
          },
        },
      ],
      gateStatuses: [{ gateDocId: 'gate-doc', status: 'verified' }],
      reviews: [{ filePath: 'docs.controller.ts', status: 'reviewed' }],
    });

    const inputClaim = report.claims.find((row) => row.claim.marker === 'inputs')!;
    const validationClaim = report.claims.find((row) => row.claim.marker === 'postcondition')!;

    expect(inputClaim.compositeState).toBe('verified');
    expect(validationClaim.compositeState).toBe('verified');
  });

  it('gate failed면 validation claim은 contradicted', () => {
    const report = generateVerificationClaimAudit({
      sections,
      gateStatuses: [{ gateDocId: 'gate-doc', status: 'failed' }],
    });

    const validationClaim = report.claims.find((row) => row.claim.marker === 'postcondition')!;
    expect(validationClaim.compositeState).toBe('contradicted');
  });

  it('stale review 또는 stale gate가 있으면 stale 우선', () => {
    const report = generateVerificationClaimAudit({
      sections,
      gateStatuses: [{ gateDocId: 'gate-doc', status: 'stale' }],
      reviews: [{ filePath: 'docs.controller.ts', status: 'stale' }],
    });

    for (const claim of report.claims) {
      expect(claim.compositeState).toBe('stale');
    }
  });
});
