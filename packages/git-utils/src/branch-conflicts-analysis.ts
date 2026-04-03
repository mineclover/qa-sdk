import { openRepository, type Repository } from "es-git";
import { collectBranchCommits, collectCommitSummary } from "./branch-conflicts-commits.js";
import { collectChangedFiles } from "./branch-conflicts-diff.js";
import type {
  AnalyzeRemoteBranchConflictsOptions,
  BranchChangeSet,
  ComparedBranchAnalysis,
  ComparedWorktreeAnalysis,
  GitWorktreeDescriptor,
  RemoteBranchConflictAnalysis,
  SharedConflictHotspot,
} from "./branch-conflicts-types.js";
import {
  buildWorktreeDisplayName,
  canonicalPath,
  listGitWorktrees,
  normalizeRefName,
} from "./branch-conflicts-worktrees.js";
import { collectWorkspaceChanges } from "./branch-conflicts-workspace.js";

export async function analyzeRemoteBranchConflicts(
  options: AnalyzeRemoteBranchConflictsOptions,
): Promise<RemoteBranchConflictAnalysis> {
  const repoPath = canonicalPath(options.cwd);
  const repo = await openRepository(repoPath);
  const remoteName = resolveRemoteName(repo, options.remoteName);
  const fetch = options.fetch !== false;
  const includeWorktrees = options.includeWorktrees !== false;
  const maxCommitHistory = Math.max(options.maxCommitHistory ?? 12, 1);
  const executionCwd = canonicalPath(options.executionCwd ?? process.cwd());

  if (fetch) {
    const remote = repo.getRemote(remoteName);
    await remote.fetch([], { fetch: { prune: "On" } });
  }

  const currentRef = options.currentRef ?? "HEAD";
  const currentBranchName = resolveCurrentBranchName(repo, options.currentRef);
  const baseRef = resolveBaseRef(repo, {
    explicitBaseRef: options.baseRef,
    currentBranchName,
    remoteName,
  });

  const baseHeadOid = repo.revparseSingle(baseRef);
  const currentHeadOid = repo.revparseSingle(currentRef);
  const current = buildBranchChangeSet({
    cwd: repoPath,
    repo,
    branchName: currentBranchName ?? currentRef,
    displayName: currentBranchName ?? currentRef,
    ref: currentRef,
    headOid: currentHeadOid,
    baseHeadOid,
    maxCommitHistory,
  });

  const skipCurrentRemoteBranch = options.excludeCurrentRemoteBranch !== false
    && currentBranchName !== null;
  const branches = listRemoteBranchNames(repo, remoteName)
    .filter((branchName) => !skipCurrentRemoteBranch || branchName !== `${remoteName}/${currentBranchName}`)
    .map((branchName) => {
      const branchHeadOid = repo.revparseSingle(branchName);
      const branchChangeSet = buildBranchChangeSet({
        cwd: repoPath,
        repo,
        branchName,
        displayName: branchName,
        ref: branchName,
        headOid: branchHeadOid,
        baseHeadOid,
        maxCommitHistory,
      });

      if (branchChangeSet.files.length === 0) return null;
      return buildComparedBranchAnalysis(current, branchChangeSet);
    })
    .filter((branch): branch is ComparedBranchAnalysis => branch !== null)
    .toSorted(compareComparedBranches);

  const worktrees = includeWorktrees
    ? await collectWorktreeAnalyses({
      cwd: repoPath,
      current,
      baseRef,
      maxCommitHistory,
    })
    : [];

  return {
    repoPath,
    currentWorktreePath: repoPath,
    executionCwd,
    remoteName,
    fetched: fetch,
    baseRef,
    baseHeadOid,
    currentRef,
    currentBranchName,
    currentHeadOid,
    current,
    repoWorkspace: collectWorkspaceChanges(repoPath, repoPath, "repo"),
    workspace: collectWorkspaceChanges(repoPath, executionCwd, "execution"),
    branches,
    worktrees,
    hotspots: buildHotspots([current, ...branches, ...worktrees]),
  };
}

