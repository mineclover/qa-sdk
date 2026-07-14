// @def.boundary shared-utility-group
// @def.doc shared-utility-group

export {
  getRepoName,
  listSemverTags,
  parseConventionalCommits,
  collectCommitTypes,
  commitCountsByScope,
  type ConventionalCommit,
} from './git.js';
export {
  analyzeRemoteBranchConflicts,
  type AnalyzeRemoteBranchConflictsOptions,
  type BranchChangeFile,
  type BranchChangeCommit,
  type BranchChangeStats,
  type BranchChangeSet,
  type BranchOverlapFile,
  type BranchSplitPoint,
  type ComparedBranchAnalysis,
  type ComparedWorktreeAnalysis,
  collectWorkspaceChanges,
  listGitWorktrees,
  parseGitWorktreeList,
  type GitWorktreeDescriptor,
  type RemoteBranchConflictAnalysis,
  type SharedConflictHotspot,
  type WorkspaceChangeSet,
} from './branch-conflicts.js';
export type { GitConflictReport } from './branch-conflicts-types.js';
