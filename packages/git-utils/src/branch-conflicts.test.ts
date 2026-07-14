// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 분기 충돌 분석 + worktree + 순수 파서 — 임시 repo 시나리오 테스트
 */

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { parseGitWorktreeList } from './branch-conflicts-worktrees.js';
import { listGitWorktrees } from './branch-conflicts-worktrees.js';
import { collectWorkspaceChanges } from './branch-conflicts-workspace.js';
import { analyzeRemoteBranchConflicts } from './branch-conflicts-analysis.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-04-05T00:00:00Z',
      GIT_COMMITTER_DATE: '2026-04-05T00:00:00Z',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 't@t.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 't@t.com',
    },
  }).trim();
}

async function writeRepoFile(root: string, path: string, content: string) {
  const full = join(root, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, 'utf-8');
}

function configId(cwd: string) {
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 't@t.com']);
}

// ── parseGitWorktreeList (순수 파서) ─────────────────

describe('parseGitWorktreeList', () => {
  it('porcelain 포맷 파싱 — branch + bare + detached', () => {
    const output = [
      'worktree /repo',
      'HEAD abc1234567890123456789012345678901234567',
      'branch refs/heads/main',
      '',
      'worktree /repo-wt',
      'HEAD def1234567890123456789012345678901234567',
      'branch refs/heads/feature',
      '',
      'worktree /bare',
      'HEAD 0001234567890123456789012345678901234567',
      'bare',
      '',
    ].join('\n');

    const wts = parseGitWorktreeList(output);
    expect(wts).toHaveLength(3);
    expect(wts[0].branchRef).toBe('refs/heads/main');
    expect(wts[0].isBare).toBe(false);
    expect(wts[1].branchRef).toBe('refs/heads/feature');
    expect(wts[2].isBare).toBe(true);
    expect(wts[2].branchRef).toBeNull();
  });

  it('빈 출력 → 빈 배열', () => {
    expect(parseGitWorktreeList('')).toHaveLength(0);
  });

  it('detached HEAD', () => {
    const output = [
      'worktree /detached',
      'HEAD abc1234567890123456789012345678901234567',
      'detached',
      '',
    ].join('\n');
    const wts = parseGitWorktreeList(output);
    expect(wts[0].isDetached).toBe(true);
    expect(wts[0].branchRef).toBeNull();
  });
});

// ── listGitWorktrees (fail-silent) ──────────────────

describe('listGitWorktrees', () => {
  it('잘못된 경로 → 빈 배열 (fail-silent)', () => {
    const result = listGitWorktrees('/nonexistent/path');
    expect(result).toEqual([]);
  });
});

// ── 분기 충돌 분석 시나리오 ─────────────────────────

