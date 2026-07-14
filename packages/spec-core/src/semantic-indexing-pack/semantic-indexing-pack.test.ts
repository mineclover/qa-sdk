// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import { describe, expect, it } from 'vitest';
import {
  buildSemanticIndexingPromotionProposal,
  buildSemanticIndexingPackReport,
  classifySemanticIndexingPackChanges,
  evaluateSemanticIndexingCompatibility,
  formatSemanticIndexingPackReportMarkdown,
  planSemanticIndexingGrounding,
  sortSemanticIndexingPackSurfaces,
  validateSemanticIndexingPackManifest,
  type SemanticIndexingPackManifest,
} from './index.js';

const manifest: SemanticIndexingPackManifest = {
  packId: 'coord-semantic-indexing-pack',
  version: 'v1',
  planes: [
    {
      plane: 'semantic-source',
      refs: [
        {
          id: 'definition-service-semantic-grounding',
          kind: 'source',
          path: 'packages/definition-service/src/core/semantic-grounding/types.ts',
          role: 'runtime-service',
        },
      ],
    },
    {
      plane: 'taxonomy',
      refs: [
        {
          id: 'taxonomy-boundaries',
          kind: 'doc',
          path: 'docs/specs/system/taxonomy-boundaries.spec.md',
          role: 'public-library',
        },
      ],
    },
    {
      plane: 'coordinate',
      refs: [
        {
          id: 'index-meta-system',
          kind: 'doc',
          path: 'docs/specs/index-meta-system/index-meta-system.md',
          role: 'public-library',
        },
      ],
    },
    {
      plane: 'transition',
      refs: [
        {
          id: 'spec-transition',
          kind: 'package',
          path: 'packages/spec-transition/src/index.ts',
          role: 'public-library',
        },
      ],
    },
    {
      plane: 'materialization',
      refs: [
        {
          id: 'address-index',
          kind: 'package',
          path: 'packages/address-index/src/index.ts',
          role: 'public-library',
        },
      ],
    },
    {
      plane: 'feedback',
      refs: [
        {
          id: 'semantic-feedback',
          kind: 'source',
          path: 'packages/definition-service/src/core/semantic-grounding/feedback.ts',
          role: 'runtime-service',
        },
      ],
    },
  ],
};

