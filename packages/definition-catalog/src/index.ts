// @def.boundary definition-catalog-spec
// @def.doc definition-catalog-spec

/**
 * definition-catalog — 소프트웨어 정의 메타데이터를 좌표계로 관리하는 카탈로그
 *
 * decision-flow가 "왜(why)"를 좌표로 증명한다면,
 * definition-catalog는 "무엇(what)"을 좌표로 분류한다.
 *
 * what × why = 추적 가능한 소프트웨어 정의
 *
 * 7대 분류 (scope):
 *   화면/UI, 기능, 흐름, 상태, 제약조건, 데이터, 인터페이스
 *
 * 22 세부 유형 (aspect):
 *   레이아웃, 컴포넌트, 인터랙션, 기능정의, 시나리오,
 *   사용자시나리오, 프로세스흐름, 연관관계,
 *   앱상태, 도메인상태, 시스템상태,
 *   기술적제약, 비즈니스제약, 인프라제약,
 *   도메인데이터, 시스템데이터, 외부데이터, Prefix스키마, Axis카탈로그,
 *   API계약, CLI계약, 이벤트계약
 *
 * 4 깊이 (depth): 개요, 명세, 구현, 검증
 * 5 생명주기 (lifecycle): 초안, 검토, 승인, 폐기예정, 보관
 */

// ─── 타입 ────────────────────────────────────────────────
export type {
  DefDocType,
  KnowledgeKind,
  DefLevel,
  DefScope,
  DefAspect,
  DefDepth,
  DefLayer,
  DefLifecycle,
  ProjectionPlane,
  IntentHierarchy,
  LineageFacet,
  LineageKind,
  LinkType,
  TaxonomyFamily,
  TaxonomyMeta,
  ConcernTag,
  StructuralTag,
  KnownTag,
  PropagationDirection,
  ConcernPropagation,
  ConcernDef,
  InheritedConcern,
  EffectiveConcerns,
  DecisionRef,
  DefinitionEntry,
  DefinitionEntryInput,
  DefinitionEntryPatch,
  DefinitionLink,
  DefinitionFilter,
  DefinitionStats,
} from './types.js';

// ─── 축 정의 ────────────────────────────────────────────
export type { VersionedAxis, ExplanatoryRole, AxisExplanatoryMeta } from './vocabulary.js';
export {
  DEF_LEVEL,
  DEF_SCOPE,
  DEF_ASPECT,
  DEF_DEPTH,
  DEF_LIFECYCLE,
  LINK_TYPE,
  TAXONOMY_FAMILY,
  TAXONOMY_REGISTRY,
  DEFINITION_AXES,
  AXIS_META,
  ASPECT_PARENTS,
  ROOT_ASPECTS,
  deriveAspectParent,
  getAspectChildren,
  getAspectFamily,
} from './vocabulary.js';

// ─── 분류 체계 ──────────────────────────────────────────
export type {
  TaxonomyScope,
  TaxonomyAspect,
  DefinitionTaxonomy,
  ContractMarkerKind,
  ContractMarkerDef,
  ScenarioMarkerKind,
  ScenarioMarkerDef,
  LinkTypeRule,
  SemanticLintFamilyRule,
  SemanticLintTraversalLinkType,
} from './taxonomy.js';
export {
  DEFINITION_TAXONOMY,
  VALID_SCOPE_ASPECTS,
  ASPECT_TO_SCOPES,
  SEMANTIC_LINT_FAMILIES,
  validateScopeAspect,
  isValidScopeAspect,
  allValidCombinations,
  LINK_TYPE_RULES,
  isLinkCycleAllowed,
  isLinkMultiParentAllowed,
  CONCERN_TAGS,
  STRUCTURAL_TAGS,
  KNOWN_TAGS,
  isKnownTag,
  detectCrossScope,
  CLASSIFICATION_CONVENTIONS,
  CONTRACT_MARKERS,
  CONTRACT_MARKER_NAMES,
  isContractMarker,
  getContractMarkerDef,
  SCENARIO_MARKERS,
  SCENARIO_MARKER_NAMES,
  isScenarioMarker,
  getScenarioMarkerDef,
} from './taxonomy.js';