describe('analyzeRemoteBranchConflicts', () => {
  async function createConflictFixture() {
    const root = await mkdtemp(join(tmpdir(), 'git-conflicts-'));
    tempDirs.push(root);

    const remoteDir = join(root, 'remote.git');
    const workDir = join(root, 'work');

    git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
    configId(workDir);

    // seed
    await writeRepoFile(workDir, 'src/api.ts', 'api v1\n');
    await writeRepoFile(workDir, 'src/cli.ts', 'cli v1\n');
    await writeRepoFile(workDir, 'docs/readme.md', 'readme v1\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'chore: seed']);
    git(workDir, ['push', 'origin', 'main']);

    // feature/alpha — api 변경
    git(workDir, ['checkout', '-b', 'feature/alpha', 'origin/main']);
    await writeRepoFile(workDir, 'src/api.ts', 'api alpha\n');
    git(workDir, ['add', 'src/api.ts']);
    git(workDir, ['commit', '-m', 'feat(api): alpha']);
    git(workDir, ['push', '-u', 'origin', 'feature/alpha']);

    // feature/beta — api + docs 변경
    git(workDir, ['checkout', 'main']);
    git(workDir, ['checkout', '-b', 'feature/beta', 'origin/main']);
    await writeRepoFile(workDir, 'src/api.ts', 'api beta\n');
    await writeRepoFile(workDir, 'docs/readme.md', 'readme beta\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat(api): beta']);
    git(workDir, ['push', '-u', 'origin', 'feature/beta']);

    // 로컬 feature/local — api + cli 변경
    git(workDir, ['checkout', 'main']);
    git(workDir, ['checkout', '-b', 'feature/local', 'origin/main']);
    await writeRepoFile(workDir, 'src/api.ts', 'api local\n');
    await writeRepoFile(workDir, 'src/cli.ts', 'cli local\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat(cli): local']);

    return workDir;
  }

  it('기본 시나리오 — overlap 탐지 + hotspot', { timeout: 30000 }, async () => {
    const cwd = await createConflictFixture();

    const result = await analyzeRemoteBranchConflicts({
      cwd,
      remoteName: 'origin',
      baseRef: 'origin/main',
      fetch: false,
    });

    expect(result.baseRef).toBe('origin/main');
    expect(result.current.branchName).toBe('feature/local');
    expect(result.current.paths).toContain('src/api.ts');
    expect(result.current.paths).toContain('src/cli.ts');

    // alpha: api overlap
    const alpha = result.branches.find((b) => b.branchName.includes('alpha'));
    expect(alpha).toBeDefined();
    expect(alpha!.overlappingPaths).toContain('src/api.ts');

    // beta: api overlap
    const beta = result.branches.find((b) => b.branchName.includes('beta'));
    expect(beta).toBeDefined();
    expect(beta!.overlappingPaths).toContain('src/api.ts');

    // hotspot: src/api.ts가 3개 브랜치
    const apiHotspot = result.hotspots.find((h) => h.path === 'src/api.ts');
    expect(apiHotspot).toBeDefined();
    expect(apiHotspot!.branches.length).toBeGreaterThanOrEqual(2);
  });

  it('workspace — untracked 파일 감지', { timeout: 30000 }, async () => {
    const cwd = await createConflictFixture();

    // uncommitted untracked 변경 추가
    await writeRepoFile(cwd, 'src/live.ts', 'live change\n');

    const result = await analyzeRemoteBranchConflicts({
      cwd,
      executionCwd: cwd,
      remoteName: 'origin',
      baseRef: 'origin/main',
      fetch: false,
    });

    // repoWorkspace에서 untracked 파일 확인
    expect(result.repoWorkspace).toBeDefined();
    expect(result.repoWorkspace!.paths).toContain('src/live.ts');
    expect(result.repoWorkspace!.files.find((f) => f.path === 'src/live.ts')?.status).toBe(
      'Untracked',
    );
  });

  it('workspace — staged + modified 혼합 감지', { timeout: 30000 }, async () => {
    const cwd = await createConflictFixture();

    // staged 변경 (기존 파일 수정 후 add)
    await writeRepoFile(cwd, 'src/api.ts', 'api staged change\n');
    git(cwd, ['add', 'src/api.ts']);
    // unstaged 변경 (staged 후 다시 수정)
    await writeRepoFile(cwd, 'src/api.ts', 'api unstaged after stage\n');

    const result = await analyzeRemoteBranchConflicts({
      cwd,
      executionCwd: cwd,
      remoteName: 'origin',
      baseRef: 'origin/main',
      fetch: false,
    });

    expect(result.repoWorkspace).toBeDefined();
    expect(result.repoWorkspace!.paths).toContain('src/api.ts');
    expect(result.repoWorkspace!.diffStats.filesChanged).toBeGreaterThan(0);
  });
});

// ── collectWorkspaceChanges 단위 테스트 ───────────────

describe('collectWorkspaceChanges', () => {
  it('repo 외부 경로 → null', () => {
    const result = collectWorkspaceChanges('/some/repo', '/completely/different/path');
    expect(result).toBeNull();
  });

  it('변경 없는 repo → 빈 결과', { timeout: 15000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'git-ws-clean-'));
    tempDirs.push(root);

    const remoteDir = join(root, 'remote.git');
    const workDir = join(root, 'work');

    git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
    configId(workDir);

    await writeRepoFile(workDir, 'file.txt', 'clean\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'chore: init']);

    const result = collectWorkspaceChanges(workDir, workDir);
    expect(result).toBeDefined();
    expect(result!.files).toHaveLength(0);
    expect(result!.diffStats.filesChanged).toBe(0);
  });

  it('하위 디렉토리 scope → relativePath 계산', { timeout: 15000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'git-ws-sub-'));
    tempDirs.push(root);

    const remoteDir = join(root, 'remote.git');
    const workDir = join(root, 'work');

    git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
    configId(workDir);

    await writeRepoFile(workDir, 'packages/a/src/index.ts', 'code\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'chore: init']);

    // 하위 디렉토리에 새 파일 추가
    await writeRepoFile(workDir, 'packages/a/src/new.ts', 'new file\n');

    const result = collectWorkspaceChanges(workDir, join(workDir, 'packages/a'));
    expect(result).toBeDefined();
    expect(result!.relativePath).toBe('packages/a');
    expect(result!.paths.some((p) => p.includes('new.ts'))).toBe(true);
  });
});

