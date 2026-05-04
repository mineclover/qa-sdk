// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import type {
  FileTreeNode,
  GitConflictFileChange,
  GitConflictReportInput,
  GitConflictWorkspace,
  JsonRecord,
  NodeSourceSummary,
  NormalizedReport,
  PathMetrics,
  SourceSummary,
  TreeMetrics,
} from "./types.js";

export function normalizeReport(raw: JsonRecord): NormalizedReport {
  const report = "analysis" in raw
    ? raw as unknown as GitConflictReportInput
    : { analysis: raw as unknown as GitConflictReportInput["analysis"], safeScopes: [] };

  const analysis = report.analysis;
  if (!analysis?.current) {
    throw new Error("analysis.current가 필요합니다");
  }
  if (!Array.isArray(analysis.branches)) {
    throw new Error("analysis.branches가 배열이어야 합니다");
  }

  const pathMap = new Map<string, PathMetrics>();
  const ensurePath = (path: string): PathMetrics => {
    const existing = pathMap.get(path);
    if (existing) return existing;
    const created: PathMetrics = {
      currentTouched: false,
      workspaceTouched: false,
      executionWorkspaceTouched: false,
      remoteBranches: [],
      overlappingRemoteBranches: [],
      worktrees: [],
      overlappingWorktrees: [],
      overlappingWorkspaceTargets: [],
      hotspotBranches: [],
    };
    pathMap.set(path, created);
    return created;
  };

  const currentFiles = sourceFiles(analysis.current);
  const repoWorkspaceSource = normalizeWorkspaceSource(analysis.repoWorkspace, "workspace");
  const executionWorkspaceSource = normalizeWorkspaceSource(analysis.workspace, "execution");
  const branchSources = analysis.branches.map((branch: GitConflictReportInput["analysis"]["branches"][number]) =>
    normalizeBranchLikeSource(branch, "remote"));
  const worktreeSources = (analysis.worktrees ?? []).map((worktree: NonNullable<GitConflictReportInput["analysis"]["worktrees"]>[number]) =>
    normalizeBranchLikeSource(worktree, "worktree"));
  const sources: SourceSummary[] = [
    {
      id: `current:${analysis.currentBranchName ?? analysis.current.branchName}`,
      type: "current",
      label: analysis.currentBranchName ?? analysis.current.branchName,
      worktreePath: undefined,
      diffStats: analysis.current.diffStats ?? {
        filesChanged: currentFiles.length,
        insertions: 0,
        deletions: 0,
      },
      splitPoint: analysis.current.splitPoint ?? null,
      commitCount: analysis.current.commitCount ?? currentFiles.length,
      commits: analysis.current.commits ?? [],
      files: currentFiles,
      overlappingPaths: [],
    },
    ...(repoWorkspaceSource ? [repoWorkspaceSource] : []),
    ...(executionWorkspaceSource ? [executionWorkspaceSource] : []),
    ...branchSources,
    ...worktreeSources,
  ];

  for (const file of currentFiles) {
    ensurePath(file.path).currentTouched = true;
  }

  if (repoWorkspaceSource) {
    for (const file of repoWorkspaceSource.files) {
      ensurePath(file.path).workspaceTouched = true;
    }
    for (const target of [...branchSources, ...worktreeSources]) {
      for (const path of target.files.map((file: GitConflictFileChange) => file.path)) {
        if (repoWorkspaceSource.files.some((file: GitConflictFileChange) => file.path === path)) {
          ensurePath(path).overlappingWorkspaceTargets.push(target.label);
        }
      }
    }
  }

  if (executionWorkspaceSource) {
    for (const file of executionWorkspaceSource.files) {
      ensurePath(file.path).executionWorkspaceTouched = true;
    }
  }

  for (const branch of branchSources) {
    for (const file of branch.files) {
      ensurePath(file.path).remoteBranches.push(branch.label);
    }
    for (const path of branch.overlappingPaths) {
      ensurePath(path).overlappingRemoteBranches.push(branch.label);
    }
  }

  for (const worktree of worktreeSources) {
    for (const file of worktree.files) {
      ensurePath(file.path).worktrees.push(worktree.label);
    }
    for (const path of worktree.overlappingPaths) {
      ensurePath(path).overlappingWorktrees.push(worktree.label);
    }
  }

  for (const hotspot of analysis.hotspots ?? []) {
    ensurePath(hotspot.path).hotspotBranches.push(...hotspot.branches);
  }

  const root = createEmptyNode("", "", "dir");
  for (const [path, metrics] of pathMap.entries()) {
    insertPath(root, path, metrics);
  }
  computeMetrics(root);

  return {
    tree: root,
    sources,
    stats: {
      currentFiles: currentFiles.length,
      remoteBranches: branchSources.length,
      worktrees: worktreeSources.length,
      hotspots: analysis.hotspots?.length ?? 0,
      safeScopes: (report.safeScopes ?? []).slice(0, 12),
      baseRef: analysis.baseRef ?? "(unknown)",
      currentBranch: analysis.currentBranchName ?? analysis.current.branchName,
      remoteName: analysis.remoteName ?? "origin",
    },
  };
}

