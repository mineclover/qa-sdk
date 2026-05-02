// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * PipeGraph ↔ Definition Catalog 브릿지
 *
 * PipeSpec의 scope/aspect를 definition-catalog의 lifecycle/layer/tags와 연결.
 * definition-catalog 패키지에 직접 의존하지 않고, 타입만 정의하여 소비자가 주입.
 */

import type { PipeSpec, PipeGraph } from "../types/pipe-spec.js";
import type { DataObjectBinding } from "../data-object/types.js";
import { BindingRegistry } from "../data-object/registry.js";
import { collectFlowSteps } from "./pipe-fold.js";
import { normalizeEndpointPipeIds } from "./pipe-endpoint.js";

// ── definition metadata 타입 (definition-catalog 호환) ──

export type DefLifecycle = "draft" | "review" | "approved" | "deprecated" | "archived";
export type DefLayer = "domain" | "operation" | "mediation" | "experience";

/** definition 문서에서 가져온 메타데이터 */
export interface DefinitionMeta {
  readonly docId: string;
  readonly lifecycle: DefLifecycle;
  readonly layer?: DefLayer;
  readonly tags?: readonly string[];
}

/** definition 조회 포트 — 소비자가 구현 주입 */
export interface DefinitionLookup {
  /** scope×aspect로 관련 문서 조회 */
  findByCoordinate(scope: string, aspect: string): DefinitionMeta[];
  /** 문서 ID로 단건 조회 */
  getById(docId: string): DefinitionMeta | null;
}

// ── 브릿지 함수 ──────────────────────────────────────

/** 파이프별 lifecycle 조회 */
export interface PipeLifecycleInfo {
  pipeId: string;
  scope?: string;
  aspect?: string;
  lifecycle: DefLifecycle | "unknown";
  docId?: string;
}

/** PipeGraph의 각 파이프에 대해 definition lifecycle을 조회 */
export function resolveLifecycles(
  graph: PipeGraph,
  lookup: DefinitionLookup,
): PipeLifecycleInfo[] {
  return graph.pipes.map(pipe => resolveLifecycle(pipe, lookup));
}

function resolveLifecycle(pipe: PipeSpec, lookup: DefinitionLookup): PipeLifecycleInfo {
  if (!pipe.scope || !pipe.aspect) {
    return { pipeId: pipe.pipeId, lifecycle: "unknown" };
  }
  const docs = lookup.findByCoordinate(pipe.scope, pipe.aspect);
  if (docs.length === 0) {
    return { pipeId: pipe.pipeId, scope: pipe.scope, aspect: pipe.aspect, lifecycle: "unknown" };
  }
  // 가장 최신(approved 우선) 문서의 lifecycle
  const best = docs.find(d => d.lifecycle === "approved") ?? docs[0];
  return {
    pipeId: pipe.pipeId,
    scope: pipe.scope,
    aspect: pipe.aspect,
    lifecycle: best.lifecycle,
    docId: best.docId,
  };
}

// ── layer 영향 전파 ──────────────────────────────────

/** layer별 영향 전파 방향 규칙 (domain → operation → mediation → experience) */
const LAYER_ORDER: DefLayer[] = ["domain", "operation", "mediation", "experience"];

export interface LayerPropagation {
  sourcePipeId: string;
  sourceLayer: DefLayer;
  affectedPipeIds: string[];
  affectedLayer: DefLayer;
}

/** PipeGraph에서 layer 영향 전파 분석 */
export function analyzeLayerPropagation(
  graph: PipeGraph,
  lookup: DefinitionLookup,
): LayerPropagation[] {
  const results: LayerPropagation[] = [];
  const lifecycles = resolveLifecycles(graph, lookup);
  const layerMap = new Map<string, DefLayer>();

  for (const info of lifecycles) {
    if (info.scope && info.aspect) {
      const docs = lookup.findByCoordinate(info.scope, info.aspect);
      const doc = docs[0];
      if (doc?.layer) layerMap.set(info.pipeId, doc.layer);
    }
  }

  // 연결을 따라 layer 전파 확인
  for (const conn of graph.connections) {
    const froms = normalizeEndpointPipeIds(conn.from);
    const tos = normalizeEndpointPipeIds(conn.to);

    for (const from of froms) {
      const sourceLayer = layerMap.get(from);
      if (!sourceLayer) continue;

      const affected = tos.filter(to => {
        const targetLayer = layerMap.get(to);
        return targetLayer && canPropagate(sourceLayer, targetLayer);
      });

      if (affected.length > 0) {
        const targetLayer = layerMap.get(affected[0]);
        if (!targetLayer) {
          continue;
        }
        results.push({
          sourcePipeId: from,
          sourceLayer,
          affectedPipeIds: affected,
          affectedLayer: targetLayer,
        });
      }
    }
  }

  return results;
}

