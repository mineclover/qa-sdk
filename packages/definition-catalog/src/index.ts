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
 * 20 세부 유형 (aspect):
 *   레이아웃, 컴포넌트, 인터랙션, 기능정의, 시나리오,
 *   사용자시나리오, 프로세스흐름, 연관관계,
 *   앱상태, 도메인상태, 시스템상태,
 *   기술적제약, 비즈니스제약, 인프라제약,
 *   도메인데이터, 시스템데이터, 외부데이터,
 *   API계약, CLI계약, 이벤트계약
 *
 * 4 깊이 (depth): 개요, 명세, 구현, 검증
 * 5 생명주기 (lifecycle): 초안, 검토, 승인, 폐기예정, 보관
 */

// ─── 타입 ────────────────────────────────────────────────
export type {
  DefScope,
  DefAspect,
  DefDepth,
  DefLifecycle,
  LinkType,
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
} from "./types.js";

// ─── 축 정의 ────────────────────────────────────────────
export type { VersionedAxis, ExplanatoryRole, AxisExplanatoryMeta } from "./vocabulary.js";
export {
  DEF_SCOPE,
  DEF_ASPECT,
  DEF_DEPTH,
  DEF_LIFECYCLE,
  LINK_TYPE,
  DEFINITION_AXES,
  AXIS_META,
} from "./vocabulary.js";

// ─── 분류 체계 ──────────────────────────────────────────
export type { TaxonomyScope, TaxonomyAspect, DefinitionTaxonomy } from "./taxonomy.js";
export {
  DEFINITION_TAXONOMY,
  VALID_SCOPE_ASPECTS,
  ASPECT_TO_SCOPE,
  validateScopeAspect,
  isValidScopeAspect,
  allValidCombinations,
  CONCERN_TAGS,
  STRUCTURAL_TAGS,
  KNOWN_TAGS,
  isKnownTag,
  detectCrossScope,
  CLASSIFICATION_CONVENTIONS,
} from "./taxonomy.js";

// ─── 카탈로그 ───────────────────────────────────────────
export type { DimRef, PrefixVersionDef, PrefixMeta, PrefixDef, DefinitionCatalog } from "./catalog.js";
export { DEFINITION_CATALOG } from "./catalog.js";

// ─── 좌표 인코딩/디코딩 ─────────────────────────────────
export type { DocumentCoordinate, DecodedDocument, LinkCoordinate, DecodedLink } from "./observe.js";
export {
  encodeDocument,
  decodeDocument,
  serializeDocumentAddress,
  parseDocumentAddress,
  encodeLink,
  decodeLink,
  documentTotalSpace,
  linkTotalSpace,
} from "./observe.js";

// ─── 레지스트리 ─────────────────────────────────────────
export type { DefinitionRegistry } from "./registry.js";
export { MemoryDefinitionRegistry } from "./registry.js";

// ─── Concern 전파 엔진 ──────────────────────────────────
export {
  CONCERN_DEFS,
  getConcernDef,
  extractDirectConcerns,
  computeEffectiveConcerns,
} from "./concern.js";

// ─── Frontmatter 파서 + 스캐너 ──────────────────────────
export type { FrontmatterDef, FrontmatterLink, ParsedDocument, ScanResult } from "./frontmatter.js";
export {
  extractFrontmatter,
  parseYaml,
  extractDef,
  parseDocument,
  scanAndBuild,
  computeAllConcerns,
} from "./frontmatter.js";

// ─── 브릿지 (decision-flow 연결) ────────────────────────
export {
  suggestScopeFromArtifact,
  suggestLifecycleFromVerdict,
  buildDefinitionContext,
} from "./bridge.js";
