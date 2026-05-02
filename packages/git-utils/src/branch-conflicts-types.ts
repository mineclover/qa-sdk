// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type { DeltaType } from "es-git";

export interface BranchChangeFile {
  path: string;
  previousPath: string | null;
  status: DeltaType;
  oldOid: string | null;
  newOid: string | null;
  binary: boolean;
}

export interface BranchChangeCommit {
  oid: string;
  shortOid: string;
  committedAt: string;
  authorName: string;
  authorEmail: string;
  summary: string;
  conventionalType: string | null;
  conventionalScope: string | null;
  breaking: boolean;
  changedPaths: string[];
}

export interface BranchChangeStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface BranchSplitPoint {
  oid: string;
  shortOid: string;
  committedAt: string;
  authorName: string;
  authorEmail: string;
  summary: string;
  diffStats: BranchChangeStats;
  changedPaths: string[];
}

export interface BranchChangeSet {
  branchName: string;
  displayName: string;
  ref: string;
  headOid: string;
  mergeBaseOid: string;
  splitPoint: BranchSplitPoint | null;
  diffStats: BranchChangeStats;
  commitCount: number;
  commits: BranchChangeCommit[];
  files: BranchChangeFile[];
  paths: string[];
}

export interface WorkspaceChangeSet {
  scope: "repo" | "execution";
  executionCwd: string;
  relativePath: string;
  diffStats: BranchChangeStats;
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
  executionCwd: string;
  remoteName: string;
  fetched: boolean;
  baseRef: string;
  baseHeadOid: string;
  currentRef: string;
  currentBranchName: string | null;
  currentHeadOid: string;
  current: BranchChangeSet;
  repoWorkspace: WorkspaceChangeSet | null;
  workspace: WorkspaceChangeSet | null;
  branches: ComparedBranchAnalysis[];
  worktrees: ComparedWorktreeAnalysis[];
  hotspots: SharedConflictHotspot[];
}

export interface GitConflictReport {
  schemaVersion: "git-conflicts-report/v1";
  generatedAt: string;
  analysis: RemoteBranchConflictAnalysis;
  workspaceScopes: string[];
  currentScopes: string[];
  occupiedScopes: string[];
  overlapScopes: string[];
  safeScopes: string[];
}

export interface AnalyzeRemoteBranchConflictsOptions {
  cwd: string;
  remoteName?: string;
  baseRef?: string;
  currentRef?: string;
  fetch?: boolean;
  excludeCurrentRemoteBranch?: boolean;
  includeWorktrees?: boolean;
  maxCommitHistory?: number;
  executionCwd?: string;
}