// ─── scope 레지스트리 ────────────────────────────────────
export type {
  ScopeVersionDef,
  ScopeRegistryEntry,
  ScopeSegment,
  ScopeAddress,
  DecodedScopeAddress,
} from './scope-registry.js';
export { ScopeRegistry } from './scope-registry.js';

// ─── 버전 매니페스트 ─────────────────────────────────────
export type {
  PrefixLifecycleState,
  PrefixVersionRecord,
  ManifestLifecycleState,
  ServiceVersionManifest,
  GuardResult,
} from './version-manifest.js';
export { ManifestRegistry } from './version-manifest.js';

// ─── 카탈로그 ───────────────────────────────────────────
export type {
  DimRef,
  PrefixVersionDef,
  PrefixMeta,
  PrefixDef,
  DefinitionCatalog,
} from './catalog.js';
export { DEFINITION_CATALOG } from './catalog.js';

// ─── 좌표 인코딩/디코딩 ─────────────────────────────────
export type {
  DocumentCoordinate,
  DecodedDocument,
  UniqueDocumentCoordinate,
  DecodedUniqueDocument,
  LinkCoordinate,
  DecodedLink,
} from './observe.js';
export {
  encodeDocument,
  decodeDocument,
  serializeDocumentAddress,
  parseDocumentAddress,
  encodeUniqueDocument,
  decodeUniqueDocument,
  serializeUniqueDocumentAddress,
  parseUniqueDocumentAddress,
  encodeLink,
  decodeLink,
  documentTotalSpace,
  uniqueDocumentTotalSpace,
  linkTotalSpace,
} from './observe.js';

// ─── 설정 파일 ─────────────────────────────────────────
export type { DefConfig, MachineEntityState, DriftEntry } from './def-config.js';
export {
  readDefConfig,
  writeDefConfig,
  hashFrontmatter,
  detectDrift,
  configPath,
  readMachineState,
  writeMachineState,
  readAllMachineStates,
} from './def-config.js';

// ─── 유일 주소 할당 ────────────────────────────────────
export type { AddressAssignment } from './address-assign.js';
export {
  assignUniqueAddresses,
  buildIdToAddressMap,
  buildAddressToIdMap,
} from './address-assign.js';

// ─── 상태 모델 ─────────────────────────────────────────
export type {
  StateDefinition,
  TransitionRule,
  StateMachineDefinition,
  StateMachineInstance,
  StateTransitionRecord,
  StateDistribution,
  DocLifecycleState,
  SpecImplState,
  ConventionState,
  SyncState,
} from './state-model.js';
export {
  createInstance,
  transition,
  availableTransitions,
  computeDistribution,
  DOC_LIFECYCLE_MACHINE,
  SPEC_IMPL_MACHINE,
  CONVENTION_MACHINE,
  SYNC_MACHINE,
} from './state-model.js';

// ─── 하네스 상태 모델 (11개 머신 + 의존 + 프로세스) ─────
export type {
  DependencyKind,
  MachineDependency,
  ProcessStep,
  ProcessDefinition,
  HarnessRegistry,
  CompositeInstance,
  TransitionResult,
  ProcessResult,
  AddressState,
  VersionLifecycleState,
  FlowState,
  ServiceState,
  EventState,
  MetricHealthState,
  PolicyState,
} from './harness-state-model.js';
export {
  checkGuards,
  collectCascades,
  validateProcess,
  ADDRESS_STATE_MACHINE,
  VERSION_LIFECYCLE_MACHINE,
  FLOW_STATE_MACHINE,
  SERVICE_STATE_MACHINE,
  EVENT_STATE_MACHINE,
  METRIC_HEALTH_MACHINE,
  POLICY_STATE_MACHINE,
  SYSTEM_DEPENDENCIES,
  PREFIX_RELEASE_PROCESS,
  DOC_APPROVAL_PROCESS,
  SERVICE_DEPRECATION_PROCESS,
  createHarnessRegistry,
  createCompositeInstance,
} from './harness-state-model.js';

