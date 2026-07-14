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
  type OptionAnnotation,
} from './decision-file.js';

// Sync action 계산기
export {
  computeSyncAction,
  type SyncAction,
  type SyncOptions,
  type ConflictResolution,
} from './sync.js';

// decisionLink 형식 해소 (path / decision:<id> / external / unsupported)
export { resolveDecisionLink, type ResolvedDecisionLink } from './resolve-link.js';

// decision-flow 변환 어댑터 (Stage 4)
export { toFlowSchema, extractEvidence, type ToFlowSchemaOptions } from './to-flow-schema.js';

// 역방향 변환 (v0.12)
export {
  toMarkdown,
  toMarkdownText,
  extractOptionAnnotations,
  type ToMarkdownOptions,
} from './from-flow-schema.js';
