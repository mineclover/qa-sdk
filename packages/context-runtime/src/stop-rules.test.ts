import { describe, expect, it } from 'vitest';
import { evaluateStopDecision, validateStopPolicy } from './stop-rules.js';

describe('context-runtime stop rules', () => {
  it('[contract:context-runtime.discovery.stop-on-coverage.v1] freezes only when every obligation is covered', () => {
    const result = evaluateStopDecision({
      policy: {
        obligations: [
          { kind: 'route', key: 'topic.definition' },
          { kind: 'fact', key: 'definition.body' },
          { kind: 'evidence', key: 'source:definition.md' },
        ],
      },
      selectedRouteKeys: ['topic.definition'],
      resolvedFacts: [
        {
          factKey: 'definition.body',
          resolutionRouteKey: 'body',
          value: 'body',
          authority: 'authoritative',
          observedAt: '2026-07-24T00:00:00.000Z',
          revision: 'definition:1',
          evidenceRefs: ['source:definition.md'],
        },
      ],
    });

    expect(result).toEqual({
      reason: 'coverage-satisfied',
      action: 'freeze',
      satisfiedObligations: [
        { kind: 'route', key: 'topic.definition' },
        { kind: 'fact', key: 'definition.body' },
        { kind: 'evidence', key: 'source:definition.md' },
      ],
      unresolvedObligations: [],
      progress: { newRoutes: 0, newFacts: 0, newEvidenceRefs: 0 },
    });
  });

  it('[contract:context-runtime.discovery.stop-on-no-progress.v1] blocks after the configured no-progress limit', () => {
    const result = evaluateStopDecision({
      policy: {
        obligations: [{ kind: 'fact', key: 'definition.body' }],
        noProgressLimit: 2,
      },
      selectedRouteKeys: [],
      consecutiveNoProgress: 2,
      progress: { newRoutes: 0, newFacts: 0, newEvidenceRefs: 0 },
    });

    expect(result).toMatchObject({
      reason: 'no-progress',
      action: 'block',
      unresolvedObligations: [{ kind: 'fact', key: 'definition.body' }],
    });
  });

  it('[contract:context-runtime.discovery.evaluate-source-exhausted.v1] blocks unresolved obligations when source expansion is exhausted', () => {
    const result = evaluateStopDecision({
      policy: { obligations: [{ kind: 'fact', key: 'definition.body' }] },
      selectedRouteKeys: ['definition.body.route'],
      sourceExhausted: true,
    });

    expect(result).toMatchObject({
      reason: 'source-exhausted',
      action: 'block',
      unresolvedObligations: [{ kind: 'fact', key: 'definition.body' }],
    });
  });

  it('[contract:context-runtime.stop.hard-cap-precedence.v1] keeps a hard cap ahead of semantic coverage', () => {
    const result = evaluateStopDecision({
      policy: { obligations: [{ kind: 'route', key: 'topic.definition' }] },
      selectedRouteKeys: ['topic.definition'],
      hardStopReason: 'budget-exhausted',
    });

    expect(result).toMatchObject({
      reason: 'budget-exhausted',
      action: 'freeze',
      unresolvedObligations: [],
    });
  });

  it('rejects duplicate obligations and invalid progress limits', () => {
    const result = validateStopPolicy({
      obligations: [
        { kind: 'route', key: 'topic.definition' },
        { kind: 'route', key: 'topic.definition' },
      ],
      noProgressLimit: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'stop-policy-obligation-duplicate',
      'stop-policy-no-progress-limit-invalid',
    ]);
  });
});
