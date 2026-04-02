import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildGitConflictReport } from './git-conflicts.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
});

describe('gitConflicts', () => {
  it('현재 브랜치와 remote 브랜치, local worktree의 중첩 변경 지점과 safe scope를 계산한다', async () => {
    const fixture = await createConflictFixture();

    const report = await buildGitConflictReport({
      root: fixture.worktreeDir,
      remote: 'origin',
    });

    expect(report.analysis.baseRef).toBe('origin/main');
    expect(report.analysis.current.branchName).toBe('feature/local');
    expect(report.analysis.current.paths).toEqual([
      'packages/api/schema.sql',
      'packages/cli/src/index.ts',
    ]);

    const alpha = report.analysis.branches.find(
      (branch) => branch.branchName === 'origin/feature/alpha',
    );
    expect(alpha).toBeDefined();
    expect(alpha?.overlappingPaths).toEqual(['packages/api/schema.sql']);

    const beta = report.analysis.branches.find(
      (branch) => branch.branchName === 'origin/feature/beta',
    );
    expect(beta).toBeDefined();
    expect(beta?.overlappingPaths).toEqual(['packages/api/schema.sql']);

    const gamma = report.analysis.branches.find(
      (branch) => branch.branchName === 'origin/feature/gamma',
    );
    expect(gamma).toBeDefined();
    expect(gamma?.overlappingPaths).toEqual([]);

    const localDocs = report.analysis.worktrees.find(
      (worktree) => worktree.branchName === 'feature/local-docs',
    );
    expect(localDocs).toBeDefined();
    expect(localDocs?.displayName).toBe('worktree:feature/local-docs');
    expect(localDocs?.worktreePath.endsWith('/worktree-docs')).toBe(true);
    expect(localDocs?.overlappingPaths).toEqual(['packages/cli/src/index.ts']);

    expect(report.analysis.hotspots).toContainEqual({
      path: 'packages/api/schema.sql',
      branches: [
        'feature/local',
        'origin/feature/alpha',
        'origin/feature/beta',
      ],
    });
    expect(report.analysis.hotspots).toContainEqual({
      path: 'packages/cli/src/index.ts',
      branches: [
        'feature/local',
        'worktree:feature/local-docs',
      ],
    });

    expect(report.currentScopes).toEqual(['packages/api', 'packages/cli']);
    expect(report.occupiedScopes).toEqual([
      'docs',
      'packages/api',
      'packages/cli',
      'packages/web',
      'packages/worker',
    ]);
    expect(report.overlapScopes).toEqual(['packages/api', 'packages/cli']);
    expect(report.safeScopes).toEqual(['(root)']);
  });
});

async function createConflictFixture(): Promise<{
  worktreeDir: string;
  linkedWorktreeDir: string;
}> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'qa-sdk-git-conflicts-'));
  tempDirs.push(tempRoot);

  const remoteDir = join(tempRoot, 'remote.git');
  const seedDir = join(tempRoot, 'seed');
  const worktreeDir = join(tempRoot, 'worktree');
  const linkedWorktreeDir = join(tempRoot, 'worktree-docs');

  git(tempRoot, ['init', '--bare', '--initial-branch=main', remoteDir]);
  git(tempRoot, ['clone', remoteDir, seedDir]);
  configureGitIdentity(seedDir);

  await writeRepoFile(seedDir, 'packages/api/schema.sql', 'schema v1\n');
  await writeRepoFile(seedDir, 'packages/web/src/page.ts', 'page v1\n');
  await writeRepoFile(seedDir, 'packages/cli/src/index.ts', 'cli v1\n');
  await writeRepoFile(seedDir, 'packages/worker/src/job.ts', 'worker v1\n');
  await writeRepoFile(seedDir, 'docs/guide.md', 'guide v1\n');

  git(seedDir, ['add', '.']);
  git(seedDir, ['commit', '-m', 'chore: seed repo']);
  git(seedDir, ['push', 'origin', 'main']);

  git(seedDir, ['checkout', '-b', 'feature/alpha', 'origin/main']);
  await writeRepoFile(seedDir, 'packages/api/schema.sql', 'schema alpha\n');
  git(seedDir, ['add', 'packages/api/schema.sql']);
  git(seedDir, ['commit', '-m', 'feat(api): alpha schema update']);
  git(seedDir, ['push', '-u', 'origin', 'feature/alpha']);

  git(seedDir, ['checkout', 'main']);
  git(seedDir, ['checkout', '-b', 'feature/beta', 'origin/main']);
  await writeRepoFile(seedDir, 'packages/api/schema.sql', 'schema beta\n');
  await writeRepoFile(seedDir, 'packages/web/src/page.ts', 'page beta\n');
  git(seedDir, ['add', 'packages/api/schema.sql', 'packages/web/src/page.ts']);
  git(seedDir, ['commit', '-m', 'feat(api): beta schema update']);
  git(seedDir, ['push', '-u', 'origin', 'feature/beta']);

  git(seedDir, ['checkout', 'main']);
  git(seedDir, ['checkout', '-b', 'feature/gamma', 'origin/main']);
  await writeRepoFile(seedDir, 'packages/worker/src/job.ts', 'worker gamma\n');
  git(seedDir, ['add', 'packages/worker/src/job.ts']);
  git(seedDir, ['commit', '-m', 'feat(worker): gamma worker update']);
  git(seedDir, ['push', '-u', 'origin', 'feature/gamma']);

  git(tempRoot, ['clone', remoteDir, worktreeDir]);
  configureGitIdentity(worktreeDir);
  git(worktreeDir, ['checkout', '-b', 'feature/local', 'origin/main']);
  await writeRepoFile(worktreeDir, 'packages/api/schema.sql', 'schema local\n');
  await writeRepoFile(worktreeDir, 'packages/cli/src/index.ts', 'cli local\n');
  git(worktreeDir, ['add', 'packages/api/schema.sql', 'packages/cli/src/index.ts']);
  git(worktreeDir, ['commit', '-m', 'feat(cli): local conflict candidate']);

  git(worktreeDir, ['worktree', 'add', '-b', 'feature/local-docs', linkedWorktreeDir, 'origin/main']);
  configureGitIdentity(linkedWorktreeDir);
  await writeRepoFile(linkedWorktreeDir, 'packages/cli/src/index.ts', 'cli local docs\n');
  await writeRepoFile(linkedWorktreeDir, 'docs/guide.md', 'guide local docs\n');
  git(linkedWorktreeDir, ['add', 'packages/cli/src/index.ts', 'docs/guide.md']);
  git(linkedWorktreeDir, ['commit', '-m', 'docs(cli): local worktree docs']);

  return { worktreeDir, linkedWorktreeDir };
}

function configureGitIdentity(cwd: string): void {
  git(cwd, ['config', 'user.name', 'QA SDK']);
  git(cwd, ['config', 'user.email', 'qa-sdk@example.com']);
}

async function writeRepoFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = join(root, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-04-02T00:00:00Z',
      GIT_AUTHOR_EMAIL: 'qa-sdk@example.com',
      GIT_AUTHOR_NAME: 'QA SDK',
      GIT_COMMITTER_DATE: '2026-04-02T00:00:00Z',
      GIT_COMMITTER_EMAIL: 'qa-sdk@example.com',
      GIT_COMMITTER_NAME: 'QA SDK',
    },
  }).trim();
}