export function summarizeNodeSources(
  node: FileTreeNode,
  sources: SourceSummary[],
): NodeSourceSummary[] {
  const summaries: Array<NodeSourceSummary | null> = sources.map((source): NodeSourceSummary | null => {
      const files = source.files.filter((file) => nodeContainsPath(node, file.path));
      if (files.length === 0) return null;

      const statusCounts = [...files.reduce((map, file) => {
        map.set(file.status, (map.get(file.status) ?? 0) + 1);
        return map;
      }, new Map<string, number>()).entries()]
        .map(([status, count]) => ({ status, count }))
        .toSorted((left, right) => right.count - left.count || left.status.localeCompare(right.status));

      const overlapCount = source.overlappingPaths.filter((path) => nodeContainsPath(node, path)).length;

      return {
        id: source.id,
        type: source.type,
        label: source.label,
        worktreePath: source.worktreePath,
        diffStats: source.diffStats,
        splitPoint: source.splitPoint,
        fileCount: files.length,
        overlapCount,
        commitCount: source.commitCount,
        statusCounts,
        files: files.toSorted((left, right) => left.path.localeCompare(right.path)),
        commits: source.commits.filter((commit) =>
          commit.changedPaths.some((path: string) => nodeContainsPath(node, path))),
      };
    });

  return summaries
    .filter((summary): summary is NodeSourceSummary => summary !== null)
    .toSorted((left, right) => {
      const byOverlap = right.overlapCount - left.overlapCount;
      if (byOverlap !== 0) return byOverlap;
      const byFileCount = right.fileCount - left.fileCount;
      if (byFileCount !== 0) return byFileCount;
      const byCommitCount = right.commitCount - left.commitCount;
      if (byCommitCount !== 0) return byCommitCount;
      return left.label.localeCompare(right.label);
    });
}

export function findNodeById(node: FileTreeNode, id: string): FileTreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const matched = findNodeById(child, id);
    if (matched) return matched;
  }
  return null;
}

export function filterTreeByMode(
  tree: FileTreeNode,
  mode: "all" | "current" | "workspace" | "overlap",
): FileTreeNode {
  if (mode === "all") return tree;

  const filtered = cloneFilteredNode(tree, mode);
  return filtered ?? tree;
}

export function nodeContainsPath(node: FileTreeNode, path: string): boolean {
  if (node.path === "") return true;
  return path === node.path || path.startsWith(`${node.path}/`);
}

export function relativeToNode(node: FileTreeNode, path: string): string {
  if (node.path === "") return path;
  if (path === node.path) return node.name;
  return path.startsWith(`${node.path}/`) ? path.slice(node.path.length + 1) : path;
}

function normalizeBranchLikeSource(
  source: GitConflictReportInput["analysis"]["branches"][number] | NonNullable<GitConflictReportInput["analysis"]["worktrees"]>[number],
  type: "remote" | "worktree",
): SourceSummary {
  return {
    id: `${type}:${source.displayName ?? source.branchName}`,
    type,
    label: source.displayName ?? source.branchName,
    worktreePath: "worktreePath" in source ? source.worktreePath : undefined,
    diffStats: source.diffStats ?? {
      filesChanged: (source.files?.length ?? source.paths?.length ?? 0),
      insertions: 0,
      deletions: 0,
    },
    splitPoint: source.splitPoint ?? null,
    commitCount: source.commitCount ?? (source.commits?.length ?? 0),
    commits: source.commits ?? [],
    files: sourceFiles(source),
    overlappingPaths: dedupe(source.overlappingPaths ?? []),
  };
}

