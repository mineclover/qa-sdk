/**
 * DKG GraphRegistry — 노드/엣지 저장소 + 질의 API.
 *
 * GraphPort를 구현하는 구체 클래스.
 * - 순방향/역방향 인접 리스트로 O(1) 이웃 조회
 * - transitive 순회 지원 (깊이 제한 10)
 * - getNodesByKind<K>() → Extract<DkgNode, { kind: K }> 타입 안전 반환
 * - Table 의존 질의: getPrefixesForTable, getTablesForPrefix, cascadeFromTable
 * - FlowSchema 질의: cascadeFromFlowSchema
 *
 * CLI/skills는 이 클래스를 직접 사용하고,
 * convergence/schema 레이어는 GraphPort 인터페이스만 참조한다.
 */

import type { GraphPort } from "spec-schema";
import type { DkgNode, DkgNodeKind, DkgEdge, DkgEdgeType } from "./dkg.types.js";

const MAX_TRANSITIVE_DEPTH = 10;

export class GraphRegistry implements GraphPort {
  private readonly nodes = new Map<string, DkgNode>();
  private readonly forward = new Map<string, DkgEdge[]>();   // from → edges
  private readonly reverse = new Map<string, DkgEdge[]>();   // to → edges

  // ── Node operations ─────────────────────────────────────

  addNode(node: DkgNode): void {
    this.nodes.set(node.id, node);
  }

  /** 기존 노드를 교체 (엣지 유지, 노드만 업데이트) */
  replaceNode(node: DkgNode): void {
    this.nodes.set(node.id, node);
  }

  getNode(id: string): DkgNode | undefined {
    return this.nodes.get(id);
  }

