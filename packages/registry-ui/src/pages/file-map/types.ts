// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import type {
  BranchChangeCommit as GitConflictCommit,
  BranchChangeFile as GitConflictFileChange,
  BranchChangeStats as GitConflictDiffStats,
  BranchSplitPoint as GitConflictSplitPoint,
  GitConflictReport as GitConflictReportInput,
  WorkspaceChangeSet as GitConflictWorkspace,
} from 'git-utils';
import type { CanvasDisclosureState } from 'canvas-viewport';

export type GitConflictSource =
  | GitConflictReportInput['analysis']['current']
  | GitConflictReportInput['analysis']['branches'][number]
  | NonNullable<GitConflictReportInput['analysis']['worktrees']>[number];

export type {
  GitConflictCommit,
  GitConflictDiffStats,
  GitConflictFileChange,
  GitConflictReportInput,
  GitConflictSplitPoint,
  GitConflictWorkspace,
};

export type JsonRecord = Record<string, unknown>;

export interface PathMetrics {
  currentTouched: boolean;
  workspaceTouched: boolean;
  executionWorkspaceTouched: boolean;
  remoteBranches: string[];
  overlappingRemoteBranches: string[];
  worktrees: string[];
  overlappingWorktrees: string[];
  overlappingWorkspaceTargets: string[];
  hotspotBranches: string[];
}

export interface TreeMetrics {
  fileCount: number;
  directoryCount: number;
  currentTouchedFiles: number;
  workspaceTouchedFiles: number;
  executionWorkspaceTouchedFiles: number;
  remoteTouchCount: number;
  remoteOverlapCount: number;
  worktreeTouchCount: number;
  worktreeOverlapCount: number;
  workspaceOverlapCount: number;
  hotspotCount: number;
  riskScore: number;
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  kind: 'dir' | 'file';
  metrics: TreeMetrics;
  pathMetrics: PathMetrics;
  children: FileTreeNode[];
}

export interface SourceSummary {
  id: string;
  type: 'current' | 'workspace' | 'execution' | 'remote' | 'worktree';
  label: string;
  worktreePath?: string;
  diffStats: GitConflictDiffStats;
  splitPoint: GitConflictSplitPoint | null;
  commitCount: number;
  commits: GitConflictCommit[];
  files: GitConflictFileChange[];
  overlappingPaths: string[];
}

export interface NodeSourceSummary {
  id: string;
  type: 'current' | 'workspace' | 'execution' | 'remote' | 'worktree';
  label: string;
  worktreePath?: string;
  diffStats: GitConflictDiffStats;
  splitPoint: GitConflictSplitPoint | null;
  fileCount: number;
  overlapCount: number;
  commitCount: number;
  statusCounts: Array<{ status: string; count: number }>;
  files: GitConflictFileChange[];
  commits: GitConflictCommit[];
}

export interface NormalizedReport {
  tree: FileTreeNode;
  sources: SourceSummary[];
  stats: {
    currentFiles: number;
    remoteBranches: number;
    worktrees: number;
    hotspots: number;
    safeScopes: string[];
    baseRef: string;
    currentBranch: string;
    remoteName: string;
  };
}

export interface RenderState {
  report: NormalizedReport;
  rawInput: string;
  selectedNodeId: string;
  autoLoadAttempted: boolean;
  autoRefreshEnabled: boolean;
  inputSource: 'sample' | 'hosted' | 'file' | 'manual';
  drawerState: CanvasDisclosureState;
  viewMode: 'all' | 'current' | 'workspace' | 'overlap';
}