// ─── 하네스 트래커 (SDK 이벤트 수집) ────────────────────
export type { HarnessLogger, HarnessTracker } from './harness-tracker.js';
export { createHarnessTracker } from './harness-tracker.js';

// ─── Cross-Loop 브릿지 ─────────────────────────────────
export type {
  GateHarnessBridgeConfig,
  GateHarnessBridge,
  HarnessContextSnapshot,
  DecisionOutcome,
  DecisionInfraBridgeConfig,
  DecisionInfraBridge,
} from './cross-loop-bridge.js';
export {
  createGateHarnessBridge,
  buildHarnessContext,
  createDecisionInfraBridge,
} from './cross-loop-bridge.js';

// ─── Definition Runtime (단일 초기화 진입점) ───────────
export type { DefinitionRuntimeConfig, DefinitionRuntime } from './runtime.js';
export { createDefinitionRuntime } from './runtime.js';

// ─── 하네스 상태 파생 ──────────────────────────────────
export type {
  SyncDeriveInput,
  SpecImplDeriveInput,
  ConventionDeriveInput,
  AddressDeriveInput,
  ServiceDeriveInput,
  EventDeriveInput,
  MetricDeriveInput,
  DeriveInputs,
  DerivedStates,
} from './harness-derive.js';
export {
  deriveDocLifecycle,
  deriveSyncState,
  deriveSpecImplState,
  deriveConventionState,
  deriveVersionLifecycle,
  deriveFlowState,
  derivePolicyState,
  deriveAddressState,
  deriveServiceStatus,
  deriveEventStatus,
  deriveMetricHealth,
  deriveAllStates,
} from './harness-derive.js';

// ─── 레지스트리 ─────────────────────────────────────────
export type { DefinitionRegistry } from './registry.js';
export { MemoryDefinitionRegistry } from './registry.js';
export { docRowToRegistryInput } from './registry-helpers.js';

// ─── Concern 전파 엔진 ──────────────────────────────────
export {
  CONCERN_DEFS,
  getConcernDef,
  extractDirectConcerns,
  computeEffectiveConcerns,
  selectConcernContext,
} from './concern.js';

// ─── 검증 ───────────────────────────────────────────────
export type { ValidationIssue, ValidationResult, ValidateGraphOptions } from './validate.js';
export { validateGraph } from './validate.js';

// ─── 도메인 루트 파생 (domain_root) ─────────────────────
export type { DomainRootRegistry } from './domain-root.js';
export {
  isDomainTier,
  selectPrimaryParent,
  deriveDomainRoot,
  deriveSubDocRoot,
  deriveAllDomainRoots,
  detectOwnerRootMismatch,
  SUB_DOC_EXTENSIONS,
} from './domain-root.js';

// ─── 코드 참조 스캔 ─────────────────────────────────────
export type {
  CodeReferenceInput,
  CodeReferenceTarget,
  CodeLinkCoverageOptions,
  CodeLinkCoverageResult,
  CoverageMetrics,
  AdjustedCoverageMetrics,
} from './code-references.js';
export {
  collectCodeReferences,
  collectCodeLinkCoverage,
  extractSourceEntriesFromYaml,
  parseCodeReferenceTarget,
  formatCodeReferenceTarget,
  makeCodeReferenceScopeKey,
  DEFAULT_EXCLUDE_PACKAGES,
} from './code-references.js';

// ─── 영향 분석 (바텀업 역추적) ───────────────────────────
export type { ImpactedDoc, ImpactAnalysis } from './impact.js';
export { analyzeImpact, selectImpactContext } from './impact.js';

// ─── 문서 조립 ──────────────────────────────────────────
export type {
  MemberSummary,
  AssembledFeature,
  BoundarySummary,
  BoundaryCouplingSummary,
  AssembledBoundary,
} from './assemble.js';
export { assembleFeature, assembleBoundary } from './assemble.js';

