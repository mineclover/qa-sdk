// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import type {
  GitConflictCommit,
  GitConflictDiffStats,
  GitConflictFileChange,
  GitConflictReportInput,
  GitConflictSource,
  GitConflictSplitPoint,
} from './types.js';

const file = (path: string, status: GitConflictFileChange['status']): GitConflictFileChange => ({
  path,
  status,
  previousPath: null,
  oldOid: null,
  newOid: null,
  binary: false,
});

const splitPoint = (
  shortOid: string,
  committedAt: string,
  authorName: string,
  authorEmail: string,
  summary: string,
  changedPaths: string[] = [],
  diffStats = {
    filesChanged: changedPaths.length,
    insertions: changedPaths.length * 4,
    deletions: changedPaths.length,
  },
): GitConflictSplitPoint => ({
  oid: `${shortOid}${'0'.repeat(Math.max(0, 40 - shortOid.length))}`,
  shortOid,
  committedAt,
  authorName,
  authorEmail,
  summary,
  diffStats,
  changedPaths,
});

const commit = (
  shortOid: string,
  committedAt: string,
  authorName: string,
  authorEmail: string,
  summary: string,
  changedPaths: string[],
  conventionalType?: string,
  conventionalScope?: string,
): GitConflictCommit => ({
  oid: `${shortOid}${'1'.repeat(Math.max(0, 40 - shortOid.length))}`,
  shortOid,
  committedAt,
  authorName,
  authorEmail,
  summary,
  conventionalType: conventionalType ?? null,
  conventionalScope: conventionalScope ?? null,
  breaking: false,
  changedPaths,
});

function branchSource(
  branchName: string,
  options: {
    displayName?: string;
    files: GitConflictFileChange[];
    diffStats: GitConflictDiffStats;
    splitPoint: GitConflictSplitPoint | null;
    commits: GitConflictCommit[];
  },
): GitConflictSource {
  return {
    branchName,
    displayName: options.displayName,
    ref: `refs/heads/${branchName}`,
    headOid: `${branchName
      .replaceAll(/[^a-zA-Z0-9]/g, '')
      .padEnd(40, 'a')
      .slice(0, 40)}`,
    mergeBaseOid: 'base000000000000000000000000000000000000',
    files: options.files,
    paths: options.files.map((entry) => entry.path),
    diffStats: options.diffStats,
    splitPoint: options.splitPoint,
    commitCount: options.commits.length,
    commits: options.commits,
  } as GitConflictSource;
}

function comparedBranchSource(
  branchName: string,
  options: {
    displayName?: string;
    files: GitConflictFileChange[];
    diffStats: GitConflictDiffStats;
    splitPoint: GitConflictSplitPoint | null;
    commits: GitConflictCommit[];
    overlappingPaths: string[];
  },
) {
  return {
    ...branchSource(branchName, options),
    overlappingPaths: options.overlappingPaths,
    overlappingFiles: options.overlappingPaths.map((path) => ({
      path,
      currentStatus: 'Modified' as const,
      comparedStatus: 'Modified' as const,
    })),
    currentOnlyPaths: [],
    branchOnlyPaths: options.files
      .map((entry) => entry.path)
      .filter((path) => !options.overlappingPaths.includes(path)),
  };
}

function comparedWorktreeSource(
  branchName: string,
  options: {
    displayName: string;
    worktreePath: string;
    files: GitConflictFileChange[];
    diffStats: GitConflictDiffStats;
    splitPoint: GitConflictSplitPoint | null;
    commits: GitConflictCommit[];
    overlappingPaths: string[];
  },
) {
  return {
    ...comparedBranchSource(branchName, options),
    worktreePath: options.worktreePath,
    branchRef: `refs/heads/${branchName}`,
    isDetached: false,
  };
}

