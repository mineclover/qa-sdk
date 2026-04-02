import { realpathSync } from "node:fs";
import { basename, resolve as resolvePath } from "node:path";
import { execaSync } from "execa";
import { openRepository, type DeltaType, type DiffDelta, type DiffFile, type Repository } from "es-git";

export interface BranchChangeFile {
  path: string;
  previousPath: string | null;
  status: DeltaType;
  oldOid: string | null;
  newOid: string | null;
  binary: boolean;
}

export interface BranchChangeSet {
  branchName: string;
  displayName: string;
  ref: string;
  headOid: string;
  mergeBaseOid: string;
  files: BranchChangeFile[];
  paths: string[];
}

export interface BranchOverlapFile {
  path: string;
  currentStatus: DeltaType;
  comparedStatus: DeltaType;
}

export interface ComparedBranchAnalysis extends BranchChangeSet {
  overlappingPaths: string[];
  overlappingFiles: BranchOverlapFile[];
  currentOnlyPaths: string[];
  branchOnlyPaths: string[];
}

export interface ComparedWorktreeAnalysis extends ComparedBranchAnalysis {
  worktreePath: string;
  branchRef: string | null;
  isDetached: boolean;
}

export interface GitWorktreeDescriptor {
  path: string;
  headOid: string;
  branchRef: string | null;
  isBare: boolean;
  isDetached: boolean;
}

export interface SharedConflictHotspot {
  path: string;
  branches: string[];
}

export interface RemoteBranchConflictAnalysis {
  repoPath: string;
  currentWorktreePath: string;
  remoteName: string;
  fetched: boolean;
  baseRef: string;
  baseHeadOid: string;
  currentRef: string;
  currentBranchName: string | null;
  currentHeadOid: string;
  current: BranchChangeSet;
  branches: ComparedBranchAnalysis[];
  worktrees: ComparedWorktreeAnalysis[];
  hotspots: SharedConflictHotspot[];
}

export interface AnalyzeRemoteBranchConflictsOptions {
  cwd: string;
  remoteName?: string;
  baseRef?: string;
  currentRef?: string;
  fetch?: boolean;
  excludeCurrentRemoteBranch?: boolean;
  includeWorktrees?: boolean;
}

