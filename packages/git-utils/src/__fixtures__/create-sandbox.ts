// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 테스트 샌드박스 팩토리 — 실제 프로젝트 구조를 복제하여 격리된 git repo 생성.
 *
 * 기존 패턴: 빈 repo → 수동 파일 생성 → 30줄+ boilerplate
 * 새 패턴: 템플릿 구조 정의 → createSandbox() → 즉시 사용 가능한 repo
 */

import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, readdir, copyFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';

// ── 타입 ──────────────────────────────────────────────

export interface SandboxOptions {
  /** 샌드박스 이름 (temp dir prefix) */
  name: string;
  /** remote bare repo도 생성할지 */
  withRemote?: boolean;
  /** initial branch 이름 */
  branch?: string;
  /** 초기 파일 구조 */
  files: Record<string, string>;
  /** .gitignore 내용 */
  gitignore?: string;
}

export interface Sandbox {
  /** 작업 디렉토리 (git repo root) */
  workDir: string;
  /** remote bare repo 경로 (withRemote=true일 때) */
  remoteDir: string | null;
  /** 루트 임시 디렉토리 */
  root: string;
  /** 파일 쓰기 + git add + commit */
  commitFile: (path: string, content: string, message: string) => void;
  /** 파일 쓰기 (commit 없이) */
  writeFile: (path: string, content: string) => Promise<void>;
  /** 브랜치 생성 + checkout */
  createBranch: (name: string, base?: string) => void;
  /** push (remote가 있을 때) */
  push: (branch?: string) => void;
  /** checkout */
  checkout: (ref: string) => void;
  /** git 명령 실행 */
  git: (args: string[]) => string;
  /** 정리 */
  cleanup: () => Promise<void>;
}

// ── 팩토리 ────────────────────────────────────────────

const GIT_ENV = {
  GIT_AUTHOR_DATE: '2026-04-05T00:00:00Z',
  GIT_COMMITTER_DATE: '2026-04-05T00:00:00Z',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 't@t.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 't@t.com',
};

export async function createSandbox(options: SandboxOptions): Promise<Sandbox> {
  const branch = options.branch ?? 'main';
  const root = await mkdtemp(join(tmpdir(), `qa-sandbox-${options.name}-`));

  const git = (cwd: string, args: string[]): string =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, ...GIT_ENV },
    }).trim();

  let remoteDir: string | null = null;
  let workDir: string;

  if (options.withRemote) {
    remoteDir = join(root, 'remote.git');
    workDir = join(root, 'work');
    git(root, ['init', '--bare', `--initial-branch=${branch}`, remoteDir]);
    git(root, ['clone', remoteDir, workDir]);
  } else {
    workDir = join(root, 'repo');
    git(root, ['init', `--initial-branch=${branch}`, workDir]);
  }

  git(workDir, ['config', 'user.name', 'Test']);
  git(workDir, ['config', 'user.email', 't@t.com']);

  // .gitignore
  if (options.gitignore) {
    await writeFileWithDir(join(workDir, '.gitignore'), options.gitignore);
  }

  // 초기 파일 생성
  for (const [path, content] of Object.entries(options.files)) {
    await writeFileWithDir(join(workDir, path), content);
  }

  git(workDir, ['add', '.']);
  git(workDir, ['commit', '-m', 'chore: seed']);

  if (remoteDir) {
    git(workDir, ['push', 'origin', branch]);
  }

  // ── Sandbox API ───────────────────────────────────

  const sandbox: Sandbox = {
    workDir,
    remoteDir,
    root,

    commitFile(path: string, content: string, message: string) {
      execFileSync(
        'bash',
        ['-c', `mkdir -p "$(dirname "${join(workDir, path)}")" && cat > "${join(workDir, path)}"`],
        {
          input: content,
          cwd: workDir,
          env: { ...process.env, ...GIT_ENV },
        },
      );
      git(workDir, ['add', path]);
      git(workDir, ['commit', '-m', message]);
    },

    async writeFile(path: string, content: string) {
      await writeFileWithDir(join(workDir, path), content);
    },

    createBranch(name: string, base?: string) {
      const baseRef = base ?? (remoteDir ? `origin/${branch}` : branch);
      git(workDir, ['checkout', '-b', name, baseRef]);
    },

    push(branchName?: string) {
      if (!remoteDir) throw new Error('withRemote=false — push 불가');
      const args = branchName ? ['push', '-u', 'origin', branchName] : ['push'];
      git(workDir, args);
    },

    checkout(ref: string) {
      git(workDir, ['checkout', ref]);
    },

    git(args: string[]) {
      return git(workDir, args);
    },

    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };

  return sandbox;
}

// ── 프리셋 ────────────────────────────────────────────

/** 모노레포 최소 구조 */
export const MONOREPO_FILES: Record<string, string> = {
  'package.json': '{ "name": "test-monorepo", "private": true }\n',
  'tsconfig.json': '{ "compilerOptions": { "target": "ES2023" } }\n',
  '.gitignore': 'node_modules/\ndist/\n*.tsbuildinfo\n',
  'packages/api/src/index.ts': 'export function hello() { return "hello"; }\n',
  'packages/api/src/handler.ts': 'export function handle(req: any) { return req; }\n',
  'packages/api/package.json': '{ "name": "@test/api" }\n',
  'packages/web/src/app.ts': 'export function App() { return "app"; }\n',
  'packages/web/package.json': '{ "name": "@test/web" }\n',
  'docs/README.md': '# Test Monorepo\n',
};

/** 단일 패키지 구조 */
export const SINGLE_PKG_FILES: Record<string, string> = {
  'package.json': '{ "name": "test-pkg" }\n',
  'tsconfig.json': '{ "compilerOptions": { "target": "ES2023" } }\n',
  '.gitignore': 'node_modules/\ndist/\n',
  'src/index.ts': 'export const VERSION = "1.0.0";\n',
  'src/utils.ts': 'export function add(a: number, b: number) { return a + b; }\n',
};

// ── 헬퍼 ──────────────────────────────────────────────

async function writeFileWithDir(fullPath: string, content: string): Promise<void> {
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf-8');
}
