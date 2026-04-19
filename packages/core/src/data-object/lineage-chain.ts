// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 3단 계보 체인 조립 — 코드 → 패싯 → 데이터 → 좌표
 *
 * LineageCollector + FacetCodeStore + BindingRegistry를 연결하여
 * 전체 계보 체인을 조립한다.
 */

import type { FieldLineage, FieldRef, TransformKind } from "../types/data-schema.js";
import type { DataObjectBinding, FacetCodeRef } from "./types.js";
import type { FacetCodeStore } from "./facet-code-registry.js";
import type { BindingRegistry } from "./registry.js";
import { LineageCollector } from "../pipe/data-contract.js";

// ── 타입 ────────────────────────────────────────────────

export interface LineageChainNode {
  /** 데이터 필드 */
  field: FieldRef;
  /** 이 필드를 변환한 패싯 */
  facet?: string;
  /** 패싯의 소스 코드 위치 */
  codeRefs?: FacetCodeRef[];
  /** 이 필드의 좌표 바인딩 */
  binding?: DataObjectBinding;
  /** 변환 종류 */
  transform?: TransformKind;
}

export interface FullLineageChain {
  /** 최종 출력 */
  target: LineageChainNode;
  /** 기여한 입력들 (재귀적 역추적) */
  sources: LineageChainNode[];
  /** 체인 품질 */
  quality: {
    /** 좌표 바인딩 있는 노드 수 */
    bound: number;
    /** 바인딩 없는 노드 수 */
    unbound: number;
    /** 코드 매핑 있는 패싯 수 */
    mapped: number;
    /** 코드 매핑 없는 패싯 수 */
    unmapped: number;
  };
}

// ── 체인 조립 ───────────────────────────────────────────

/** 특정 필드의 전체 계보 체인을 조립한다 */
export function buildFullLineageChain(
  target: FieldRef,
  collector: LineageCollector,
  facetRegistry: FacetCodeStore,
  bindingRegistry: BindingRegistry,
): FullLineageChain {
  const origins = collector.traceOrigins(target);

  // target 노드 구성
  const targetNode = enrichNode(target, undefined, undefined, facetRegistry, bindingRegistry);

  // source 노드들 구성 — 모든 계보의 source를 수집하여 enrichment
  const sourceMap = new Map<string, LineageChainNode>();
  for (const lineage of origins) {
    for (const src of lineage.sources) {
      const key = `${src.schemaId}.${src.column}`;
      if (sourceMap.has(key)) continue;
      sourceMap.set(key, enrichNode(src, lineage.facet, lineage.transform, facetRegistry, bindingRegistry));
    }
  }
  const sources = [...sourceMap.values()];

  // quality 계산
  const allNodes = [targetNode, ...sources];
  const facetNodes = allNodes.filter(n => n.facet);

  return {
    target: targetNode,
    sources,
    quality: {
      bound: allNodes.filter(n => n.binding).length,
      unbound: allNodes.filter(n => !n.binding).length,
      mapped: facetNodes.filter(n => n.codeRefs && n.codeRefs.length > 0).length,
      unmapped: facetNodes.filter(n => !n.codeRefs || n.codeRefs.length === 0).length,
    },
  };
}

function enrichNode(
  field: FieldRef,
  facet: string | undefined,
  transform: TransformKind | undefined,
  facetRegistry: FacetCodeStore,
  bindingRegistry: BindingRegistry,
): LineageChainNode {
  const node: LineageChainNode = { field };

  if (facet) {
    node.facet = facet;
    const mapping = facetRegistry.getByFacet(facet);
    if (mapping && mapping.implementations.length > 0) {
      node.codeRefs = mapping.implementations;
    }
  }

  const binding = bindingRegistry.getBySchema(field.schemaId);
  if (binding) {
    node.binding = binding;
  }

  if (transform) {
    node.transform = transform;
  }

  return node;
}