  getNodeOrThrow(id: string): DkgNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`DKG node not found: "${id}"`);
    return node;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  getNodesByKind<K extends DkgNodeKind>(kind: K): Array<Extract<DkgNode, { kind: K }>> {
    return [...this.nodes.values()].filter((n): n is Extract<DkgNode, { kind: K }> => n.kind === kind);
  }

  getAllNodes(): DkgNode[] {
    return [...this.nodes.values()];
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  // ── Edge operations ─────────────────────────────────────

  addEdge(type: DkgEdgeType, from: string, to: string, meta?: Record<string, unknown>): void {
    const edge: DkgEdge = { type, from, to, ...(meta ? { meta } : {}) };

    const fwd = this.forward.get(from);
    if (fwd) fwd.push(edge);
    else this.forward.set(from, [edge]);

    const rev = this.reverse.get(to);
    if (rev) rev.push(edge);
    else this.reverse.set(to, [edge]);
  }

  /** from에서 출발하는 엣지 (순방향) */
  edgesFrom(id: string, type?: DkgEdgeType): readonly DkgEdge[] {
    const edges = this.forward.get(id) ?? [];
    return type ? edges.filter(e => e.type === type) : edges;
  }

  /** to로 도착하는 엣지 (역방향) */
  edgesTo(id: string, type?: DkgEdgeType): readonly DkgEdge[] {
    const edges = this.reverse.get(id) ?? [];
    return type ? edges.filter(e => e.type === type) : edges;
  }

  get edgeCount(): number {
    let count = 0;
    for (const edges of this.forward.values()) count += edges.length;
    return count;
  }

  // ── Query: 순방향 이웃 ───────────────────────────────────

  /** id에서 type 엣지로 연결된 노드 ID 목록 */
  neighbors(id: string, type: DkgEdgeType): string[] {
    return this.edgesFrom(id, type).map(e => e.to);
  }

  /** id로 type 엣지가 들어오는 노드 ID 목록 (역방향) */
  reverseNeighbors(id: string, type: DkgEdgeType): string[] {
    return this.edgesTo(id, type).map(e => e.from);
  }

  // ── Query: transitive 순회 ──────────────────────────────

  /**
   * id에서 type 엣지를 따라 transitive하게 도달 가능한 모든 노드.
   * BFS. 깊이 제한 MAX_TRANSITIVE_DEPTH. 중복 방지.
   */
  transitiveNeighbors(
    id: string,
    type: DkgEdgeType,
    direction: "forward" | "reverse" = "forward",
  ): Array<{ id: string; distance: number }> {
    const result: Array<{ id: string; distance: number }> = [];
    const visited = new Set<string>([id]);
    let frontier = [id];
    let distance = 0;

    while (frontier.length > 0 && distance < MAX_TRANSITIVE_DEPTH) {
      distance++;
      const next: string[] = [];

      for (const current of frontier) {
        const neighbors = direction === "forward"
          ? this.neighbors(current, type)
          : this.reverseNeighbors(current, type);

        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            next.push(n);
            result.push({ id: n, distance });
          }
        }
      }

      frontier = next;
    }

    return result;
  }

  // ── Query: cascade (composes + references 복합 순회) ────

  /**
   * axis 변경 시 영향받는 prefix를 cascade로 추적.
   *
   * 1단계: Axis ←composes── Prefix (직접 사용)
   * 2단계: 영향받는 Prefix ←references── Prefix (참조하는 prefix)
   * 2단계를 transitive하게 반복.
   */
  cascadeFromAxis(axisId: string): Array<{ id: string; reason: "composes" | "references"; distance: number }> {
    const result: Array<{ id: string; reason: "composes" | "references"; distance: number }> = [];
    const visited = new Set<string>();

    // 1단계: composes 역순회
    const directPrefixes = this.reverseNeighbors(axisId, "composes");
    for (const p of directPrefixes) {
      if (!visited.has(p)) {
        visited.add(p);
        result.push({ id: p, reason: "composes", distance: 1 });
      }
    }

    // 2단계: references 역순회 (transitive)
    let frontier = [...directPrefixes];
    let distance = 1;

    while (frontier.length > 0 && distance < MAX_TRANSITIVE_DEPTH) {
      distance++;
      const next: string[] = [];

      for (const current of frontier) {
        const referencing = this.reverseNeighbors(current, "references");
        for (const r of referencing) {
          if (!visited.has(r)) {
            visited.add(r);
            next.push(r);
            result.push({ id: r, reason: "references", distance });
          }
        }
      }

      frontier = next;
    }

    return result;
  }

  /**
   * prefix 변경 시 영향받는 domain + consumer를 추적.
   */
  cascadeFromPrefix(prefixId: string): {
    domains: Array<{ id: string; affectedPrefixes: string[] }>;
    consumers: Array<{ id: string; via: string }>;
  } {
    const domains: Array<{ id: string; affectedPrefixes: string[] }> = [];
    const consumers: Array<{ id: string; via: string }> = [];
    const seenConsumers = new Set<string>();

    // prefix ←contains── Domain
    const domainIds = this.reverseNeighbors(prefixId, "contains");
    for (const dId of domainIds) {
      const domainPrefixes = this.neighbors(dId, "contains");
      domains.push({ id: dId, affectedPrefixes: domainPrefixes });

      // Domain ←consumes── Consumer
      const domainConsumers = this.reverseNeighbors(dId, "consumes");
      for (const cId of domainConsumers) {
        if (!seenConsumers.has(cId)) {
          seenConsumers.add(cId);
          consumers.push({ id: cId, via: dId });
        }
      }
    }

    // prefix ←consumes── Consumer (도메인 밖 직접 소비)
    const directConsumers = this.reverseNeighbors(prefixId, "consumes");
    for (const cId of directConsumers) {
      if (!seenConsumers.has(cId)) {
        seenConsumers.add(cId);
        consumers.push({ id: cId, via: prefixId });
      }
    }

    return { domains, consumers };
  }

  /**
   * flow-schema 변경 시 직접/하위 subFlow를 따라 영향받는 axis/prefix를 추적.
   *
   * 1단계: FlowSchema ─composes→ Axis, ─observes→ Prefix
   * 2단계+: FlowSchema ─references→ subFlow 를 재귀 순회하며 동일 규칙 반복
   */
  cascadeFromFlowSchema(flowSchemaId: string): {
    axes: Array<{ id: string; reason: "composes" | "references"; distance: number }>;
    prefixes: Array<{ id: string; reason: "observes" | "references"; distance: number }>;
  } {
    const axes: Array<{ id: string; reason: "composes" | "references"; distance: number }> = [];
    const prefixes: Array<{ id: string; reason: "observes" | "references"; distance: number }> = [];
    const seenAxes = new Set<string>();
    const seenPrefixes = new Set<string>();
    const visitedFlows = new Set<string>();
    let frontier: Array<{ id: string; flowDistance: number }> = [{ id: flowSchemaId, flowDistance: 0 }];

    while (frontier.length > 0) {
      const next: Array<{ id: string; flowDistance: number }> = [];

      for (const current of frontier) {
        if (visitedFlows.has(current.id)) continue;
        visitedFlows.add(current.id);

        const directAxisDistance = current.flowDistance + 1;
        const axisReason = current.flowDistance === 0 ? "composes" : "references";
        for (const axisId of this.neighbors(current.id, "composes")) {
          if (!seenAxes.has(axisId)) {
            seenAxes.add(axisId);
            axes.push({ id: axisId, reason: axisReason, distance: directAxisDistance });
          }
        }

        const directPrefixDistance = current.flowDistance + 1;
        const prefixReason = current.flowDistance === 0 ? "observes" : "references";
        for (const prefixId of this.neighbors(current.id, "observes")) {
          if (!seenPrefixes.has(prefixId)) {
            seenPrefixes.add(prefixId);
            prefixes.push({ id: prefixId, reason: prefixReason, distance: directPrefixDistance });
          }
        }

        if (current.flowDistance >= MAX_TRANSITIVE_DEPTH) continue;

        for (const referencedId of this.neighbors(current.id, "references")) {
          const node = this.getNode(referencedId);
          if (node?.kind === "flow-schema" && !visitedFlows.has(referencedId)) {
            next.push({ id: referencedId, flowDistance: current.flowDistance + 1 });
          }
        }
      }

      frontier = next;
    }

    return { axes, prefixes };
  }

  // ── Query: constraint / intent-link 검사 ─────────────────

  /** 대상에 적용되는 활성 constraint 목록 */
  activeConstraints(targetId: string): Array<{ constraintId: string; rule: string }> {
    const edges = this.edgesTo(targetId, "constrains");
    const result: Array<{ constraintId: string; rule: string }> = [];

    for (const edge of edges) {
      const node = this.nodes.get(edge.from);
      if (node?.kind === "constraint" && node.lifecycle === "active") {
        result.push({ constraintId: node.id, rule: node.rule });
      }
    }

    return result;
  }

  /** 대상에 연결된 intent-link + invariant 목록 */
  intentLinksFor(targetId: string): Array<{ id: string; intent: string; invariant?: string }> {
    const edges = this.edgesTo(targetId, "binds");
    const result: Array<{ id: string; intent: string; invariant?: string }> = [];

    for (const edge of edges) {
      const node = this.nodes.get(edge.from);
      if (node?.kind === "intent-link") {
        result.push({ id: node.id, intent: node.intent, invariant: node.invariant });
      }
    }

    return result;
  }

  // ── Bulk query ──────────────────────────────────────────

  /** 특정 필터 조건으로 노드 검색 */
  findNodes<K extends DkgNodeKind>(
    kind: K,
    predicate?: (node: Extract<DkgNode, { kind: K }>) => boolean,
  ): Array<Extract<DkgNode, { kind: K }>> {
    const nodes = this.getNodesByKind(kind) as Array<Extract<DkgNode, { kind: K }>>;
    return predicate ? nodes.filter(predicate) : nodes;
  }

  // ── Category 기반 질의 ────────────────────────────────

  /** schema category별 prefix 목록 */
  getPrefixesByCategory(category: string): Array<Extract<DkgNode, { kind: "prefix" }>> {
    return this.findNodes("prefix", (n) => n.category === category);
  }

  /** 모든 prefix를 category별로 그룹핑 */
  groupPrefixesByCategory(): Record<string, Array<Extract<DkgNode, { kind: "prefix" }>>> {
    const groups: Record<string, Array<Extract<DkgNode, { kind: "prefix" }>>> = {};
    for (const node of this.getNodesByKind("prefix")) {
      const pn = node as Extract<DkgNode, { kind: "prefix" }>;
      const cat = pn.category ?? "entity";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(pn);
    }
    return groups;
  }

  // ── Table 의존 질의 ──────────────────────────────────

  /**
   * 테이블을 참조하는 prefix 목록.
   * prefix → table_ref dim으로 연결된 composes 엣지의 역방향.
   */
  getPrefixesForTable(tableId: string): Array<{ prefixId: string; dimLabel: string }> {
    return this.edgesTo(tableId, "composes")
      .filter(e => e.meta?.dimKind === "table_ref")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filter above guarantees meta exists
      .map(e => ({ prefixId: e.from, dimLabel: e.meta!.label as string }));
  }

  /**
   * prefix가 참조하는 테이블 목록.
   */
  getTablesForPrefix(prefixId: string): Array<{ tableId: string; dimLabel: string }> {
    return this.edgesFrom(prefixId, "composes")
      .filter(e => e.meta?.dimKind === "table_ref")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filter above guarantees meta exists
      .map(e => ({ tableId: e.to, dimLabel: e.meta!.label as string }));
  }

  /**
   * 테이블의 컬럼이 참조하는 축/prefix/테이블 (column-level edges).
   */
  getTableColumnRefs(tableId: string): Array<{
    column: string;
    targetId: string;
    refKind: "column_axis" | "prefix_ref" | "fk";
  }> {
    const result: Array<{ column: string; targetId: string; refKind: "column_axis" | "prefix_ref" | "fk" }> = [];

    for (const edge of this.edgesFrom(tableId)) {
      if (edge.meta?.dimKind === "column_axis") {
        result.push({ column: edge.meta.column as string, targetId: edge.to, refKind: "column_axis" });
      } else if (edge.meta?.column && edge.meta?.fk) {
        result.push({ column: edge.meta.column as string, targetId: edge.to, refKind: "fk" });
      } else if (edge.meta?.column && edge.type === "references") {
        const node = this.getNode(edge.to);
        if (node?.kind === "prefix") {
          result.push({ column: edge.meta.column as string, targetId: edge.to, refKind: "prefix_ref" });
        }
      }
    }

    return result;
  }

  /**
   * 테이블 변경 시 영향받는 전체 체인:
   *   table → prefixes (via table_ref dims) → services (via topology ownership)
   *
   * topology는 외부에서 주입.
   */
  cascadeFromTable(tableId: string): {
    prefixes: Array<{ prefixId: string; dimLabel: string }>;
    referencingTables: Array<{ id: string; column: string }>;
  } {
    const prefixes = this.getPrefixesForTable(tableId);

    // 이 테이블을 FK로 참조하는 다른 테이블
    const referencingTables: Array<{ id: string; column: string }> = [];
    for (const edge of this.edgesTo(tableId, "references")) {
      if (edge.meta?.fk) {
        referencingTables.push({ id: edge.from, column: edge.meta.column as string });
      }
    }

    return { prefixes, referencingTables };
  }
}