// ─── 계약 조립 (Contract Assembly) ──────────────────────
export type {
  Reversibility,
  EvidenceItem,
  ContractSection,
  AssembledContract,
  ContractStats,
} from './contract.js';
export { parseEvidenceItems, assembleContract } from './contract.js';

// ─── 주소 의도 + 소비율 ─────────────────────────────────
export type {
  DimSlice,
  SliceIntent,
  DimConsumption,
  PrefixConsumption,
  ConsumptionSeverity,
  ConsumptionDiagnosis,
} from './address-intent.js';
export {
  sliceDepth,
  sliceContains,
  resolveIntents,
  computeConsumption,
  diagnoseConsumption,
} from './address-intent.js';

// ─── 워크플로우 합성 (HyEvo L4) ─────────────────────────
export type {
  StepMode,
  WorkflowNode,
  WorkflowEdge,
  ValidatorBinding,
  WorkflowMetadata,
  WorkflowSpec,
  SpecContext,
  ReflectionResult,
} from './workflow.js';
export { compileWorkflow, reflect } from './workflow.js';

// ─── 테스트 추적 ────────────────────────────────────────
export type { TestRef, TestTraceResult } from './test-trace.js';
export { traceTests } from './test-trace.js';

// ─── 마커 기반 추출 ─────────────────────────────────────
export type {
  ExtractLevel,
  StandardMarker,
  Marker,
  MarkedSection,
  MarkedLine,
  ExtractResult,
  DocumentSummary,
} from './extract.js';
export {
  findMarkedSections,
  findMarkers,
  extractByLevel,
  extractByMarker,
  summarizeDocument,
} from './extract.js';

// ─── Frontmatter 파서 + 스캐너 ──────────────────────────
export type {
  FrontmatterDef,
  FrontmatterGate,
  FrontmatterTest,
  FrontmatterLink,
  ParsedDocument,
  ScanResult,
} from './frontmatter.js';
export {
  extractFrontmatter,
  parseYaml,
  extractDef,
  extractGate,
  extractTests,
  parseDocument,
  scanAndBuild,
  computeAllConcerns,
} from './frontmatter.js';

// ─── Frontmatter Writer (DB → file 역동기화) ────────────
export type { DbMetadata } from './frontmatter-writer.js';
export { mergeFrontmatter, writeFrontmatterToFile } from './frontmatter-writer.js';

// ─── 데이터 소스 인터페이스 (서버/로컬 추상화) ───────────
export type {
  DefBoundaryCouplingIncoming,
  DefBoundaryCouplingOutgoing,
  DefBoundaryConcernItem,
  DefBoundaryConcernsResult,
  DefBoundaryContextResult,
  DefBoundaryResolutionCandidate,
  DefCodeReference,
  DefBoundaryDoc,
  DefBoundaryImpactDoc,
  DefBoundaryImpactResult,
  DefBoundaryMember,
  DefBoundaryResult,
  DefDoc,
  DefDocBody,
  DefFileBoundaryResolution,
  DefFeedbackRequestSummary,
  DefIncomingLink,
  DefOutgoingLink,
  DefListFilter,
  DefSyntheticIncomingLink,
  DefValidationIssue,
  DefValidationResult,
  DefValidateOptions,
  DefDataSource,
} from './data-source.js';
export { resolveCodeBoundary } from './code-boundary.js';
export type { ResolveCodeBoundaryInput } from './code-boundary.js';

// ─── CLI 도구 ───────────────────────────────────────────
export { topdown, bottomup, context, boundary, boundaryContext } from './cli-tools.js';

// ─── 브릿지 (decision-flow 연결) ────────────────────────
export {
  suggestScopeFromArtifact,
  suggestLifecycleFromVerdict,
  buildDefinitionContext,
} from './bridge.js';

// ─── 좌표 저장 자동 검출 (coordinate-storage.rule) ──────
export {
  parseDrizzleTables,
  checkCoordinateStorage,
  scanCoordinateStorage,
  type CoordStorageViolation,
  type CoordStorageViolationKind,
  type CoordStorageScanOptions,
  type ScannedTable,
  type DrizzleDialect,
} from './coordinate-storage-check.js';