/** canonical: definition-catalog/impact.ts canPropagate와 동일 */
function canPropagate(source: DefLayer, target: DefLayer): boolean {
  if (source === "domain") return target !== "experience"; // domain → domain + operation + mediation
  if (source === "operation") return target === "operation"; // operation → 자기만
  if (source === "mediation") return target === "mediation" || target === "experience";
  return target === "experience"; // experience → 자기만
}

// ── tags 조회 ────────────────────────────────────────

export interface PipeTagInfo {
  pipeId: string;
  tags: string[];
  docId?: string;
}

/** PipeGraph의 각 파이프에 대해 definition tags를 조회 */
export function resolveTags(
  graph: PipeGraph,
  lookup: DefinitionLookup,
): PipeTagInfo[] {
  return graph.pipes.map(pipe => {
    if (!pipe.scope || !pipe.aspect) {
      return { pipeId: pipe.pipeId, tags: [] };
    }
    const docs = lookup.findByCoordinate(pipe.scope, pipe.aspect);
    if (docs.length === 0) {
      return { pipeId: pipe.pipeId, tags: [] };
    }
    const allTags = new Set<string>();
    for (const doc of docs) {
      for (const tag of doc.tags ?? []) allTags.add(tag);
    }
    return { pipeId: pipe.pipeId, tags: [...allTags], docId: docs[0].docId };
  });
}

// ── binding 조회 ─────────────────────────────────────

export interface PipeBindingInfo {
  pipeId: string;
  schemaIds: string[];
  bindings: DataObjectBinding[];
  missingSchemaIds: string[];
  warnings: string[];
}

/** PipeGraph의 각 파이프에 대해 binding registry 조회 */
export function resolveBindings(
  graph: PipeGraph,
  registry: BindingRegistry,
): PipeBindingInfo[] {
  return graph.pipes.map((pipe) => resolvePipeBindings(pipe, registry));
}

function resolvePipeBindings(
  pipe: PipeSpec,
  registry: BindingRegistry,
): PipeBindingInfo {
  const schemaIds = collectBindingSchemaIds(pipe, registry);
  const bindings: DataObjectBinding[] = [];
  const missingSchemaIds: string[] = [];

  for (const schemaId of schemaIds) {
    const binding = registry.getBySchema(schemaId);
    if (binding) {
      bindings.push(binding);
    } else {
      missingSchemaIds.push(schemaId);
    }
  }

  const warnings: string[] = [];
  if (bindings.length === 0) {
    warnings.push(`pipe "${pipe.pipeId}"에 binding 없음`);
  } else if (missingSchemaIds.length > 0) {
    warnings.push(`pipe "${pipe.pipeId}"의 schema binding 없음: ${missingSchemaIds.join(", ")}`);
  }

  return {
    pipeId: pipe.pipeId,
    schemaIds,
    bindings,
    missingSchemaIds,
    warnings,
  };
}

function collectBindingSchemaIds(
  pipe: PipeSpec,
  registry: BindingRegistry,
): string[] {
  const schemaIds = new Set<string>();

  for (const step of collectFlowSteps(pipe.flow)) {
    for (const access of step.dataContract?.accesses ?? []) {
      schemaIds.add(access.schemaId);
    }
  }

  if (schemaIds.size === 0 || registry.getBySchema(pipe.pipeId)) {
    schemaIds.add(pipe.pipeId);
  }

  return [...schemaIds];
}