describe('semantic indexing pack', () => {
  it('validates required planes and duplicate refs', () => {
    const invalidManifest: SemanticIndexingPackManifest = {
      packId: 'broken-pack',
      version: 'v1',
      planes: [
        {
          plane: 'semantic-source',
          refs: [{ id: 'semantic', kind: 'doc', path: 'docs/semantic.md' }],
        },
        {
          plane: 'semantic-source',
          refs: [{ id: 'semantic', kind: 'doc', path: 'docs/semantic-copy.md' }],
        },
      ],
    };

    const result = validateSemanticIndexingPackManifest(invalidManifest);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'semantic-indexing-plane-duplicate',
      'semantic-indexing-plane-missing',
      'semantic-indexing-plane-missing',
      'semantic-indexing-plane-missing',
      'semantic-indexing-plane-missing',
      'semantic-indexing-plane-missing',
      'semantic-indexing-ref-duplicate',
    ]);
  });

  it('classifies changed surfaces by manifest ref before path fallback', () => {
    const changes = classifySemanticIndexingPackChanges(manifest, [
      {
        changeId: 'c1',
        surface: {
          id: 'semantic-feedback',
          path: 'packages/definition-service/src/core/semantic-grounding/feedback.ts',
        },
        changeKind: 'feedback-proposal',
      },
      {
        changeId: 'c2',
        surface: {
          id: 'new-axis-doc',
          path: 'docs/specs/indexing-core-system/coord-foundation/new-axis.md',
        },
        changeKind: 'axis-add',
      },
    ]);

    expect(changes.map((change) => [change.changeId, change.plane, change.reason])).toEqual([
      ['c1', 'feedback', 'manifest-ref'],
      ['c2', 'coordinate', 'path-heuristic'],
    ]);
  });

  it('escalates compatibility from compatible through review to version transition', () => {
    expect(
      evaluateSemanticIndexingCompatibility(manifest, [
        {
          surface: { id: 'alias-doc', path: 'docs/specs/definition-catalog/alias.md' },
          changeKind: 'alias-add',
        },
      ]).verdict,
    ).toBe('compatible');

    expect(
      evaluateSemanticIndexingCompatibility(manifest, [
        {
          surface: {
            id: 'axis-doc',
            path: 'docs/specs/indexing-core-system/coord-foundation/new-axis.md',
          },
          changeKind: 'axis-add',
        },
      ]).verdict,
    ).toBe('review-required');

    const report = evaluateSemanticIndexingCompatibility(manifest, [
      {
        surface: { id: 'prefix-shape', path: 'packages/index-meta/src/catalog.ts' },
        changeKind: 'prefix-shape-change',
      },
    ]);

    expect(report.verdict).toBe('version-transition-required');
    expect(report.reasons).toContain('prefix-shape-change requires coordinate version transition');
  });

  it('normalizes unresolved terms into deduped promotion proposals', () => {
    const proposal = buildSemanticIndexingPromotionProposal({
      kind: 'axis-promotion',
      term: '  Decision Context  ',
      evidence: { query: 'decision context' },
    });

    expect(proposal).toEqual({
      kind: 'axis-promotion',
      term: 'Decision Context',
      normalizedTerm: 'decision context',
      dedupeKey: 'axis-promotion:decision context',
      evidence: { query: 'decision context' },
    });
  });

  it('sorts dirty surfaces first, then newest update, then compatibility role', () => {
    const sorted = sortSemanticIndexingPackSurfaces([
      {
        id: 'ui-demo',
        kind: 'package',
        role: 'ui-demo',
        lastChangedAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'runtime',
        kind: 'package',
        role: 'runtime-service',
        lastChangedAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'dirty-old',
        kind: 'package',
        role: 'public-library',
        lastChangedAt: '2026-01-01T00:00:00.000Z',
        dirty: true,
      },
      {
        id: 'public',
        kind: 'package',
        role: 'public-library',
        lastChangedAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'browser',
        kind: 'package',
        role: 'browser-edge',
        lastChangedAt: '2026-06-01T00:00:00.000Z',
      },
    ]);

    expect(sorted.map((surface) => surface.id)).toEqual([
      'dirty-old',
      'public',
      'browser',
      'runtime',
      'ui-demo',
    ]);
  });

  it('builds a review-only report with sorted surfaces and proposal summary', () => {
    const report = buildSemanticIndexingPackReport({
      manifest,
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [
        {
          surface: {
            id: 'axis-doc',
            path: 'docs/specs/indexing-core-system/coord-foundation/new-axis.md',
          },
          changeKind: 'axis-add',
        },
      ],
      promotionProposals: [
        buildSemanticIndexingPromotionProposal({ kind: 'alias-add', term: 'Semantic Catalog' }),
        buildSemanticIndexingPromotionProposal({
          kind: 'axis-promotion',
          term: 'Decision Context',
        }),
      ],
      surfaces: [
        {
          id: 'runtime',
          kind: 'package',
          role: 'runtime-service',
          lastChangedAt: '2026-06-01T00:00:00.000Z',
        },
        { id: 'dirty', kind: 'package', role: 'public-library', dirty: true },
      ],
    });

    expect(report.compatibility.verdict).toBe('review-required');
    expect(report.surfaces.map((surface) => surface.id)).toEqual(['dirty', 'runtime']);
    expect(report.promotionSummary).toEqual([
      { kind: 'alias-add', count: 1, terms: ['Semantic Catalog'] },
      { kind: 'axis-promotion', count: 1, terms: ['Decision Context'] },
    ]);
    expect(report.reviewOnly).toBe(true);
  });

  it('formats a markdown report without mutation instructions', () => {
    const report = buildSemanticIndexingPackReport({
      manifest,
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [
        {
          surface: { id: 'prefix-shape', path: 'packages/index-meta/src/catalog.ts' },
          changeKind: 'prefix-shape-change',
        },
      ],
    });

    const markdown = formatSemanticIndexingPackReportMarkdown(report);

    expect(markdown).toContain('# Semantic Indexing Pack Report');
    expect(markdown).toContain('Verdict: version-transition-required');
    expect(markdown).toContain('Review-only: yes');
    expect(markdown).not.toContain('auto-apply');
  });

  it('plans grounding from a pack report while delegating materialized index work', () => {
    const report = buildSemanticIndexingPackReport({
      manifest,
      generatedAt: '2026-07-01T00:00:00.000Z',
    });

    const plan = planSemanticIndexingGrounding({
      report,
      intent: 'text-to-sql',
      query: 'cart event table',
    });

    expect(plan.groundable).toBe(true);
    expect(plan.reviewOnly).toBe(true);
    expect(plan.allowedPlanes).toEqual([
      'semantic-source',
      'taxonomy',
      'coordinate',
      'materialization',
    ]);
    expect(plan.candidateSurfaces.map((surface) => surface.id)).toEqual([
      'definition-service-semantic-grounding',
      'taxonomy-boundaries',
      'index-meta-system',
      'address-index',
    ]);
    expect(plan.materializedIndexDelegations).toEqual([
      {
        surfaceId: 'address-index',
        ownerPath: 'packages/address-index/src/index.ts',
        action: 'delegate-to-owner-package',
      },
    ]);
  });

  it('does not ground against a pack that requires version transition', () => {
    const report = buildSemanticIndexingPackReport({
      manifest,
      generatedAt: '2026-07-01T00:00:00.000Z',
      changes: [
        {
          surface: { id: 'prefix-shape', path: 'packages/index-meta/src/catalog.ts' },
          changeKind: 'prefix-shape-change',
        },
      ],
    });

    const plan = planSemanticIndexingGrounding({
      report,
      intent: 'rag',
      query: '상품 담기',
    });

    expect(plan.groundable).toBe(false);
    expect(plan.fallbackReason).toBe('version-transition-required');
    expect(plan.candidateSurfaces).toEqual([]);
  });
});