export const SAMPLE_REPORT: GitConflictReportInput = {
  schemaVersion: 'git-conflicts-report/v1',
  generatedAt: '2026-04-03T12:00:00+09:00',
  analysis: {
    repoPath: '/workspace/qa-sdk',
    currentWorktreePath: '/workspace/qa-sdk',
    executionCwd: '/workspace/qa-sdk/packages/cli',
    fetched: false,
    baseHeadOid: 'e3f196ca5c571ad017754ac16448d4b2d2cd6e7a',
    currentRef: 'HEAD',
    current: branchSource('feature/local', {
      files: [
        file('packages/api/schema.sql', 'Modified'),
        file('packages/cli/src/index.ts', 'Modified'),
        file('packages/cli/src/commands/git-conflicts.ts', 'Added'),
      ],
      diffStats: { filesChanged: 3, insertions: 142, deletions: 29 },
      splitPoint: splitPoint(
        'aaaaaa0',
        '2026-04-03T07:40:00+09:00',
        'QA SDK',
        'qa-sdk@example.com',
        'chore(cli): prepare branch split',
        ['packages/cli/src/index.ts'],
        { filesChanged: 1, insertions: 6, deletions: 1 },
      ),
      commits: [
        commit(
          '1111111',
          '2026-04-03T09:10:00+09:00',
          'QA SDK',
          'qa-sdk@example.com',
          'feat(cli): add git conflicts watch mode',
          ['packages/cli/src/commands/git-conflicts.ts', 'packages/cli/src/index.ts'],
          'feat',
          'cli',
        ),
        commit(
          '1111112',
          '2026-04-03T10:20:00+09:00',
          'QA SDK',
          'qa-sdk@example.com',
          'feat(registry-ui): add file map panel',
          ['packages/cli/src/index.ts', 'packages/registry-ui/src/pages/file-map.ts'],
          'feat',
          'registry-ui',
        ),
      ],
    }),
    currentBranchName: 'feature/local',
    currentHeadOid: 'c2dc3b8000000000000000000000000000000000',
    repoWorkspace: {
      scope: 'repo',
      executionCwd: '/workspace/qa-sdk',
      relativePath: '.',
      diffStats: { filesChanged: 6, insertions: 44, deletions: 12 },
      files: [
        file('packages/cli/src/commands/git-conflicts.ts', 'Modified'),
        file('packages/cli/src/index.ts', 'Modified'),
        file('packages/registry-ui/src/pages/file-map/render.ts', 'Modified'),
        file('packages/registry-ui/src/pages/file-map/page.ts', 'Modified'),
        file('packages/registry-ui/src/styles/main.css', 'Modified'),
        file('packages/git-utils/src/branch-conflicts-analysis.ts', 'Modified'),
      ],
      paths: [
        'packages/cli/src/commands/git-conflicts.ts',
        'packages/cli/src/index.ts',
        'packages/registry-ui/src/pages/file-map/render.ts',
        'packages/registry-ui/src/pages/file-map/page.ts',
        'packages/registry-ui/src/styles/main.css',
        'packages/git-utils/src/branch-conflicts-analysis.ts',
      ],
    },
    workspace: {
      scope: 'execution',
      executionCwd: '/workspace/qa-sdk/packages/cli',
      relativePath: 'packages/cli',
      diffStats: { filesChanged: 2, insertions: 17, deletions: 3 },
      files: [
        file('packages/cli/src/commands/git-conflicts.ts', 'Modified'),
        file('packages/cli/src/index.ts', 'Modified'),
      ],
      paths: ['packages/cli/src/commands/git-conflicts.ts', 'packages/cli/src/index.ts'],
    },
    baseRef: 'origin/main',
    remoteName: 'origin',
    branches: [
      comparedBranchSource('origin/feature/alpha', {
        displayName: 'origin/feature/alpha',
        files: [
          file('packages/api/schema.sql', 'Modified'),
          file('packages/api/migrations/20260402.sql', 'Added'),
        ],
        diffStats: { filesChanged: 2, insertions: 87, deletions: 14 },
        splitPoint: splitPoint(
          'bbbbbb0',
          '2026-04-03T07:10:00+09:00',
          'Alice',
          'alice@example.com',
          'chore(api): branch alpha from main',
          ['packages/api/schema.sql'],
          { filesChanged: 1, insertions: 4, deletions: 0 },
        ),
        commits: [
          commit(
            '2222221',
            '2026-04-03T08:10:00+09:00',
            'Alice',
            'alice@example.com',
            'feat(api): update schema layout',
            ['packages/api/schema.sql'],
            'feat',
            'api',
          ),
          commit(
            '2222222',
            '2026-04-03T08:40:00+09:00',
            'Alice',
            'alice@example.com',
            'feat(api): add migration draft',
            ['packages/api/migrations/20260402.sql'],
            'feat',
            'api',
          ),
        ],
        overlappingPaths: ['packages/api/schema.sql'],
      }),
      comparedBranchSource('origin/feature/beta', {
        displayName: 'origin/feature/beta',
        files: [
          file('packages/api/schema.sql', 'Modified'),
          file('packages/web/src/page.ts', 'Modified'),
        ],
        diffStats: { filesChanged: 2, insertions: 31, deletions: 22 },
        splitPoint: splitPoint(
          'cccccc0',
          '2026-04-03T07:20:00+09:00',
          'Bob',
          'bob@example.com',
          'chore(api): branch beta from main',
          ['packages/web/src/page.ts'],
          { filesChanged: 1, insertions: 2, deletions: 1 },
        ),
        commits: [
          commit(
            '3333331',
            '2026-04-03T08:50:00+09:00',
            'Bob',
            'bob@example.com',
            'fix(api): align schema with web page',
            ['packages/api/schema.sql', 'packages/web/src/page.ts'],
            'fix',
            'api',
          ),
        ],
        overlappingPaths: ['packages/api/schema.sql'],
      }),
      comparedBranchSource('origin/feature/gamma', {
        displayName: 'origin/feature/gamma',
        files: [file('packages/worker/src/job.ts', 'Modified')],
        diffStats: { filesChanged: 1, insertions: 18, deletions: 11 },
        splitPoint: splitPoint(
          'dddddd0',
          '2026-04-03T07:25:00+09:00',
          'Carol',
          'carol@example.com',
          'chore(worker): branch gamma from main',
          ['packages/worker/src/job.ts'],
          { filesChanged: 1, insertions: 1, deletions: 0 },
        ),
        commits: [
          commit(
            '4444441',
            '2026-04-03T11:10:00+09:00',
            'Carol',
            'carol@example.com',
            'refactor(worker): simplify job flow',
            ['packages/worker/src/job.ts'],
            'refactor',
            'worker',
          ),
        ],
        overlappingPaths: [],
      }),
    ],
    worktrees: [
      comparedWorktreeSource('feature/local-docs', {
        displayName: 'worktree:feature/local-docs',
        worktreePath: '/tmp/qa-sdk/worktree-docs',
        files: [file('packages/cli/src/index.ts', 'Modified'), file('docs/guide.md', 'Modified')],
        diffStats: { filesChanged: 2, insertions: 21, deletions: 7 },
        splitPoint: splitPoint(
          'eeeeee0',
          '2026-04-03T09:35:00+09:00',
          'Dana',
          'dana@example.com',
          'chore(docs): branch local-docs from feature/local',
          ['docs/guide.md'],
          { filesChanged: 1, insertions: 3, deletions: 0 },
        ),
        commits: [
          commit(
            '5555551',
            '2026-04-03T10:55:00+09:00',
            'Dana',
            'dana@example.com',
            'docs(cli): update file map onboarding',
            ['packages/cli/src/index.ts', 'docs/guide.md'],
            'docs',
            'cli',
          ),
        ],
        overlappingPaths: ['packages/cli/src/index.ts'],
      }),
    ],
    hotspots: [
      {
        path: 'packages/api/schema.sql',
        branches: ['feature/local', 'origin/feature/alpha', 'origin/feature/beta'],
      },
      {
        path: 'packages/cli/src/index.ts',
        branches: ['feature/local', 'worktree:feature/local-docs'],
      },
    ],
  },
  workspaceScopes: ['(root)', 'packages/api', 'packages/cli', 'packages/worker', 'packages/web'],
  currentScopes: ['packages/api', 'packages/cli'],
  occupiedScopes: ['packages/api', 'packages/cli', 'packages/web', 'packages/worker'],
  overlapScopes: ['packages/api', 'packages/cli'],
  safeScopes: ['(root)', 'packages/worker'],
};
