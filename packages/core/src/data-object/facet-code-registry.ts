// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { PipeGraph } from '../types/pipe-spec.js';
import type { FacetCodeMapping } from './types.js';
import { collectFlowSteps } from '../pipe/pipe-fold.js';

// ── 포트 ────────────────────────────────────────────────

/** 패싯 ↔ 코드 매핑 저장소 포트 */
export interface FacetCodeStore {
  register(mapping: FacetCodeMapping): void;
  getByFacet(facet: string): FacetCodeMapping | null;
  getByFile(file: string): FacetCodeMapping[];
  getBySchema(schemaId: string): FacetCodeMapping[];
  listAll(): FacetCodeMapping[];
  remove(facet: string): boolean;
}

// ── 인메모리 어댑터 ────────────────────────────────────

export class FacetCodeRegistry implements FacetCodeStore {
  private readonly byFacet = new Map<string, FacetCodeMapping>();
  private readonly byFile = new Map<string, Set<string>>();
  private readonly bySchema = new Map<string, Set<string>>();

  register(mapping: FacetCodeMapping): void {
    if (this.byFacet.has(mapping.facet)) {
      throw new Error(`FacetCodeMapping already registered for facet: "${mapping.facet}"`);
    }

    this.byFacet.set(mapping.facet, mapping);

    for (const impl of mapping.implementations) {
      const facets = this.byFile.get(impl.file) ?? new Set<string>();
      facets.add(mapping.facet);
      this.byFile.set(impl.file, facets);
    }

    if (mapping.schemaId) {
      const facets = this.bySchema.get(mapping.schemaId) ?? new Set<string>();
      facets.add(mapping.facet);
      this.bySchema.set(mapping.schemaId, facets);
    }
  }

  getByFacet(facet: string): FacetCodeMapping | null {
    return this.byFacet.get(facet) ?? null;
  }

  getByFile(file: string): FacetCodeMapping[] {
    const facets = this.byFile.get(file);
    if (!facets) return [];
    return [...facets]
      .map((f) => this.byFacet.get(f))
      .filter((m): m is FacetCodeMapping => m !== undefined);
  }

  getBySchema(schemaId: string): FacetCodeMapping[] {
    const facets = this.bySchema.get(schemaId);
    if (!facets) return [];
    return [...facets]
      .map((f) => this.byFacet.get(f))
      .filter((m): m is FacetCodeMapping => m !== undefined);
  }

  listAll(): FacetCodeMapping[] {
    return [...this.byFacet.values()];
  }

  remove(facet: string): boolean {
    const mapping = this.byFacet.get(facet);
    if (!mapping) return false;

    this.byFacet.delete(facet);

    for (const impl of mapping.implementations) {
      const facets = this.byFile.get(impl.file);
      if (facets) {
        facets.delete(facet);
        if (facets.size === 0) this.byFile.delete(impl.file);
      }
    }

    if (mapping.schemaId) {
      const facets = this.bySchema.get(mapping.schemaId);
      if (facets) {
        facets.delete(facet);
        if (facets.size === 0) this.bySchema.delete(mapping.schemaId);
      }
    }

    return true;
  }
}

// ── PipeGraph에서 패싯 매핑 조회 ────────────────────────

export interface FacetResolution {
  pipeId: string;
  facet: string;
  mapping: FacetCodeMapping | null;
}

/** PipeGraph의 모든 step.facet → FacetCodeMapping 조회 */
export function resolveFacetMappings(
  graph: PipeGraph,
  registry: FacetCodeStore,
): FacetResolution[] {
  const results: FacetResolution[] = [];
  const seen = new Set<string>();

  for (const pipe of graph.pipes) {
    for (const step of collectFlowSteps(pipe.flow)) {
      const key = `${pipe.pipeId}:${step.facet}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        pipeId: pipe.pipeId,
        facet: step.facet,
        mapping: registry.getByFacet(step.facet),
      });
    }
  }

  return results;
}