function normalizeWorkspaceSource(
  workspace: GitConflictWorkspace | null | undefined,
  type: "workspace" | "execution",
): SourceSummary | null {
  if (!workspace) return null;

  return {
    id: `${type}:${workspace.relativePath}`,
    type,
    label: workspace.relativePath === "."
      ? `${type}:(repo)`
      : `${type}:${workspace.relativePath}`,
    worktreePath: workspace.executionCwd,
    diffStats: workspace.diffStats,
    splitPoint: null,
    commitCount: 0,
    commits: [],
    files: sourceFiles({ files: workspace.files, paths: workspace.paths }),
    overlappingPaths: [],
  };
}

function sourceFiles(source: { files?: GitConflictFileChange[]; paths?: string[] }): GitConflictFileChange[] {
  const fileSource = source as {
    files?: GitConflictFileChange[];
    paths?: string[];
  };
  if (Array.isArray(fileSource.files) && fileSource.files.length > 0) {
    return fileSource.files.map((file: GitConflictFileChange) => ({
      path: file.path,
      status: file.status ?? "Modified",
      previousPath: file.previousPath ?? null,
      binary: file.binary === true,
      oldOid: "oldOid" in file ? file.oldOid : null,
      newOid: "newOid" in file ? file.newOid : null,
    }));
  }

  return (fileSource.paths ?? []).map((path: string) => ({
    path,
    status: "Modified",
    previousPath: null,
    binary: false,
    oldOid: null,
    newOid: null,
  }));
}

function insertPath(root: FileTreeNode, path: string, metrics: PathMetrics): void {
  const segments = path.split("/").filter(Boolean);
  let current = root;
  let currentPath = "";

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const isLeaf = index === segments.length - 1;
    let child = current.children.find((node) => node.name === segment);
    if (!child) {
      child = createEmptyNode(currentPath, segment, isLeaf ? "file" : "dir");
      current.children.push(child);
      current.children.sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === "dir" ? -1 : 1;
        return left.name.localeCompare(right.name);
      });
    }

    if (isLeaf) {
      child.pathMetrics = dedupePathMetrics(metrics);
    }

    current = child;
  }
}

function createEmptyNode(path: string, name: string, kind: "dir" | "file"): FileTreeNode {
  return {
    id: path || "root",
    path,
    name,
    kind,
    children: [],
    pathMetrics: {
      currentTouched: false,
      workspaceTouched: false,
      executionWorkspaceTouched: false,
      remoteBranches: [],
      overlappingRemoteBranches: [],
      worktrees: [],
      overlappingWorktrees: [],
      overlappingWorkspaceTargets: [],
      hotspotBranches: [],
    },
    metrics: {
      fileCount: 0,
      directoryCount: 0,
      currentTouchedFiles: 0,
      workspaceTouchedFiles: 0,
      executionWorkspaceTouchedFiles: 0,
      remoteTouchCount: 0,
      remoteOverlapCount: 0,
      worktreeTouchCount: 0,
      worktreeOverlapCount: 0,
      workspaceOverlapCount: 0,
      hotspotCount: 0,
      riskScore: 0,
    },
  };
}

