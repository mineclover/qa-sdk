// @def.doc ralph-tui-integration-test

import { describe, expect, it } from 'vitest';

import { buildRalphPrdJsonEnvelopeFromContent } from './ralph-prd-json.js';

const ROOT = '/tmp/repo';
const PATH = 'tasks/sample-prd.json';

describe('ralph-tui-integration — buildRalphPrdJsonEnvelopeFromContent', () => {
  it('builds an envelope with tasks from a valid flat-root PRD JSON', () => {
    const envelope = build({
      name: 'Checkout PRD',
      branchName: 'feature/checkout',
      description: 'Deliver the checkout flow.',
      userStories: [
        {
          id: 'US-001',
          title: 'Complete checkout',
          description: 'Users can complete a purchase.',
          dependsOn: [],
          passes: true,
          acceptanceCriteria: ['`pnpm typecheck` passes'],
        },
        {
          id: 'US-002',
          title: 'Validate receipts',
          dependsOn: ['US-001'],
          passes: false,
          acceptanceCriteria: [],
        },
      ],
    });

    expect(envelope.kind).toBe('ralph-prd-json');
    expect(envelope.familyId).toBe('tasks/sample-prd');
    expect(envelope.tasks).toHaveLength(2);
    expect(envelope.tasks[0]!.id).toBe('US-001');
    expect(envelope.tasks[0]!.metadata.passes).toBe(true);
    expect(envelope.tasks[0]!.metadata.qualityGates).toEqual(['`pnpm typecheck` passes']);
    expect(envelope.tasks[1]!.metadata.passes).toBe(false);
    expect(envelope.metadata.storyCount).toBe(2);
    expect(envelope.metadata.passedStoryCount).toBe(1);
    expect(envelope.diagnostics).toEqual([]);
  });

  it('surfaces a parse-error diagnostic when JSON is invalid', () => {
    const envelope = buildRalphPrdJsonEnvelopeFromContent(ROOT, PATH, '{not json');
    expect(envelope.diagnostics.map((d) => d.code)).toContain('ralph-prd-json-parse-error');
    expect(envelope.tasks).toEqual([]);
  });

  it('rejects non-object roots', () => {
    const envelope = buildRalphPrdJsonEnvelopeFromContent(ROOT, PATH, '[]');
    expect(envelope.diagnostics.map((d) => d.code)).toContain('ralph-prd-json-root-not-object');
  });

  it('rejects legacy nested root.prd shape', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [],
      prd: { legacy: true },
    });
    expect(envelope.diagnostics.map((d) => d.code)).toContain('ralph-prd-json-root-prd');
  });

  it('rejects legacy root.tasks shape', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [],
      tasks: [],
    });
    expect(envelope.diagnostics.map((d) => d.code)).toContain('ralph-prd-json-root-tasks');
  });

  it('errors on missing required root fields', () => {
    const envelope = build({
      userStories: [],
    });
    const codes = envelope.diagnostics.map((d) => d.code);
    expect(codes).toContain('ralph-prd-json-missing-root-field');
    expect(codes.filter((code) => code === 'ralph-prd-json-missing-root-field')).toHaveLength(3);
  });

  it('errors when userStories is missing or not an array', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
    });
    expect(envelope.diagnostics.map((d) => d.code)).toContain(
      'ralph-prd-json-missing-user-stories',
    );
  });

  it('warns when stories carry a status anti-pattern', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [
        {
          id: 'US-001',
          title: 'Story',
          status: 'in_progress',
          dependsOn: [],
        },
      ],
    });
    expect(envelope.diagnostics.map((d) => d.code)).toContain('ralph-prd-json-story-status');
    expect(envelope.tasks[0]!.metadata.storyStatus).toBe('in_progress');
  });

  it('errors when passes is present but not boolean', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [
        {
          id: 'US-001',
          title: 'Story',
          passes: 'yes',
          dependsOn: [],
        },
      ],
    });
    expect(envelope.diagnostics.map((d) => d.code)).toContain(
      'ralph-prd-json-story-passes-non-boolean',
    );
  });

  it('warns when dependsOn is missing', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [
        {
          id: 'US-001',
          title: 'Story',
        },
      ],
    });
    expect(envelope.diagnostics.map((d) => d.code)).toContain(
      'ralph-prd-json-story-depends-on-missing',
    );
  });

  it('errors when dependsOn is not an array', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [
        {
          id: 'US-001',
          title: 'Story',
          dependsOn: 'US-000',
        },
      ],
    });
    expect(envelope.diagnostics.map((d) => d.code)).toContain(
      'ralph-prd-json-story-depends-on-invalid',
    );
  });

  it('warns on unknown root.metadata keys and accepts allowed tracker metadata', () => {
    const unknown = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [],
      metadata: { unknownField: 'x' },
    });
    expect(unknown.diagnostics.map((d) => d.code)).toContain('ralph-prd-json-root-metadata');

    const allowed = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [],
      metadata: {
        agentPlugin: 'claude-code',
        completedAt: '2026-04-18T00:00:00Z',
        createdAt: '2026-04-01T00:00:00Z',
        endedAt: '2026-04-18T00:00:00Z',
        trackerPlugin: 'beads',
        updatedAt: '2026-04-10T00:00:00Z',
      },
    });
    expect(allowed.diagnostics.map((d) => d.code)).not.toContain('ralph-prd-json-root-metadata');
  });

  it('extracts quality gate acceptance criteria (backticked + passes keyword)', () => {
    const envelope = build({
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [
        {
          id: 'US-001',
          title: 'Story',
          dependsOn: [],
          acceptanceCriteria: [
            '`pnpm typecheck` passes without errors',
            '`pnpm lint` passes cleanly',
            'A plain acceptance criterion without a gate',
          ],
        },
      ],
    });
    expect(envelope.tasks[0]!.metadata.qualityGates).toEqual([
      '`pnpm typecheck` passes without errors',
      '`pnpm lint` passes cleanly',
    ]);
  });
});

function build(root: unknown) {
  return buildRalphPrdJsonEnvelopeFromContent(ROOT, PATH, JSON.stringify(root));
}
