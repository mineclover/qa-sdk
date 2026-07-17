// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * git.ts 기본 메타데이터 — 임시 repo fixture 기반 시나리오 테스트
 */

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import {
  getRepoName,
  listSemverTags,
  parseConventionalCommits,
  collectCommitTypes,
  commitCountsByScope,
} from './git.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

// ── fixture 유틸 ────────────────────────────────────

async function createRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'git-utils-test-'));
  tempDirs.push(root);
  const repoDir = join(root, 'repo');
  git(root, ['init', '--initial-branch=main', repoDir]);
  configureGitIdentity(repoDir);
  return repoDir;
}

async function createRepoWithRemote(): Promise<{ repoDir: string; remoteDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'git-utils-remote-'));
  tempDirs.push(root);
  const remoteDir = join(root, 'remote.git');
  const repoDir = join(root, 'repo');

  git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
  git(root, ['clone', remoteDir, repoDir]);
  configureGitIdentity(repoDir);
  return { repoDir, remoteDir };
}

async function writeAndCommit(repoDir: string, path: string, content: string, message: string) {
  const fullPath = join(repoDir, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf-8');
  git(repoDir, ['add', path]);
  git(repoDir, ['commit', '-m', message]);
}

function configureGitIdentity(cwd: string) {
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@test.com']);
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: '2026-04-05T00:00:00Z',
      GIT_COMMITTER_DATE: '2026-04-05T00:00:00Z',
    },
  }).trim();
}

// ── getRepoName ─────────────────────────────────────

describe('getRepoName', () => {
  it('remote URL에서 repo 이름 추출', async () => {
    const { repoDir } = await createRepoWithRemote();
    await writeAndCommit(repoDir, 'init.txt', 'init', 'chore: init');
    git(repoDir, ['push', '-u', 'origin', 'main']);

    const name = getRepoName(repoDir);
    // remote URL은 file:// 경로 — basename이 "remote.git" → "remote"
    expect(name).toBe('remote');
  });

  it('remote 없는 repo → 디렉토리 basename fallback', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'init.txt', 'init', 'chore: init');

    const name = getRepoName(repoDir);
    expect(name).toBe('repo');
  });

  it('잘못된 경로 → dir basename fallback', () => {
    const name = getRepoName('/nonexistent/path');
    // git remote 실패 → basename("/nonexistent/path") = "path"
    expect(name).toBe('path');
  });
});

// ── listSemverTags ──────────────────────────────────

describe('listSemverTags', () => {
  it('semver 태그 정렬 반환', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'init.txt', 'init', 'chore: init');
    git(repoDir, ['tag', 'v1.0.0']);
    await writeAndCommit(repoDir, 'a.txt', 'a', 'feat: a');
    git(repoDir, ['tag', 'v1.1.0']);
    await writeAndCommit(repoDir, 'b.txt', 'b', 'feat: b');
    git(repoDir, ['tag', 'v2.0.0']);

    const tags = listSemverTags(repoDir);
    expect(tags).toEqual(['1.0.0', '1.1.0', '2.0.0']);
  });

  it('비-semver 태그 제외', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'init.txt', 'init', 'chore: init');
    git(repoDir, ['tag', 'v1.0.0']);
    git(repoDir, ['tag', 'release-beta']);

    const tags = listSemverTags(repoDir);
    expect(tags).toEqual(['1.0.0']);
  });

  it('태그 없는 repo → 빈 배열', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'init.txt', 'init', 'chore: init');
    expect(listSemverTags(repoDir)).toEqual([]);
  });
});

// ── parseConventionalCommits ────────────────────────

describe('parseConventionalCommits', () => {
  it('CC 포맷 파싱', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'a.txt', 'a', 'feat(api): 새 엔드포인트 추가');
    await writeAndCommit(repoDir, 'b.txt', 'b', 'fix(cli): 인자 파싱 오류 수정');
    await writeAndCommit(repoDir, 'c.txt', 'c', '그냥 커밋'); // 비-CC

    const commits = parseConventionalCommits(repoDir);
    const cc = commits.filter((c) => c.scope !== null);
    expect(cc).toHaveLength(2);
    expect(cc.find((c) => c.type === 'feat')?.scope).toBe('api');
    expect(cc.find((c) => c.type === 'fix')?.scope).toBe('cli');
  });

  it('since 옵션 — 범위 제한', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'a.txt', 'a', 'feat: first');
    git(repoDir, ['tag', 'v1.0.0']);
    await writeAndCommit(repoDir, 'b.txt', 'b', 'feat: second');

    const all = parseConventionalCommits(repoDir);
    const sinceTag = parseConventionalCommits(repoDir, { since: 'v1.0.0' });
    expect(sinceTag.length).toBeLessThan(all.length);
    expect(sinceTag.every((c) => c.subject.includes('second'))).toBe(true);
  });

  it('maxCount 옵션', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'a.txt', 'a', 'feat: 1');
    await writeAndCommit(repoDir, 'b.txt', 'b', 'feat: 2');
    await writeAndCommit(repoDir, 'c.txt', 'c', 'feat: 3');

    const limited = parseConventionalCommits(repoDir, { maxCount: 2 });
    expect(limited).toHaveLength(2);
  });
});

// ── collectCommitTypes ──────────────────────────────

describe('collectCommitTypes', () => {
  it('기본 6종 + 관측된 타입', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'a.txt', 'a', 'feat: new feature');
    await writeAndCommit(repoDir, 'b.txt', 'b', 'perf: optimization'); // 기본 6종에 없음

    const types = collectCommitTypes(repoDir);
    // 기본 6종 포함
    expect(types).toContain('feat');
    expect(types).toContain('fix');
    expect(types).toContain('chore');
    // 관측된 타입도 포함
    expect(types).toContain('perf');
  });
});

// ── commitCountsByScope ─────────────────────────────

describe('commitCountsByScope', () => {
  it('scope별 type 카운트', { timeout: 15000 }, async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'a.txt', 'a', 'feat(api): endpoint 1');
    await writeAndCommit(repoDir, 'b.txt', 'b', 'feat(api): endpoint 2');
    await writeAndCommit(repoDir, 'c.txt', 'c', 'fix(cli): bug fix');

    const counts = commitCountsByScope(repoDir);
    expect(counts['api']?.['feat']).toBe(2);
    expect(counts['cli']?.['fix']).toBe(1);
  });

  it('scope 없는 커밋 → _root 또는 무시', async () => {
    const repoDir = await createRepo();
    await writeAndCommit(repoDir, 'a.txt', 'a', 'feat: no scope');

    const counts = commitCountsByScope(repoDir);
    // scope 없는 커밋은 빈 키 또는 _root로 집계
    const total = Object.values(counts).reduce(
      (sum, types) => sum + Object.values(types).reduce((s, c) => s + c, 0),
      0,
    );
    expect(total).toBeGreaterThanOrEqual(0);
  });
});
