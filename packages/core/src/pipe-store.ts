/**
 * PipeGraphStore — PipeGraph CRUD 포트 + 인메모리 어댑터
 *
 * 기존 qa-sdk 포트 패턴 (RecordStore, ScenarioSpecStore)과 동일.
 */

import type { PipeSpec, PipeGraph } from "./types/pipe-spec.js";

// ── 포트 ─────────────────────────────────────────────

export interface PipeGraphStore {
  /** PipeGraph 저장 (같은 graphId+version이면 덮어쓰기) */
  save(graph: PipeGraph): void;

  /** graphId + version으로 조회 */
  get(graphId: string, version: string): PipeGraph | null;

  /** graphId의 최신 버전 조회 */
  getLatest(graphId: string): PipeGraph | null;

  /** graphId의 전체 버전 목록 */
  listVersions(graphId: string): PipeGraph[];

  /** 전체 그래프 목록 (최신 버전만) */
  listAll(): PipeGraph[];

  /** 삭제 */
  remove(graphId: string, version: string): boolean;

  /** 특정 pipeId를 포함하는 그래프 검색 */
  findByPipeId(pipeId: string): PipeGraph[];

  /** 특정 eventKey를 트리거로 가진 파이프가 속한 그래프 검색 */
  findByTriggerEvent(eventKey: string): PipeGraph[];
}

export interface PipeSpecStore {
  /** PipeSpec 개별 저장 (그래프 없이 독립 관리) */
  save(spec: PipeSpec): void;

  /** pipeId + version으로 조회 */
  get(pipeId: string, version: string): PipeSpec | null;

  /** pipeId의 최신 버전 */
  getLatest(pipeId: string): PipeSpec | null;

  /** 전체 목록 */
  listAll(): PipeSpec[];

  /** 삭제 */
  remove(pipeId: string, version: string): boolean;
}

// ── 인메모리 어댑터 ──────────────────────────────────

export class MemoryPipeGraphStore implements PipeGraphStore {
  private readonly graphs: Map<string, PipeGraph> = new Map();

  private key(graphId: string, version: string): string {
    return `${graphId}:${version}`;
  }

  save(graph: PipeGraph): void {
    this.graphs.set(this.key(graph.graphId, graph.version), graph);
  }

  get(graphId: string, version: string): PipeGraph | null {
    return this.graphs.get(this.key(graphId, version)) ?? null;
  }

  getLatest(graphId: string): PipeGraph | null {
    const versions = this.listVersions(graphId);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  listVersions(graphId: string): PipeGraph[] {
    const result: PipeGraph[] = [];
    for (const graph of this.graphs.values()) {
      if (graph.graphId === graphId) result.push(graph);
    }
    return result.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  }

  listAll(): PipeGraph[] {
    const latestMap = new Map<string, PipeGraph>();
    for (const graph of this.graphs.values()) {
      const existing = latestMap.get(graph.graphId);
      if (!existing || graph.version.localeCompare(existing.version, undefined, { numeric: true }) > 0) {
        latestMap.set(graph.graphId, graph);
      }
    }
    return [...latestMap.values()];
  }

  remove(graphId: string, version: string): boolean {
    return this.graphs.delete(this.key(graphId, version));
  }

  findByPipeId(pipeId: string): PipeGraph[] {
    const result: PipeGraph[] = [];
    for (const graph of this.graphs.values()) {
      if (graph.pipes.some(p => p.pipeId === pipeId)) result.push(graph);
    }
    return result;
  }

  findByTriggerEvent(eventKey: string): PipeGraph[] {
    const result: PipeGraph[] = [];
    for (const graph of this.graphs.values()) {
      if (graph.pipes.some(p => p.trigger.eventKey === eventKey)) result.push(graph);
    }
    return result;
  }
}

export class MemoryPipeSpecStore implements PipeSpecStore {
  private readonly specs: Map<string, PipeSpec> = new Map();

  private key(pipeId: string, version: string): string {
    return `${pipeId}:${version}`;
  }

  save(spec: PipeSpec): void {
    this.specs.set(this.key(spec.pipeId, spec.version), spec);
  }

  get(pipeId: string, version: string): PipeSpec | null {
    return this.specs.get(this.key(pipeId, version)) ?? null;
  }

  getLatest(pipeId: string): PipeSpec | null {
    const versions: PipeSpec[] = [];
    for (const spec of this.specs.values()) {
      if (spec.pipeId === pipeId) versions.push(spec);
    }
    versions.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  listAll(): PipeSpec[] {
    return [...this.specs.values()];
  }

  remove(pipeId: string, version: string): boolean {
    return this.specs.delete(this.key(pipeId, version));
  }
}