function computeMetrics(node: FileTreeNode): TreeMetrics {
  if (node.kind === "file") {
    const metrics = {
      fileCount: 1,
      directoryCount: 0,
      currentTouchedFiles: node.pathMetrics.currentTouched ? 1 : 0,
      workspaceTouchedFiles: node.pathMetrics.workspaceTouched ? 1 : 0,
      executionWorkspaceTouchedFiles: node.pathMetrics.executionWorkspaceTouched ? 1 : 0,
      remoteTouchCount: node.pathMetrics.remoteBranches.length,
      remoteOverlapCount: node.pathMetrics.overlappingRemoteBranches.length,
      worktreeTouchCount: node.pathMetrics.worktrees.length,
      worktreeOverlapCount: node.pathMetrics.overlappingWorktrees.length,
      workspaceOverlapCount: node.pathMetrics.overlappingWorkspaceTargets.length,
      hotspotCount: node.pathMetrics.hotspotBranches.length > 0 ? 1 : 0,
      riskScore: scorePathMetrics(node.pathMetrics),
    };
    node.metrics = metrics;
    return metrics;
  }

  const aggregate: TreeMetrics = {
    fileCount: 0,
    directoryCount: 1,
    currentTouchedFiles: 0,
    workspaceTouchedFiles: 0,
    executionWorkspaceTouchedFiles: 0,
    remoteTouchCount: 0,
    remoteOverlapCount: 0,
    worktreeTouchCount: 0,
    worktreeOverlapCount: 0,
    workspaceOverlapCount: 0,
    hotspotCount: 0,
    riskScore: 0,
  };

  for (const child of node.children) {
    const childMetrics = computeMetrics(child);
    aggregate.fileCount += childMetrics.fileCount;
    aggregate.directoryCount += childMetrics.directoryCount;
    aggregate.currentTouchedFiles += childMetrics.currentTouchedFiles;
    aggregate.workspaceTouchedFiles += childMetrics.workspaceTouchedFiles;
    aggregate.executionWorkspaceTouchedFiles += childMetrics.executionWorkspaceTouchedFiles;
    aggregate.remoteTouchCount += childMetrics.remoteTouchCount;
    aggregate.remoteOverlapCount += childMetrics.remoteOverlapCount;
    aggregate.worktreeTouchCount += childMetrics.worktreeTouchCount;
    aggregate.worktreeOverlapCount += childMetrics.worktreeOverlapCount;
    aggregate.workspaceOverlapCount += childMetrics.workspaceOverlapCount;
    aggregate.hotspotCount += childMetrics.hotspotCount;
    aggregate.riskScore += childMetrics.riskScore;
  }

  node.metrics = aggregate;
  return aggregate;
}

function scorePathMetrics(metrics: PathMetrics): number {
  return (metrics.currentTouched ? 1 : 0)
    + (metrics.workspaceTouched ? 2 : 0)
    + (metrics.executionWorkspaceTouched ? 1 : 0)
    + metrics.remoteBranches.length
    + metrics.worktrees.length
    + metrics.overlappingRemoteBranches.length * 4
    + metrics.overlappingWorktrees.length * 5
    + metrics.overlappingWorkspaceTargets.length * 4
    + Math.min(metrics.hotspotBranches.length, 4) * 3;
}

function dedupePathMetrics(metrics: PathMetrics): PathMetrics {
  return {
    currentTouched: metrics.currentTouched,
    workspaceTouched: metrics.workspaceTouched,
    executionWorkspaceTouched: metrics.executionWorkspaceTouched,
    remoteBranches: dedupe(metrics.remoteBranches),
    overlappingRemoteBranches: dedupe(metrics.overlappingRemoteBranches),
    worktrees: dedupe(metrics.worktrees),
    overlappingWorktrees: dedupe(metrics.overlappingWorktrees),
    overlappingWorkspaceTargets: dedupe(metrics.overlappingWorkspaceTargets),
    hotspotBranches: dedupe(metrics.hotspotBranches),
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
}

function cloneFilteredNode(
  node: FileTreeNode,
  mode: "current" | "workspace" | "overlap",
): FileTreeNode | null {
  const shouldKeepSelf = mode === "current"
    ? node.metrics.currentTouchedFiles > 0
    : mode === "workspace"
      ? node.metrics.workspaceTouchedFiles > 0
      : node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount + node.metrics.workspaceOverlapCount > 0;

  if (node.kind === "file") {
    return shouldKeepSelf ? node : null;
  }

  const children = node.children
    .map((child) => cloneFilteredNode(child, mode))
    .filter((child): child is FileTreeNode => child !== null);

  if (!shouldKeepSelf && children.length === 0) {
    return null;
  }

  return {
    ...node,
    children,
  };
}