// ── 에러 시나리오 ───────────────────────────────────

describe('에러 시나리오', () => {
  it('빈 repo (커밋 없음) → 분석 가능 (빈 결과)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'git-empty-'));
    tempDirs.push(root);
    const remoteDir = join(root, 'remote.git');
    const workDir = join(root, 'work');

    git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
    configId(workDir);

    // 최소 1 커밋 (git에서 main ref가 없으면 merge-base 불가)
    await writeRepoFile(workDir, 'init.txt', 'init\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'chore: init']);
    git(workDir, ['push', 'origin', 'main']);

    const result = await analyzeRemoteBranchConflicts({
      cwd: workDir,
      remoteName: 'origin',
      baseRef: 'origin/main',
      fetch: false,
    });

    expect(result.branches).toHaveLength(0);
    expect(result.hotspots).toHaveLength(0);
  });

  it('hotspot 정렬 — 브랜치 수 내림차순, 같으면 path 알파벳순', { timeout: 30000 }, async () => {
    // fixture: 3개 파일이 서로 다른 수의 브랜치에서 변경됨
    const root = await mkdtemp(join(tmpdir(), 'git-hotspot-sort-'));
    tempDirs.push(root);

    const remoteDir = join(root, 'remote.git');
    const workDir = join(root, 'work');

    git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
    configId(workDir);

    // seed — 4개 파일
    await writeRepoFile(workDir, 'src/a.ts', 'a v1\n');
    await writeRepoFile(workDir, 'src/b.ts', 'b v1\n');
    await writeRepoFile(workDir, 'src/c.ts', 'c v1\n');
    await writeRepoFile(workDir, 'src/d.ts', 'd v1\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'chore: seed']);
    git(workDir, ['push', 'origin', 'main']);

    // branch-1: a, b, c 변경
    git(workDir, ['checkout', '-b', 'feature/one', 'origin/main']);
    await writeRepoFile(workDir, 'src/a.ts', 'a one\n');
    await writeRepoFile(workDir, 'src/b.ts', 'b one\n');
    await writeRepoFile(workDir, 'src/c.ts', 'c one\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat: one']);
    git(workDir, ['push', '-u', 'origin', 'feature/one']);

    // branch-2: a, b 변경
    git(workDir, ['checkout', 'main']);
    git(workDir, ['checkout', '-b', 'feature/two', 'origin/main']);
    await writeRepoFile(workDir, 'src/a.ts', 'a two\n');
    await writeRepoFile(workDir, 'src/b.ts', 'b two\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat: two']);
    git(workDir, ['push', '-u', 'origin', 'feature/two']);

    // current(local): a, c, d 변경
    git(workDir, ['checkout', 'main']);
    git(workDir, ['checkout', '-b', 'feature/local', 'origin/main']);
    await writeRepoFile(workDir, 'src/a.ts', 'a local\n');
    await writeRepoFile(workDir, 'src/c.ts', 'c local\n');
    await writeRepoFile(workDir, 'src/d.ts', 'd local\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat: local']);

    // 결과:
    //   a.ts — local + one + two = 3 브랜치
    //   b.ts — one + two = 2 브랜치
    //   c.ts — local + one = 2 브랜치
    //   d.ts — local만 = 1 브랜치 (hotspot 아님)
    const result = await analyzeRemoteBranchConflicts({
      cwd: workDir,
      remoteName: 'origin',
      baseRef: 'origin/main',
      fetch: false,
    });

    // hotspot이 3건 (d.ts는 1 브랜치이므로 제외)
    expect(result.hotspots.length).toBeGreaterThanOrEqual(2);

    // 정렬 검증: 첫 번째는 a.ts (3 브랜치), 그 다음 b.ts/c.ts (2 브랜치, 알파벳순)
    const paths = result.hotspots.map((h) => h.path);
    expect(paths[0]).toBe('src/a.ts'); // 3 브랜치 — 최다

    // b.ts와 c.ts는 같은 2 브랜치 → 알파벳순
    const twoWay = result.hotspots.filter((h) => h.branches.length === 2);
    if (twoWay.length >= 2) {
      expect(twoWay[0].path.localeCompare(twoWay[1].path)).toBeLessThanOrEqual(0);
    }

    // 각 hotspot의 branches도 알파벳순 정렬
    for (const h of result.hotspots) {
      const sorted = [...h.branches].toSorted();
      expect(h.branches).toEqual(sorted);
    }
  });

  it('base ref fallback — main이 기본 브랜치면 자동 해소', { timeout: 30000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'git-baseref-'));
    tempDirs.push(root);

    const remoteDir = join(root, 'remote.git');
    const workDir = join(root, 'work');

    git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
    configId(workDir);

    await writeRepoFile(workDir, 'src/app.ts', 'app v1\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'chore: seed']);
    git(workDir, ['push', 'origin', 'main']);

    git(workDir, ['checkout', '-b', 'feature/test', 'origin/main']);
    await writeRepoFile(workDir, 'src/app.ts', 'app feature\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat: test']);

    // baseRef를 지정하지 않음 → fallback 체인으로 자동 해소
    const result = await analyzeRemoteBranchConflicts({
      cwd: workDir,
      remoteName: 'origin',
      // baseRef 생략
      fetch: false,
    });

    // fallback으로 origin/main이 선택되어야 함
    expect(result.baseRef).toContain('main');
    // 현재 브랜치의 변경이 감지되어야 함
    expect(result.current.files.length).toBeGreaterThan(0);
  });

  it('worktree overlap — linked worktree의 변경이 hotspot에 포함', { timeout: 30000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'git-worktree-'));
    tempDirs.push(root);

    const remoteDir = join(root, 'remote.git');
    const workDir = join(root, 'work');
    const worktreeDir = join(root, 'wt');

    git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
    configId(workDir);

    await writeRepoFile(workDir, 'src/shared.ts', 'shared v1\n');
    await writeRepoFile(workDir, 'src/only-main.ts', 'main v1\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'chore: seed']);
    git(workDir, ['push', 'origin', 'main']);

    // remote branch for overlap
    git(workDir, ['checkout', '-b', 'feature/remote-a', 'origin/main']);
    await writeRepoFile(workDir, 'src/shared.ts', 'shared remote-a\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat: remote-a']);
    git(workDir, ['push', '-u', 'origin', 'feature/remote-a']);

    // 메인으로 복귀 후 worktree 생성
    git(workDir, ['checkout', 'main']);
    git(workDir, ['worktree', 'add', '-b', 'feature/wt', worktreeDir, 'origin/main']);
    configId(worktreeDir);

    // worktree에서 shared.ts 변경
    await writeRepoFile(worktreeDir, 'src/shared.ts', 'shared worktree\n');
    git(worktreeDir, ['add', '.']);
    git(worktreeDir, ['commit', '-m', 'feat: worktree change']);

    // main worktree에서 현재 브랜치에서 shared.ts 변경
    git(workDir, ['checkout', '-b', 'feature/current', 'origin/main']);
    await writeRepoFile(workDir, 'src/shared.ts', 'shared current\n');
    git(workDir, ['add', '.']);
    git(workDir, ['commit', '-m', 'feat: current']);

    const result = await analyzeRemoteBranchConflicts({
      cwd: workDir,
      remoteName: 'origin',
      baseRef: 'origin/main',
      fetch: false,
      includeWorktrees: true,
    });

    // worktree 분석이 포함되어야 함
    expect(result.worktrees.length).toBeGreaterThanOrEqual(1);

    // shared.ts가 current + remote-a + worktree에서 변경 → hotspot
    const sharedHotspot = result.hotspots.find((h) => h.path === 'src/shared.ts');
    expect(sharedHotspot).toBeDefined();
    expect(sharedHotspot!.branches.length).toBeGreaterThanOrEqual(2);
  });
});
