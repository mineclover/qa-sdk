export { analyzeRemoteBranchConflicts } from "./branch-conflicts-analysis.js";
export {
  listGitWorktrees,
  parseGitWorktreeList,
} from "./branch-conflicts-worktrees.js";
export { collectWorkspaceChanges } from "./branch-conflicts-workspace.js";
export type {
  AnalyzeRemoteBranchConflictsOptions,
  BranchChangeCommit,
  BranchChangeFile,
  BranchChangeStats,
  BranchChangeSet,
  BranchOverlapFile,
  BranchSplitPoint,
  ComparedBranchAnalysis,
  ComparedWorktreeAnalysis,
  GitWorktreeDescriptor,
  GitConflictReport,
  RemoteBranchConflictAnalysis,
  SharedConflictHotspot,
  WorkspaceChangeSet,
} from "./branch-conflicts-types.js";
