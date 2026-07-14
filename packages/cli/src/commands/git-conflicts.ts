// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  analyzeRemoteBranchConflicts,
  type BranchChangeFile,
  type GitConflictReport,
  type RemoteBranchConflictAnalysis,
  type WorkspaceChangeSet,
} from 'git-utils';

export interface GitConflictsOptions {
  root: string;
  executionCwd?: string;
  remote?: string;
  base?: string;
  current?: string;
  json?: boolean;
  limit?: number;
  maxCommitHistory?: number;
  skipFetch?: boolean;
  skipWorktrees?: boolean;
  output?: string;
  watch?: boolean;
  intervalMs?: number;
}

export async function gitConflicts(options: GitConflictsOptions): Promise<GitConflictReport> {
  const report = await buildGitConflictReport(options);
  await persistGitConflictReport(report, options.output);
  printGitConflictReport(report, options);
  return report;
}

export async function watchGitConflicts(options: GitConflictsOptions): Promise<void> {
  const intervalMs = Math.max(options.intervalMs ?? 5000, 500);
  let stopped = false;
  const stop = () => {
    stopped = true;
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  let iteration = 0;

  try {
    while (!stopped) {
      iteration += 1;
      const startedAt = new Date();

      try {
        const report = await buildGitConflictReport(options);
        await persistGitConflictReport(report, options.output);
        printWatchSummary(report, options, iteration, startedAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[git conflicts watch] ${startedAt.toISOString()} 실패: ${message}`);
      }

      if (stopped) break;
      await sleep(intervalMs);
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

export async function buildGitConflictReport(
  options: GitConflictsOptions,
): Promise<GitConflictReport> {
  const root = resolve(options.root);
  const analysis = await analyzeRemoteBranchConflicts({
    cwd: root,
    executionCwd: options.executionCwd,
    remoteName: options.remote,
    baseRef: options.base,
    currentRef: options.current,
    maxCommitHistory: options.maxCommitHistory,
    fetch: options.skipFetch ? false : true,
    includeWorktrees: options.skipWorktrees ? false : true,
  });
  const comparedTargets = [...analysis.branches, ...analysis.worktrees];
  const workspaceScopes = await listWorkspaceScopes(root);
  const currentScopes = uniqueSorted(analysis.current.paths.map((path) => scopeFromPath(path)));
  const occupiedScopes = uniqueSorted(
    comparedTargets.flatMap((branch) => branch.paths.map((path) => scopeFromPath(path))),
  );
  const overlapScopes = uniqueSorted(
    comparedTargets.flatMap((branch) => branch.overlappingPaths.map((path) => scopeFromPath(path))),
  );
  const occupiedScopeSet = new Set(occupiedScopes);
  const safeScopes = workspaceScopes.filter((scope) => !occupiedScopeSet.has(scope));

  return {
    schemaVersion: 'git-conflicts-report/v1',
    generatedAt: new Date().toISOString(),
    analysis,
    workspaceScopes,
    currentScopes,
    occupiedScopes,
    overlapScopes,
    safeScopes,
  };
}

async function listWorkspaceScopes(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const scopes: string[] = ['(root)'];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    if (entry.name === 'packages') {
      const packageEntries = await readdir(join(root, 'packages'), {
        withFileTypes: true,
      });
      for (const packageEntry of packageEntries) {
        if (!packageEntry.isDirectory()) continue;
        if (packageEntry.name.startsWith('.')) continue;
        scopes.push(`packages/${packageEntry.name}`);
      }
      continue;
    }

    scopes.push(entry.name);
  }

  return uniqueSorted(scopes);
}

function scopeFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '(root)';
  if (segments.length === 1) return '(root)';

  if (segments[0] === 'packages' && segments[1]) {
    return `packages/${segments[1]}`;
  }

  return segments[0]!;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
}

function printGitConflictReport(report: GitConflictReport, options: GitConflictsOptions): void {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const limit = Math.max(options.limit ?? 10, 1);
  const overlappingBranches = report.analysis.branches.filter(
    (branch) => branch.overlappingPaths.length > 0,
  );
  const overlappingWorktrees = report.analysis.worktrees.filter(
    (worktree) => worktree.overlappingPaths.length > 0,
  );

  console.log('Git 충돌 분석');
  console.log(`  repo: ${report.analysis.repoPath}`);
  console.log(
    `  remote: ${report.analysis.remoteName} (${report.analysis.fetched ? 'fetched' : 'cached'})`,
  );
  console.log(`  base: ${report.analysis.baseRef} (${shortOid(report.analysis.baseHeadOid)})`);
  console.log(
    `  current: ${report.analysis.current.branchName} (${shortOid(report.analysis.current.headOid)})`,
  );

  console.log('');
  console.log(`현재 브랜치 변경: ${report.analysis.current.files.length}개 파일`);
  if (report.currentScopes.length > 0) {
    console.log(`  scope: ${report.currentScopes.join(', ')}`);
  }
  printChangeList(report.analysis.current.files, limit, {
    emptyMessage: '  branch-only 변경 없음',
    comparePrefix: null,
  });

  printWorkspaceSummary('Repo 작업중 변경', report.analysis.repoWorkspace, limit);
  printWorkspaceSummary('실행 위치 변경', report.analysis.workspace, limit);

  console.log('');
  console.log(`잠재 충돌 브랜치: ${overlappingBranches.length}/${report.analysis.branches.length}`);
  if (overlappingBranches.length === 0) {
    console.log('  중첩 변경 없음');
  } else {
    for (const branch of overlappingBranches.slice(0, limit)) {
      console.log(
        `  ${branch.branchName} overlap=${branch.overlappingPaths.length} files=${branch.files.length}`,
      );
      printOverlapList(branch.overlappingFiles, limit, 'remote');
    }
    if (overlappingBranches.length > limit) {
      console.log(`  ... ${overlappingBranches.length - limit}개 브랜치 생략`);
    }
  }

  console.log('');
  console.log(
    `잠재 충돌 worktree: ${overlappingWorktrees.length}/${report.analysis.worktrees.length}`,
  );
  if (overlappingWorktrees.length === 0) {
    console.log('  중첩 변경 없음');
  } else {
    for (const worktree of overlappingWorktrees.slice(0, limit)) {
      console.log(
        `  ${worktree.displayName} overlap=${worktree.overlappingPaths.length} files=${worktree.files.length}`,
      );
      console.log(`    path: ${worktree.worktreePath}`);
      printOverlapList(worktree.overlappingFiles, limit, 'worktree');
    }
    if (overlappingWorktrees.length > limit) {
      console.log(`  ... ${overlappingWorktrees.length - limit}개 worktree 생략`);
    }
  }

  console.log('');
  console.log(`전체 hotspot: ${report.analysis.hotspots.length}`);
  if (report.analysis.hotspots.length === 0) {
    console.log('  공유 수정 지점 없음');
  } else {
    for (const hotspot of report.analysis.hotspots.slice(0, limit)) {
      console.log(`  ${hotspot.path} <= ${hotspot.branches.join(', ')}`);
    }
    if (report.analysis.hotspots.length > limit) {
      console.log(`  ... ${report.analysis.hotspots.length - limit}개 hotspot 생략`);
    }
  }

  console.log('');
  console.log(`작업 가능 scope: ${report.safeScopes.length}`);
  if (report.safeScopes.length === 0) {
    console.log('  사용 가능한 scope 없음');
  } else {
    for (const scope of report.safeScopes.slice(0, limit)) {
      console.log(`  ${scope}`);
    }
    if (report.safeScopes.length > limit) {
      console.log(`  ... ${report.safeScopes.length - limit}개 scope 생략`);
    }
  }
}

function printWatchSummary(
  report: GitConflictReport,
  options: GitConflictsOptions,
  iteration: number,
  startedAt: Date,
): void {
  const overlappingBranches = report.analysis.branches.filter(
    (branch) => branch.overlappingPaths.length > 0,
  ).length;
  const overlappingWorktrees = report.analysis.worktrees.filter(
    (worktree) => worktree.overlappingPaths.length > 0,
  ).length;

  console.log(`[git conflicts watch #${iteration}] ${startedAt.toISOString()}`);
  console.log(`  current files: ${report.analysis.current.files.length}`);
  console.log(`  repo workspace: ${report.analysis.repoWorkspace?.files.length ?? 0}`);
  console.log(`  execution workspace: ${report.analysis.workspace?.files.length ?? 0}`);
  console.log(`  branch overlaps: ${overlappingBranches}/${report.analysis.branches.length}`);
  console.log(`  worktree overlaps: ${overlappingWorktrees}/${report.analysis.worktrees.length}`);
  console.log(`  hotspots: ${report.analysis.hotspots.length}`);
  console.log(`  safe scopes: ${report.safeScopes.length}`);
  if (options.output) {
    console.log(`  output: ${resolve(options.output)}`);
  }
  if (options.json && !options.output) {
    console.log(
      '  note: watch 모드에서는 stdout에 요약만 출력합니다. 전체 JSON은 --output 사용을 권장합니다.',
    );
  }
}

function printWorkspaceSummary(
  title: string,
  workspace: WorkspaceChangeSet | null,
  limit: number,
): void {
  console.log('');
  if (!workspace) {
    console.log(`${title}: 범위 밖`);
    return;
  }

  console.log(`${title}: ${workspace.files.length}개 파일`);
  console.log(`  path: ${workspace.relativePath}`);
  console.log(
    `  diff: files=${workspace.diffStats.filesChanged} +${workspace.diffStats.insertions} -${workspace.diffStats.deletions}`,
  );
  printChangeList(workspace.files, limit, {
    emptyMessage: '  변경 없음',
    comparePrefix: null,
  });
}

async function persistGitConflictReport(report: GitConflictReport, output?: string): Promise<void> {
  if (!output) return;

  const outputPath = resolve(output);
  const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(tempPath, JSON.stringify(report, null, 2), 'utf-8');
  await rename(tempPath, outputPath);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function printChangeList(
  files: readonly BranchChangeFile[],
  limit: number,
  options: {
    emptyMessage: string;
    comparePrefix: string | null;
  },
): void {
  if (files.length === 0) {
    console.log(options.emptyMessage);
    return;
  }

  for (const file of files.slice(0, limit)) {
    const renameSuffix = file.previousPath ? ` <= ${file.previousPath}` : '';
    const binarySuffix = file.binary ? ' [binary]' : '';
    const comparePrefix = options.comparePrefix ? `${options.comparePrefix} ` : '  ';
    console.log(`${comparePrefix}${file.path} [${file.status}]${renameSuffix}${binarySuffix}`);
  }
  if (files.length > limit) {
    console.log(`  ... ${files.length - limit}개 파일 생략`);
  }
}

function printOverlapList(
  files: readonly {
    path: string;
    currentStatus: string;
    comparedStatus: string;
  }[],
  limit: number,
  targetLabel: string,
): void {
  if (files.length === 0) {
    console.log('    중첩 파일 없음');
    return;
  }

  for (const file of files.slice(0, limit)) {
    console.log(
      `    ${file.path} [current:${file.currentStatus}, ${targetLabel}:${file.comparedStatus}]`,
    );
  }
  if (files.length > limit) {
    console.log(`    ... ${files.length - limit}개 파일 생략`);
  }
}

function shortOid(oid: string): string {
  return oid.slice(0, 7);
}
