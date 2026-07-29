// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main, resolveSubcommand } from './index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

function readDoc(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf-8');
}

describe('skills workflow mapping', () => {
  it('automation-workflows 문서를 대표 command/test와 1:1로 연결한다', async () => {
    const doc = readDoc('docs/skills/automation-workflows.md');

    expect(doc).toContain('qa-sdk quality show <gate-doc-id>');
    expect(doc).toContain('qa-sdk quality run <gate-doc-id> --json');
    expect(doc).toContain('qa-sdk review request ...');
    expect(doc).toContain('qa-sdk docs bdd validate <doc-id> --family-only --json');
    expect(doc).toContain('qa-sdk docs status <doc-id> --family-only --json');
    expect(doc).toContain('qa-sdk docs collect <doc-id> --family-only --json');
    expect(doc).toContain('qa-sdk docs closure <doc-id|source> --json');
    expect(doc).toContain('qa-sdk def find-by-file <path[:symbol]>');
    expect(doc).toContain('qa-sdk def code-link-gaps --scope=<scope> --json');
    expect(doc).toContain('pnpm gate:event-taxonomy');
    expect(doc).toContain('검증 매핑');

    const lifecycleOrder = [
      'qa-sdk docs status <doc-id> --family-only --json',
      'qa-sdk docs collect <doc-id> --family-only --json',
      'qa-sdk def scan-audit',
      'def sync',
      'qa-sdk def find-by-file <path[:symbol]>',
      'qa-sdk def validate',
      'def audit',
    ];
    const lifecyclePositions = lifecycleOrder.map((command) => doc.indexOf(command));
    expect(lifecyclePositions.every((position) => position >= 0)).toBe(true);
    expect(
      lifecyclePositions.every(
        (position, index) => index === 0 || position > lifecyclePositions[index - 1]!,
      ),
    ).toBe(true);
    const closurePositions = [...doc.matchAll(/qa-sdk docs closure <doc-id\|source> --json/g)].map(
      (match) => match.index ?? -1,
    );
    expect(closurePositions.length).toBeGreaterThanOrEqual(2);
    expect(closurePositions[0]).toBeLessThan(lifecyclePositions[2]!);
    expect(closurePositions[1]).toBeGreaterThan(lifecyclePositions[6]!);

    expect(
      resolveSubcommand(['docs', 'bdd', 'validate', 'checkout-spec', '--family-only', '--json']),
    ).toEqual({
      name: 'docs bdd validate',
      rest: ['checkout-spec', '--family-only', '--json'],
    });
    expect(
      resolveSubcommand(['docs', 'bdd', 'units', 'checkout-spec', '--family-only', '--json']),
    ).toEqual({
      name: 'docs bdd units',
      rest: ['checkout-spec', '--family-only', '--json'],
    });
    expect(
      resolveSubcommand(['docs', 'status', 'checkout-spec', '--family-only', '--json']),
    ).toEqual({
      name: 'docs status',
      rest: ['checkout-spec', '--family-only', '--json'],
    });
    expect(
      resolveSubcommand(['docs', 'collect', 'checkout-spec', '--family-only', '--json']),
    ).toEqual({
      name: 'docs collect',
      rest: ['checkout-spec', '--family-only', '--json'],
    });
    expect(resolveSubcommand(['docs', 'closure', 'checkout-spec', '--json'])).toEqual({
      name: 'docs closure',
      rest: ['checkout-spec', '--json'],
    });
    expect(resolveSubcommand(['def', 'find-by-file', 'packages/cli/src/commands/docs.ts'])).toEqual(
      {
        name: 'def find-by-file',
        rest: ['packages/cli/src/commands/docs.ts'],
      },
    );
    expect(
      resolveSubcommand(['def', 'code-link-gaps', '--scope=packages/cli/src', '--json']),
    ).toEqual({
      name: 'def code-link-gaps',
      rest: ['--scope=packages/cli/src', '--json'],
    });
    expect(resolveSubcommand(['quality', 'show', 'gate-a'])).toEqual({
      name: 'quality show',
      rest: ['gate-a'],
    });
    expect(resolveSubcommand(['quality', 'run', 'gate-a', '--json'])).toEqual({
      name: 'quality run',
      rest: ['gate-a', '--json'],
    });
    expect(
      resolveSubcommand([
        'review',
        'request',
        'src/a.ts',
        '--reviewer',
        'bot',
        '--purpose',
        'check',
      ]),
    ).toEqual({
      name: 'review request',
      rest: ['src/a.ts', '--reviewer', 'bot', '--purpose', 'check'],
    });

    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/quality.test.ts'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/review.test.ts'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/scenarios.e2e.test.ts'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/docs.test.ts'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, 'scripts/registry-event-taxonomy-gate.sh'))).toBe(true);
  });

  it('skill catalog guide paths point at existing files', () => {
    const guides = ['docs/skills/automation-workflows.md', 'docs/skills/ralph-tui-workflows.md'];
    const referencedSkillCatalogPaths = guides.flatMap((path) => {
      const doc = readDoc(path);
      return [...doc.matchAll(/`(docs\/specs\/skill-catalog\/[^`]+)`/g)]
        .map((match) => match[1]!)
        .filter((value) => !value.includes('*'));
    });

    expect(referencedSkillCatalogPaths).toEqual(
      expect.arrayContaining([
        'docs/specs/skill-catalog/automation-skill-group/skill-bdd-contract.spec.md',
        'docs/specs/skill-catalog/automation-skill-group/skill-doc-lifecycle.spec.md',
        'docs/specs/skill-catalog/automation-skill-group/skill-event-taxonomy-gate.spec.md',
        'docs/specs/skill-catalog/ralph-tui-skill-group/skill-ralph-tui-prd.spec.md',
      ]),
    );
    for (const path of referencedSkillCatalogPaths) {
      expect(existsSync(resolve(REPO_ROOT, path)), path).toBe(true);
    }
  });

  it('system-review 문서를 대표 command/test와 1:1로 연결한다', async () => {
    const doc = readDoc('docs/skills/system-review.md');

    expect(doc).toContain('node packages/cli/dist/index.js dkg self-check');
    expect(doc).toContain('node packages/cli/dist/index.js dkg converge');
    expect(doc).toContain('node packages/cli/dist/index.js dkg metrics');
    expect(doc).toContain('node packages/cli/dist/index.js dkg overview');
    expect(doc).toContain('dkg run skill-system-health-chain');
    expect(doc).toContain('검증 매핑');

    expect(resolveSubcommand(['dkg', 'self-check'])).toEqual({
      name: 'dkg self-check',
      rest: [],
    });
    expect(resolveSubcommand(['dkg', 'converge', '--persist'])).toEqual({
      name: 'dkg converge',
      rest: ['--persist'],
    });
    expect(resolveSubcommand(['dkg', 'metrics'])).toEqual({
      name: 'dkg metrics',
      rest: [],
    });
    expect(resolveSubcommand(['dkg', 'overview'])).toEqual({
      name: 'dkg overview',
      rest: [],
    });
    expect(resolveSubcommand(['dkg', 'run', 'skill-system-health-chain'])).toEqual({
      name: 'dkg run',
      rest: ['skill-system-health-chain'],
    });
    expect(resolveSubcommand(['dkg', 'skills', 'analysis'])).toEqual({
      name: 'dkg skills',
      rest: ['analysis'],
    });

    const stdout: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      stdout.push(args.join(' '));
    };
    try {
      await main(['dkg', 'decisions', '--help']);
    } finally {
      console.log = originalLog;
    }
    expect(stdout.join('\n')).toContain('qa-sdk dkg decisions');

    stdout.length = 0;
    console.log = (...args: unknown[]) => {
      stdout.push(args.join(' '));
    };
    try {
      await main(['dkg', 'overview']);
      await main(['dkg', 'metrics']);
      await main(['dkg', 'converge']);
      await main(['dkg', 'self-check', '--fast']);
    } finally {
      console.log = originalLog;
    }
    const output = stdout.join('\n');
    expect(output).toContain('System Overview');
    expect(output).toContain('Metrics Dashboard');
    expect(output).toContain('Convergence Pipeline');
    expect(output).toContain('Self-Check (--fast)');

    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/dkg.e2e.test.ts'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/flow.test.ts'))).toBe(true);
  });

  it('prefix/claim/decide/ingest/boundary workflow 문서를 대표 command/test와 연결한다', async () => {
    const prefixExplore = readDoc('docs/skills/prefix-explore.md');
    const claimWorkflow = readDoc('docs/skills/claim-workflow.md');
    const decide = readDoc('docs/skills/decide.md');
    const ingestInsights = readDoc('docs/skills/ingest-insights.md');
    const boundaryWorkflow = readDoc('docs/skills/definition-boundary-workflow.md');

    expect(prefixExplore).toContain('node packages/cli/dist/index.js dkg prefix permission');
    expect(claimWorkflow).toContain('node packages/cli/dist/index.js dkg claim <nodeId>');
    expect(claimWorkflow).toContain('node packages/cli/dist/index.js dkg release <nodeId>');
    expect(decide).toContain('dkg run skill-decision-scaffold');
    expect(decide).toContain('dkg run skill-record-decision');
    expect(ingestInsights).toContain('node packages/cli/dist/index.js ingest mode');
    expect(ingestInsights).toContain('node packages/cli/dist/index.js ingest insights');
    expect(boundaryWorkflow).toContain('qa-sdk def boundary <문서ID>');
    expect(resolveSubcommand(['dkg', 'prefix', 'permission'])).toEqual({
      name: 'dkg prefix',
      rest: ['permission'],
    });
    expect(resolveSubcommand(['dkg', 'claim', 'role', '--by', 'agent-A'])).toEqual({
      name: 'dkg claim',
      rest: ['role', '--by', 'agent-A'],
    });
    expect(resolveSubcommand(['dkg', 'release', 'role'])).toEqual({
      name: 'dkg release',
      rest: ['role'],
    });
    expect(
      resolveSubcommand([
        'dkg',
        'run',
        'skill-record-decision',
        'axis',
        'new-axis',
        'title',
        'why',
      ]),
    ).toEqual({
      name: 'dkg run',
      rest: ['skill-record-decision', 'axis', 'new-axis', 'title', 'why'],
    });
    expect(resolveSubcommand(['ingest', 'insights'])).toEqual({
      name: 'ingest insights',
      rest: [],
    });
    expect(resolveSubcommand(['def', 'boundary', 'cli-command-spec'])).toEqual({
      name: 'def boundary',
      rest: ['cli-command-spec'],
    });
    const stdout: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      stdout.push(args.join(' '));
    };
    try {
      await main(['ingest', '--help']);
      await main(['def', 'boundary', '--help']);
    } finally {
      console.log = originalLog;
    }
    const output = stdout.join('\n');
    expect(output).toContain('qa-sdk ingest');
    expect(output).toContain('qa-sdk def boundary');

    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/dkg.e2e.test.ts'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/review.test.ts'))).toBe(true);
    expect(
      existsSync(resolve(REPO_ROOT, 'packages/cli/src/commands/ingest-mode.e2e.test.ts')),
    ).toBe(true);
  });
});
