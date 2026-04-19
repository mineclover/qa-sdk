// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * core-bundle — Three.js 무의존 순수 모듈 번들 진입점.
 *
 * 브라우저에서 <script type="module"> 로 직접 import 가능.
 * Three.js 렌더러(scene-builder)는 제외.
 */

// Core
export type {
  CategoryTheme, VizTheme, CellGridDef, CellState, CellRef,
  ViewMode, ViewPosition, StackAxis, MatrixStackDef,
  ActivationEvent, VizCallbacks, VizConfig,
} from "./core/types.js";
export { DEFAULT_THEME } from "./core/types.js";
export { buildGridPositions, computeStackPositions } from "./core/grid-builder.js";
export type { CellLayout, GridLayout, GridPositions } from "./core/grid-builder.js";

// Color Tokens
export { PALETTE, CATEGORY_COLORS, ROLE_COLORS, LAYER_COLORS, generateCssVariables } from "./core/color-tokens.js";
export type { ColorToken, CategoryColor, RoleColor } from "./core/color-tokens.js";

// Split Pattern
export {
  scalar, row, grid, cube, spine, shelf, nested,
  inferPattern, inferRole, extractAxes, extractDims, computePatternLayout,
} from "./core/split-pattern.js";
export type {
  SplitPatternType, SplitPattern, AxisMapping, VisualChannel,
  AxisRole, DimInfo, CellPosition, PatternLayout,
} from "./core/split-pattern.js";

// Signal Model
export {
  getPrefixRole, classifyByRole, validateSignal,
  DEMO_SIGNALS, SIGNAL_ROLE_LABELS, SIGNAL_ROLE_COLORS,
} from "./core/signal-model.js";
export type { SignalRole, SignalDef, SignalInstance, SignalValidation } from "./core/signal-model.js";

// Prefix Metadata
export { DEMO_PREFIX_META, formatDetail } from "./core/prefix-meta.js";
export type { PrefixMetadata, VisualShape, DetailKind, SourceLocation, SchemaDetail, EventDetail } from "./core/prefix-meta.js";

// Cross View
export { computeCrossViewLayout, matchEventToCells, PRESET_AXES, PRESET_VIEWS } from "./core/cross-view.js";
export type { AxisDef, ChannelAssignment, CrossViewDef, CrossCell, CrossViewLayout } from "./core/cross-view.js";

// View
export { ViewEngine } from "./view/view-engine.js";
export {
  buildServiceContainers, applyFilters, computeScopeLayouts,
  DEMO_SERVICES, ENV_FILTERS, TIER_NAMES,
} from "./view/service-scope.js";
export type { ServiceContainer, ServiceDef, AxisFilter, ScopeLayout } from "./view/service-scope.js";

// Effects
export { CellStateManager, BeamPool, ActivationProcessor } from "./effects/activation.js";
export type { BeamState, CellInfo } from "./effects/activation.js";

// Matrix
export { computeStackLayout, computeAllStacks, STACK_CHECKOUT, STACK_INFRA } from "./matrix/matrix-stack.js";
export type { StackLayout } from "./matrix/matrix-stack.js";

// Flow History
export { FlowHistory } from "./renderer/flow-history.js";
export type { FlowStep, FlowEntry } from "./renderer/flow-history.js";

// LOD
export { computeLodLevel, computeGroupLod, getLodVisibility, DEFAULT_LOD } from "./renderer/lod.js";
export type { LodThresholds, LodLevel, LodVisibility } from "./renderer/lod.js";

// Performance
export { PerfMonitor } from "./renderer/perf-stats.js";
export type { FrameStats } from "./renderer/perf-stats.js";

// Legend Builder
export { buildRoleLegend, buildCategoryLegend } from "./adapter/legend-builder.js";

// Adapter
export { MonitorAdapter, defaultKeyMapper } from "./adapter/monitor-adapter.js";
export type { DecodeFn, CellKeyMapper, AdapterConfig } from "./adapter/monitor-adapter.js";

// Browser Codec (encode/decode 단일 출처)
export { encode, decode, track, decodeContext, trackWithSignal } from "./adapter/browser-codec.js";
export type { BrowserCatalog, BrowserPrefixDef, BrowserDimDef, EncodeResult } from "./adapter/browser-codec.js";
export { BROWSER_CATALOG } from "./adapter/demo-catalog-browser.js";

// Flow Timeline
export { FlowTimeline } from "./adapter/flow-timeline.js";
export type { TimelineEntry } from "./adapter/flow-timeline.js";

// Demo Runner
export { DemoRunner } from "./adapter/demo-runner.js";

// Beam Renderer (Three.js — external로 처리됨)
export { ThreeBeamRenderer } from "./renderer/beam-renderer.js";
export type { BeamRendererOptions } from "./renderer/beam-renderer.js";

// Instanced Cell Renderer (Three.js — external)
export { updateInstancedColors } from "./renderer/instanced-cell-renderer.js";
export type { InstancedGridState, CellRenderOptions } from "./renderer/instanced-cell-renderer.js";

// Catalog Loader (API → Cache → Static)
export { loadCatalog } from "./adapter/catalog-loader.js";
export type { CatalogLoaderConfig, LoadResult } from "./adapter/catalog-loader.js";

// ── Browser ID Generators ──────────────────────────
// @qa-sdk/core의 ID 생성 함수를 브라우저에서 사용할 수 있도록 경량 구현.
// ULID 대신 crypto.randomUUID 기반 (브라우저 네이티브).

/** transmission_id 생성 (tx_ prefix) */
export function newTransmissionId(): string { return `tx_${crypto.randomUUID()}`; }
/** log_id 생성 (log_ prefix) */
export function newLogId(): string { return `log_${crypto.randomUUID()}`; }
/** trace_id 생성 (trc_ prefix) */
export function newTraceId(): string { return `trc_${crypto.randomUUID().slice(0, 12)}`; }
/** span_id 생성 (spn_ prefix) */
export function newSpanId(): string { return `spn_${crypto.randomUUID().slice(0, 8)}`; }
/** session_id 생성 (ses_ prefix) */
export function newSessionId(): string { return `ses_${crypto.randomUUID().slice(0, 8)}`; }
