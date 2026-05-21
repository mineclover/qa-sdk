// Decision file (markdown + frontmatter + 마커 추출)
export {
  parseDecisionFile,
  serializeDecisionFile,
  extractMarkers,
  createDecisionSkeletonText,
  type DecisionFile,
  type DecisionMeta,
  type DecisionMarkers,
  type DecisionOption,
  type DecisionEvidence,
} from "./decision-file.js";

// Sync action 계산기
export {
  computeSyncAction,
  type SyncAction,
  type SyncOptions,
  type ConflictResolution,
} from "./sync.js";

// decisionLink 형식 해소 (path / decision:<id> / external / unsupported)
export {
  resolveDecisionLink,
  type ResolvedDecisionLink,
} from "./resolve-link.js";