export async function analyzeRemoteBranchConflicts(
  options: AnalyzeRemoteBranchConflictsOptions,
): Promise<RemoteBranchConflictAnalysis> {
  const repoPath = canonicalPath(options.cwd);
  const repo = await openRepository(repoPath);
  const remoteName = resolveRemoteName(repo, options.remoteName);
  const fetch = options.fetch !== false;
  const includeWorktrees = options.includeWorktrees !== false;

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
    repo,
    branchName: currentBranchName ?? currentRef,
    displayName: currentBranchName ?? currentRef,
    ref: currentRef,
    headOid: currentHeadOid,
    baseHeadOid,
  });

  const skipCurrentRemoteBranch = options.excludeCurrentRemoteBranch !== false
    && currentBranchName !== null;
  const branches = listRemoteBranchNames(repo, remoteName)
    .filter((branchName) => !skipCurrentRemoteBranch || branchName !== `${remoteName}/${currentBranchName}`)
    .map((branchName) => {
      const branchHeadOid = repo.revparseSingle(branchName);
      const branchChangeSet = buildBranchChangeSet({
        repo,
        branchName,
        displayName: branchName,
        ref: branchName,
        headOid: branchHeadOid,
        baseHeadOid,
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
    })
    : [];

  return {
    repoPath,
    currentWorktreePath: repoPath,
    remoteName,
    fetched: fetch,
    baseRef,
    baseHeadOid,
    currentRef,
    currentBranchName,
    currentHeadOid,
    current,
    branches,
    worktrees,
    hotspots: buildHotspots([current, ...branches, ...worktrees]),
  };
}

export function listGitWorktrees(cwd: string): GitWorktreeDescriptor[] {
  const { stdout } = execaSync("git", ["worktree", "list", "--porcelain"], { cwd });
  return parseGitWorktreeList(stdout);
}

export function parseGitWorktreeList(output: string): GitWorktreeDescriptor[] {
  const lines = output.split(/\r?\n/);
  const worktrees: GitWorktreeDescriptor[] = [];
  let current: Partial<GitWorktreeDescriptor> | null = null;

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (isCompleteWorktree(current)) {
        worktrees.push(current);
      }
      current = {
        path: line.slice("worktree ".length),
        branchRef: null,
        isBare: false,
        isDetached: false,
      };
      continue;
    }

    if (!current || line.length === 0) continue;
    if (line.startsWith("HEAD ")) {
      current.headOid = line.slice("HEAD ".length);
      continue;
    }
    if (line.startsWith("branch ")) {
      current.branchRef = line.slice("branch ".length);
      continue;
    }
    if (line === "bare") {
      current.isBare = true;
      continue;
    }
    if (line === "detached") {
      current.isDetached = true;
    }
  }

  if (isCompleteWorktree(current)) {
    worktrees.push(current);
  }

  return worktrees;
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
  },
): Promise<ComparedWorktreeAnalysis | null> {
  const repo = await openRepository(worktree.path);
  const branchName = worktree.branchRef
    ? normalizeRefName(worktree.branchRef)
    : `detached:${worktree.headOid.slice(0, 7)}`;
  const changeSet = buildBranchChangeSet({
    repo,
    branchName,
    displayName: buildWorktreeDisplayName(worktree, branchName),
    ref: worktree.branchRef ?? worktree.headOid,
    headOid: worktree.headOid,
    baseHeadOid: repo.revparseSingle(options.baseRef),
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
    repo: Repository;
    branchName: string;
    displayName: string;
    ref: string;
    headOid: string;
    baseHeadOid: string;
  },
): BranchChangeSet {
  const mergeBaseOid = options.headOid === options.baseHeadOid
    ? options.baseHeadOid
    : options.repo.getMergeBase(options.baseHeadOid, options.headOid);
  const files = collectChangedFiles(options.repo, mergeBaseOid, options.headOid);

  return {
    branchName: options.branchName,
    displayName: options.displayName,
    ref: options.ref,
    headOid: options.headOid,
    mergeBaseOid,
    files,
    paths: files.map((file) => file.path),
  };
}

function collectChangedFiles(
  repo: Repository,
  oldOid: string,
  newOid: string,
): BranchChangeFile[] {
  if (oldOid === newOid) return [];

  const oldTree = repo.getCommit(oldOid).tree();
  const newTree = repo.getCommit(newOid).tree();
  const diff = repo.diffTreeToTree(oldTree, newTree);

  try {
    diff.findSimilar();
  } catch {
    // rename 탐지는 선택적 기능이므로 실패해도 기본 diff는 계속 사용한다.
  }

  return collectIteratorValues(diff.deltas())
    .map((delta) => mapDiffDelta(delta))
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

function mapDiffDelta(delta: DiffDelta): BranchChangeFile {
  const oldFile = delta.oldFile();
  const newFile = delta.newFile();
  const path = newFile.path() ?? oldFile.path();

  if (path === null) {
    throw new Error("diff delta 경로를 해석할 수 없음");
  }

  const previousPath = oldFile.path();

  return {
    path,
    previousPath: previousPath !== null && previousPath !== path ? previousPath : null,
    status: delta.status(),
    oldOid: normalizeDiffOid(oldFile),
    newOid: normalizeDiffOid(newFile),
    binary: oldFile.isBinary() || newFile.isBinary(),
  };
}

function normalizeDiffOid(file: DiffFile): string | null {
  if (!file.exists() || !file.isValidId()) return null;
  return file.id();
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

function normalizeRefName(ref: string): string {
  if (ref.startsWith("refs/remotes/")) {
    return ref.slice("refs/remotes/".length);
  }
  if (ref.startsWith("refs/heads/")) {
    return ref.slice("refs/heads/".length);
  }
  return ref;
}

function buildWorktreeDisplayName(
  worktree: GitWorktreeDescriptor,
  branchName: string,
): string {
  if (worktree.isDetached) {
    return `worktree:${basename(worktree.path)}@${worktree.headOid.slice(0, 7)}`;
  }

  return `worktree:${branchName}`;
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

function isCompleteWorktree(
  worktree: Partial<GitWorktreeDescriptor> | null,
): worktree is GitWorktreeDescriptor {
  return Boolean(worktree?.path && worktree.headOid);
}

function canonicalPath(path: string): string {
  const resolvedPath = resolvePath(path);
  try {
    return realpathSync.native(resolvedPath);
  } catch {
    return resolvedPath;
  }
}
