// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * @qa-sdk/viz-3d — 3D 큐브 매트릭스 시각화 패키지.
 *
 * 모듈:
 *   core/       — 타입 + GridBuilder (순수 계산)
 *   view/       — ViewEngine (뷰 모드 전환 + lerp)
 *   effects/    — ActivationSystem (glow/beam/ripple)
 *   matrix/     — MatrixStack (큐브 겹침/확장)
 *   adapter/    — MonitorAdapter (ingest 연결 + decode)
 */

// ── Core ──
export type {
  CategoryTheme, VizTheme, CellGridDef, CellState, CellRef,
  ViewMode, ViewPosition, StackAxis, MatrixStackDef,
  ActivationEvent, VizCallbacks, VizConfig,
} from "./core/types.js";
export { DEFAULT_THEME } from "./core/types.js";
export { buildGridPositions, computeStackPositions } from "./core/grid-builder.js";
export type { CellLayout, GridLayout, GridPositions } from "./core/grid-builder.js";

// ── Color Tokens ──
export { PALETTE, CATEGORY_COLORS, ROLE_COLORS, LAYER_COLORS, generateCssVariables, getThemeOverrides } from "./core/color-tokens.js";
export type { ColorToken, CategoryColor, RoleColor, ThemePreset } from "./core/color-tokens.js";

// ── Split Pattern ──
export {
  scalar, row, grid, cube, spine, shelf, nested,
  inferPattern, inferRole, extractAxes, extractDims, computePatternLayout,
} from "./core/split-pattern.js";
export type {
  SplitPatternType, SplitPattern, AxisMapping, VisualChannel,
  AxisRole, DimInfo, CellPosition, PatternLayout,
} from "./core/split-pattern.js";

// ── Signal Model ──
export {
  getPrefixRole, classifyByRole, validateSignal,
  DEMO_SIGNALS, SIGNAL_ROLE_LABELS, SIGNAL_ROLE_COLORS,
} from "./core/signal-model.js";
export type {
  SignalRole, SignalMember, SignalDef, SignalInstance, SignalValidation,
} from "./core/signal-model.js";

// ── Prefix Metadata ──
export { DEMO_PREFIX_META, formatDetail } from "./core/prefix-meta.js";
export type { PrefixMetadata, VisualShape, DetailKind, SourceLocation, SchemaDetail, SchemaColumn, EventDetail, EventSlot } from "./core/prefix-meta.js";

// ── Cross View ──
export { computeCrossViewLayout, matchEventToCells, PRESET_AXES, PRESET_VIEWS } from "./core/cross-view.js";
export type { AxisDef, ChannelAssignment, CrossViewDef, CrossCell, CrossViewLayout } from "./core/cross-view.js";

// ── View ──
export { ViewEngine } from "./view/view-engine.js";
export type { ViewTarget } from "./view/view-engine.js";

// ── Service Scope ──
export {
  buildServiceContainers, applyFilters, filterContainer, computeScopeLayouts,
  DEMO_SERVICES, ENV_FILTERS, TIER_NAMES,
} from "./view/service-scope.js";
export type {
  EventTier, ServiceContainer, ServiceTierEntry, DataEntry,
  AxisFilter, ServiceScopeConfig, ServiceDef, PrefixInfo, ScopeLayout,
} from "./view/service-scope.js";

// ── Effects ──
export { CellStateManager, BeamPool, ActivationProcessor } from "./effects/activation.js";
export type { BeamState, CellInfo } from "./effects/activation.js";

// ── Matrix ──
export { computeStackLayout, computeAllStacks, STACK_CHECKOUT, STACK_INFRA, STACK_BY_SERVICE } from "./matrix/matrix-stack.js";
export type { StackLayout } from "./matrix/matrix-stack.js";

// ── Renderer (Three.js) ──
export { createScene, updateScene, getCellWorldPosition, pickCell } from "./renderer/scene-builder.js";
export type { CellMesh, SceneState, DisplaySettings } from "./renderer/scene-builder.js";
export { FlowHistory } from "./renderer/flow-history.js";
export type { FlowStep, FlowEntry } from "./renderer/flow-history.js";

// ── Instanced Rendering ──
export { createInstancedGrid, updateInstancedGrid, activateCell, countDrawCalls } from "./renderer/instanced-grid.js";
export type { InstancedGridState } from "./renderer/instanced-grid.js";

// ── LOD ──
export { computeLodLevel, computeGroupLod, getLodVisibility, DEFAULT_LOD } from "./renderer/lod.js";
export type { LodThresholds, LodLevel, LodVisibility } from "./renderer/lod.js";

// ── Performance ──
export { PerfMonitor } from "./renderer/perf-stats.js";
export type { FrameStats } from "./renderer/perf-stats.js";

// ── Adapter ──
export { MonitorAdapter, defaultKeyMapper } from "./adapter/monitor-adapter.js";
export type { DecodeFn, CellKeyMapper, AdapterConfig } from "./adapter/monitor-adapter.js";
