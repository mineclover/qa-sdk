/**
 * 분기 충돌 분석 + worktree + 순수 파서 — 임시 repo 시나리오 테스트
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, it, expect } from "vitest";
import { parseGitWorktreeList } from "./branch-conflicts-worktrees.js";
import { listGitWorktrees } from "./branch-conflicts-worktrees.js";
import { collectWorkspaceChanges } from "./branch-conflicts-workspace.js";
import { analyzeRemoteBranchConflicts } from "./branch-conflicts-analysis.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(d => rm(d, { recursive: true, force: true })));
});

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd, encoding: "utf-8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-04-05T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-04-05T00:00:00Z",
      GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "t@t.com",
      GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "t@t.com",
    },
  }).trim();
}

async function writeRepoFile(root: string, path: string, content: string) {
  const full = join(root, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf-8");
}

function configId(cwd: string) {
  git(cwd, ["config", "user.name", "Test"]);
  git(cwd, ["config", "user.email", "t@t.com"]);
}

// ── parseGitWorktreeList (순수 파서) ─────────────────

describe("parseGitWorktreeList", () => {
  it("porcelain 포맷 파싱 — branch + bare + detached", () => {
    const output = [
      "worktree /repo",
      "HEAD abc1234567890123456789012345678901234567",
      "branch refs/heads/main",
      "",
      "worktree /repo-wt",
      "HEAD def1234567890123456789012345678901234567",
      "branch refs/heads/feature",
      "",
      "worktree /bare",
      "HEAD 0001234567890123456789012345678901234567",
      "bare",
      "",
    ].join("\n");

    const wts = parseGitWorktreeList(output);
    expect(wts).toHaveLength(3);
    expect(wts[0].branchRef).toBe("refs/heads/main");
    expect(wts[0].isBare).toBe(false);
    expect(wts[1].branchRef).toBe("refs/heads/feature");
    expect(wts[2].isBare).toBe(true);
    expect(wts[2].branchRef).toBeNull();
  });

  it("빈 출력 → 빈 배열", () => {
    expect(parseGitWorktreeList("")).toHaveLength(0);
  });

  it("detached HEAD", () => {
    const output = [
      "worktree /detached",
      "HEAD abc1234567890123456789012345678901234567",
      "detached",
      "",
    ].join("\n");
    const wts = parseGitWorktreeList(output);
    expect(wts[0].isDetached).toBe(true);
    expect(wts[0].branchRef).toBeNull();
  });
});

// ── listGitWorktrees (fail-silent) ──────────────────

describe("listGitWorktrees", () => {
  it("잘못된 경로 → 빈 배열 (fail-silent)", () => {
    const result = listGitWorktrees("/nonexistent/path");
    expect(result).toEqual([]);
  });
});

// ── 분기 충돌 분석 시나리오 ─────────────────────────

describe("analyzeRemoteBranchConflicts", () => {
  async function createConflictFixture() {
    const root = await mkdtemp(join(tmpdir(), "git-conflicts-"));
    tempDirs.push(root);

    const remoteDir = join(root, "remote.git");
    const workDir = join(root, "work");

    git(root, ["init", "--bare", "--initial-branch=main", remoteDir]);
    git(root, ["clone", remoteDir, workDir]);
    configId(workDir);

    // seed
    await writeRepoFile(workDir, "src/api.ts", "api v1\n");
    await writeRepoFile(workDir, "src/cli.ts", "cli v1\n");
    await writeRepoFile(workDir, "docs/readme.md", "readme v1\n");
    git(workDir, ["add", "."]);
    git(workDir, ["commit", "-m", "chore: seed"]);
    git(workDir, ["push", "origin", "main"]);

    // feature/alpha — api 변경
    git(workDir, ["checkout", "-b", "feature/alpha", "origin/main"]);
    await writeRepoFile(workDir, "src/api.ts", "api alpha\n");
    git(workDir, ["add", "src/api.ts"]);
    git(workDir, ["commit", "-m", "feat(api): alpha"]);
    git(workDir, ["push", "-u", "origin", "feature/alpha"]);

    // feature/beta — api + docs 변경
    git(workDir, ["checkout", "main"]);
    git(workDir, ["checkout", "-b", "feature/beta", "origin/main"]);
    await writeRepoFile(workDir, "src/api.ts", "api beta\n");
    await writeRepoFile(workDir, "docs/readme.md", "readme beta\n");
    git(workDir, ["add", "."]);
    git(workDir, ["commit", "-m", "feat(api): beta"]);
    git(workDir, ["push", "-u", "origin", "feature/beta"]);

    // 로컬 feature/local — api + cli 변경
    git(workDir, ["checkout", "main"]);
    git(workDir, ["checkout", "-b", "feature/local", "origin/main"]);
    await writeRepoFile(workDir, "src/api.ts", "api local\n");
    await writeRepoFile(workDir, "src/cli.ts", "cli local\n");
    git(workDir, ["add", "."]);
    git(workDir, ["commit", "-m", "feat(cli): local"]);

    return workDir;
  }

  it("기본 시나리오 — overlap 탐지 + hotspot", { timeout: 30000 }, async () => {
    const cwd = await createConflictFixture();

    const result = await analyzeRemoteBranchConflicts({
      cwd,
      remoteName: "origin",
      baseRef: "origin/main",
      fetch: false,
    });

    expect(result.baseRef).toBe("origin/main");
    expect(result.current.branchName).toBe("feature/local");
    expect(result.current.paths).toContain("src/api.ts");
    expect(result.current.paths).toContain("src/cli.ts");

    // alpha: api overlap
    const alpha = result.branches.find(b => b.branchName.includes("alpha"));
    expect(alpha).toBeDefined();
    expect(alpha!.overlappingPaths).toContain("src/api.ts");

    // beta: api overlap
    const beta = result.branches.find(b => b.branchName.includes("beta"));
    expect(beta).toBeDefined();
    expect(beta!.overlappingPaths).toContain("src/api.ts");

    // hotspot: src/api.ts가 3개 브랜치
    const apiHotspot = result.hotspots.find(h => h.path === "src/api.ts");
    expect(apiHotspot).toBeDefined();
    expect(apiHotspot!.branches.length).toBeGreaterThanOrEqual(2);
  });

  it("workspace 변경 감지", { timeout: 30000 }, async () => {
    const cwd = await createConflictFixture();

    // uncommitted 변경 추가
    await writeRepoFile(cwd, "src/live.ts", "live change\n");

    const result = await analyzeRemoteBranchConflicts({
      cwd,
      executionCwd: cwd,
      remoteName: "origin",
      baseRef: "origin/main",
      fetch: false,
    });

    // repoWorkspace에서 untracked 파일 확인
    expect(result.repoWorkspace).toBeDefined();
    expect(result.repoWorkspace!.paths).toContain("src/live.ts");
  });
});

// ── 에러 시나리오 ───────────────────────────────────

describe("에러 시나리오", () => {
  it("빈 repo (커밋 없음) → 분석 가능 (빈 결과)", async () => {
    const root = await mkdtemp(join(tmpdir(), "git-empty-"));
    tempDirs.push(root);
    const remoteDir = join(root, "remote.git");
    const workDir = join(root, "work");

    git(root, ["init", "--bare", "--initial-branch=main", remoteDir]);
    git(root, ["clone", remoteDir, workDir]);
    configId(workDir);

    // 최소 1 커밋 (git에서 main ref가 없으면 merge-base 불가)
    await writeRepoFile(workDir, "init.txt", "init\n");
    git(workDir, ["add", "."]);
    git(workDir, ["commit", "-m", "chore: init"]);
    git(workDir, ["push", "origin", "main"]);

    const result = await analyzeRemoteBranchConflicts({
      cwd: workDir,
      remoteName: "origin",
      baseRef: "origin/main",
      fetch: false,
    });

    expect(result.branches).toHaveLength(0);
    expect(result.hotspots).toHaveLength(0);
  });
});