function buildComparedBranchAnalysis(
  current: BranchChangeSet,
  branch: BranchChangeSet,
): ComparedBranchAnalysis {
  const currentByPath = new Map(current.files.map((file) => [file.path, file]));
  const overlappingFiles = branch.files
    .flatMap((file) => {
      const currentFile = currentByPath.get(file.path);
      if (!currentFile) return [];
      return [{
        path: file.path,
        currentStatus: currentFile.status,
        comparedStatus: file.status,
      }];
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
  const overlappingPathSet = new Set(overlappingFiles.map((file) => file.path));

  return {
    ...branch,
    overlappingPaths: [...overlappingPathSet],
    overlappingFiles,
    currentOnlyPaths: current.paths.filter((path) => !overlappingPathSet.has(path)),
    branchOnlyPaths: branch.paths.filter((path) => !currentByPath.has(path)),
  };
}

async function collectWorktreeAnalyses(
  options: {
    cwd: string;
    current: BranchChangeSet;
    baseRef: string;
    maxCommitHistory: number;
  },
): Promise<ComparedWorktreeAnalysis[]> {
  const worktrees = listGitWorktrees(options.cwd)
    .filter((worktree) => !worktree.isBare)
    .filter((worktree) => canonicalPath(worktree.path) !== options.cwd);

  const analyses = await Promise.all(
    worktrees.map(async (worktree) => analyzeWorktree(worktree, options)),
  );

  return analyses
    .filter((analysis): analysis is ComparedWorktreeAnalysis => analysis !== null)
    .toSorted(compareComparedBranches);
}

async function analyzeWorktree(
  worktree: GitWorktreeDescriptor,
  options: {
    current: BranchChangeSet;
    baseRef: string;
    maxCommitHistory: number;
  },
): Promise<ComparedWorktreeAnalysis | null> {
  const repo = await openRepository(worktree.path);
  const branchName = worktree.branchRef
    ? normalizeRefName(worktree.branchRef)
    : `detached:${worktree.headOid.slice(0, 7)}`;
  const changeSet = buildBranchChangeSet({
    cwd: canonicalPath(worktree.path),
    repo,
    branchName,
    displayName: buildWorktreeDisplayName(worktree, branchName),
    ref: worktree.branchRef ?? worktree.headOid,
    headOid: worktree.headOid,
    baseHeadOid: repo.revparseSingle(options.baseRef),
    maxCommitHistory: options.maxCommitHistory,
  });

  if (changeSet.files.length === 0) return null;

  return {
    ...buildComparedBranchAnalysis(options.current, changeSet),
    worktreePath: canonicalPath(worktree.path),
    branchRef: worktree.branchRef,
    isDetached: worktree.isDetached,
  };
}

function buildBranchChangeSet(
  options: {
    cwd: string;
    repo: Repository;
    branchName: string;
    displayName: string;
    ref: string;
    headOid: string;
    baseHeadOid: string;
    maxCommitHistory: number;
  },
): BranchChangeSet {
  const mergeBaseOid = options.headOid === options.baseHeadOid
    ? options.baseHeadOid
    : options.repo.getMergeBase(options.baseHeadOid, options.headOid);
  const { files, diffStats } = collectChangedFiles(options.repo, mergeBaseOid, options.headOid);
  const { commitCount, commits } = collectBranchCommits(
    options.cwd,
    mergeBaseOid,
    options.headOid,
    options.maxCommitHistory,
  );

  return {
    branchName: options.branchName,
    displayName: options.displayName,
    ref: options.ref,
    headOid: options.headOid,
    mergeBaseOid,
    splitPoint: collectCommitSummary(options.cwd, mergeBaseOid),
    diffStats,
    commitCount,
    commits,
    files,
    paths: files.map((file) => file.path),
  };
}

function resolveRemoteName(repo: Repository, preferredRemoteName?: string): string {
  if (preferredRemoteName) return preferredRemoteName;

  const remoteNames = repo.remoteNames();
  if (remoteNames.includes("origin")) return "origin";
  if (remoteNames.length > 0) return remoteNames[0]!;

  throw new Error("원격 저장소가 없어 충돌 분석을 시작할 수 없음");
}

function resolveCurrentBranchName(
  repo: Repository,
  explicitCurrentRef?: string,
): string | null {
  if (explicitCurrentRef && explicitCurrentRef !== "HEAD") {
    return normalizeRefName(explicitCurrentRef);
  }

  try {
    const headName = repo.head().shorthand();
    return headName === "HEAD" ? null : headName;
  } catch {
    return null;
  }
}

function resolveBaseRef(
  repo: Repository,
  options: {
    explicitBaseRef?: string;
    currentBranchName: string | null;
    remoteName: string;
  },
): string {
  if (options.explicitBaseRef) return options.explicitBaseRef;

  if (options.currentBranchName !== null && !options.currentBranchName.includes("/")) {
    const localBranch = repo.findBranch(options.currentBranchName, "Local");
    const upstream = localBranch?.findUpstream();
    if (upstream) return upstream.name();
  }

  try {
    const remoteHeadRef = repo.getReference(`refs/remotes/${options.remoteName}/HEAD`);
    const symbolicTarget = remoteHeadRef.symbolicTarget();
    if (symbolicTarget) return normalizeRefName(symbolicTarget);
    return normalizeRefName(remoteHeadRef.resolve().name());
  } catch {
    // remote HEAD가 없으면 아래 fallback을 사용한다.
  }

  const mainCandidate = `${options.remoteName}/main`;
  if (repo.findBranch(mainCandidate, "Remote")) return mainCandidate;

  const masterCandidate = `${options.remoteName}/master`;
  if (repo.findBranch(masterCandidate, "Remote")) return masterCandidate;

  const firstRemoteBranch = listRemoteBranchNames(repo, options.remoteName)[0];
  if (firstRemoteBranch) return firstRemoteBranch;

  throw new Error(`기준 브랜치를 찾을 수 없음: remote=${options.remoteName}`);
}

function listRemoteBranchNames(
  repo: Repository,
  remoteName: string,
): string[] {
  const prefix = `${remoteName}/`;
  return collectIteratorValues(repo.branches({ type: "Remote" }))
    .map((branch) => branch.name)
    .filter((branchName) => branchName.startsWith(prefix))
    .filter((branchName) => !branchName.endsWith("/HEAD"))
    .toSorted();
}

function collectIteratorValues<T>(iterator: Iterator<T, void, void>): T[] {
  const values: T[] = [];

  while (true) {
    const next = iterator.next();
    if (next.done) return values;
    values.push(next.value);
  }
}

function buildHotspots(
  branches: readonly BranchChangeSet[],
): SharedConflictHotspot[] {
  const pathToBranches = new Map<string, Set<string>>();

  for (const branch of branches) {
    for (const path of branch.paths) {
      const matchedBranches = pathToBranches.get(path) ?? new Set<string>();
      matchedBranches.add(branch.displayName);
      pathToBranches.set(path, matchedBranches);
    }
  }

  return [...pathToBranches.entries()]
    .filter(([, branchNames]) => branchNames.size >= 2)
    .map(([path, branchNames]) => ({
      path,
      branches: [...branchNames].toSorted(),
    }))
    .toSorted((left, right) => {
      const byBranchCount = right.branches.length - left.branches.length;
      if (byBranchCount !== 0) return byBranchCount;
      return left.path.localeCompare(right.path);
    });
}

function compareComparedBranches(
  left: ComparedBranchAnalysis,
  right: ComparedBranchAnalysis,
): number {
  const byOverlapCount = right.overlappingPaths.length - left.overlappingPaths.length;
  if (byOverlapCount !== 0) return byOverlapCount;

  const byFileCount = right.files.length - left.files.length;
  if (byFileCount !== 0) return byFileCount;

  return left.displayName.localeCompare(right.displayName);
}
