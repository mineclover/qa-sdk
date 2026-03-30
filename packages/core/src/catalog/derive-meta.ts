/**
 * deriveMeta — prefix 구조에서 PrefixMeta를 추론.
 *
 * prefix.meta가 있으면 그대로 반환, 없으면 구조 기반 heuristic으로 추론.
 * 기존 inferSchemaCategory() + inferCategory() + LAYER_RULES 로직 통합.
 */

import type {
  PrefixDef, PrefixMeta, PrefixCategory,
  VisualShape, DetailKind, LayerLevel,
} from "./catalog.types.js";

/**
 * prefix의 PrefixMeta를 반환.
 * prefix.meta가 있으면 그대로, 없으면 구조에서 추론.
 */
export function deriveMeta(prefix: PrefixDef): PrefixMeta {
  if (prefix.meta) return prefix.meta;

  const category = inferCategory(prefix);
  const layer = inferLayer(prefix, category);
  const visualShape = inferVisualShape(category);
  const heightRatio = inferHeightRatio(visualShape);
  const detailKind = inferDetailKind(prefix, category);

  return { category, layer, visualShape, heightRatio, detailKind };
}

// ── Category 추론 ─────────────────────────────────────────────

function inferCategory(prefix: PrefixDef): PrefixCategory {
  const dimKinds = new Set(Object.values(prefix.dims).map(d => d.kind));
  const hasTableRef = dimKinds.has("table_ref");
  const labels = prefix.labels;

  // table_ref가 있거나 이름이 _event로 끝나면 이벤트
  if (hasTableRef || prefix.id.endsWith("_event")) return "event";

  // 관계형 모델: subjectKind/predicate 축
  if (labels.includes("subjectKind") || labels.includes("predicate")) return "relation";

  // 정책: role/action 축
  if (labels.includes("role") && labels.includes("action")) return "policy";
  if (labels.includes("role") && dimKinds.has("prefix_ref")) return "policy";

  // 관측: svc_ref + 관측성 축 패턴
  const observationAxes = new Set([
    "page", "resource_type", "http_method", "flow_name", "flow_step",
    "pipeline_phase", "validation_mode", "mask_mode",
  ]);
  if (dimKinds.has("prefix_ref") && labels.some(l => observationAxes.has(l))) {
    return "observation";
  }

  return "entity";
}

// ── Layer 추론 ────────────────────────────────────────────────

function inferLayer(prefix: PrefixDef, category: PrefixCategory): LayerLevel {
  const labels = prefix.labels;

  // UI 계층: 사용자 접점 축
  const uiAxes = ["page", "trackAction", "userType"];
  if (uiAxes.some(a => labels.includes(a)) && !labels.includes("pipeline_phase")) {
    return 0;
  }

  // 인프라 계층: 인프라/파이프라인 축
  const infraAxes = ["pipeline_phase", "deploy_action", "health_status"];
  if (infraAxes.some(a => labels.includes(a))) return 2;

  // 엔티티 중 서비스 컨텍스트 (모든 dim이 axis이고 인프라성 축 조합)
  if (category === "entity" && labels.includes("svc_name") && labels.includes("namespace")) {
    return 2;
  }

  // 기본: 비즈니스 계층
  return 1;
}

// ── VisualShape 추론 ──────────────────────────────────────────

function inferVisualShape(category: PrefixCategory): VisualShape {
  switch (category) {
    case "policy": return "thin-bar";
    case "event": return "flat-tile";
    case "relation": return "sphere";
    default: return "cube";
  }
}

// ── HeightRatio 추론 ──────────────────────────────────────────

function inferHeightRatio(shape: VisualShape): number {
  switch (shape) {
    case "thin-bar": return 0.3;
    case "flat-tile": return 0.5;
    case "column": return 1.5;
    default: return 1;
  }
}

// ── DetailKind 추론 ───────────────────────────────────────────

function inferDetailKind(prefix: PrefixDef, category: PrefixCategory): DetailKind {
  const labels = prefix.labels;
  const dimKinds = Object.values(prefix.dims).map(d => d.kind);
  const hasTableRef = dimKinds.includes("table_ref");

  if (category === "policy") return "permission";

  // table_ref가 있는 이벤트
  if (hasTableRef && category === "event") return "event-def";

  // 관측: 축 종류로 구분
  if (labels.includes("http_method") || labels.includes("resource_type")) return "endpoint";
  if (labels.includes("flow_name") || labels.includes("flow_step")) return "flow-step";
  if (labels.includes("pipeline_phase") || labels.includes("validation_mode")) return "metric";
  if (labels.includes("mask_mode") || labels.includes("deploy_action")) return "config";

  return "generic";
}
