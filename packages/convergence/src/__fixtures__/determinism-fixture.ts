/**
 * 결정론 테스트 fixture — catalog에서 graph·usage 입력을 파생한다.
 *
 * convergence는 dkg를 import할 수 없으므로(의존 방향) GraphPort 최소 구현을 둔다.
 * 노드·엣지 구성은 dkg `deriveFromCatalog`의 axis/prefix/composes/references 규칙을 따른다.
 */

import type { Catalog } from '@qa-sdk/core';
import type { GraphEdgeLike, GraphNodeLike, GraphPort } from 'spec-schema';
import type { UsageData } from '../convergence.types.js';
import type { Clock } from '../clock.js';
import {
  analyzeSelfCheck,
  SELF_CHECK_PKG_NAMES,
  type SelfCheckResult,
} from '../self-check-analyzer.js';

const MAX_CASCADE_DEPTH = 8;

type FixtureNode = GraphNodeLike & Readonly<Record<string, unknown>>;

function categoryOf(node: GraphNodeLike): string | undefined {
  const category = (node as FixtureNode).category;
  return typeof category === 'string' ? category : undefined;
}

/** Map 기반 GraphPort — 테스트 전용 */
class InMemoryGraph implements GraphPort {
  private readonly nodes = new Map<string, GraphNodeLike>();
  private readonly edges: GraphEdgeLike[] = [];

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.length;
  }

  addNode(node: GraphNodeLike): void {
    this.nodes.set(node.id, node);
  }

  addEdge(type: string, from: string, to: string, meta?: Record<string, unknown>): void {
    this.edges.push(meta ? { type, from, to, meta } : { type, from, to });
  }

  getNode(id: string): GraphNodeLike | undefined {
    return this.nodes.get(id);
  }

  getNodeOrThrow(id: string): GraphNodeLike {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`노드 없음: ${id}`);
    return node;
  }

  getNodesByKind(kind: string): GraphNodeLike[] {
    return [...this.nodes.values()].filter((n) => n.kind === kind);
  }

  getAllNodes(): GraphNodeLike[] {
    return [...this.nodes.values()];
  }

  findNodes(kind: string, predicate?: (node: GraphNodeLike) => boolean): GraphNodeLike[] {
    return this.getNodesByKind(kind).filter((n) => predicate?.(n) ?? true);
  }

  edgesFrom(id: string, type?: string): readonly GraphEdgeLike[] {
    return this.edges.filter((e) => e.from === id && (type === undefined || e.type === type));
  }

  edgesTo(id: string, type?: string): readonly GraphEdgeLike[] {
    return this.edges.filter((e) => e.to === id && (type === undefined || e.type === type));
  }

  neighbors(id: string, type: string): string[] {
    return this.edgesFrom(id, type).map((e) => e.to);
  }

  intentLinksFor(): Array<{ id: string; intent: string; invariant?: string }> {
    return [];
  }

  cascadeFromAxis(
    axisId: string,
  ): Array<{ id: string; reason: 'composes' | 'references'; distance: number }> {
    const result: Array<{ id: string; reason: 'composes' | 'references'; distance: number }> = [];
    const visited = new Set<string>();
    let frontier = this.edgesTo(axisId, 'composes').map((e) => e.from);
    for (const p of frontier) {
      if (visited.has(p)) continue;
      visited.add(p);
      result.push({ id: p, reason: 'composes', distance: 1 });
    }
    for (let distance = 2; frontier.length > 0 && distance <= MAX_CASCADE_DEPTH; distance++) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const e of this.edgesTo(current, 'references')) {
          if (visited.has(e.from)) continue;
          visited.add(e.from);
          next.push(e.from);
          result.push({ id: e.from, reason: 'references', distance });
        }
      }
      frontier = next;
    }
    return result;
  }

  cascadeFromPrefix(): {
    domains: Array<{ id: string; affectedPrefixes: string[] }>;
    consumers: Array<{ id: string; via: string }>;
  } {
    return { domains: [], consumers: [] };
  }

  activeConstraints(): Array<{ constraintId: string; rule: string }> {
    return [];
  }

  getPrefixesByCategory(category: string): GraphNodeLike[] {
    return this.getNodesByKind('prefix').filter((n) => categoryOf(n) === category);
  }

  groupPrefixesByCategory(): Record<string, GraphNodeLike[]> {
    const groups: Record<string, GraphNodeLike[]> = {};
    for (const n of this.getNodesByKind('prefix')) {
      const key = categoryOf(n) ?? 'unknown';
      (groups[key] ??= []).push(n);
    }
    return groups;
  }
}

/** catalog의 axis·prefix에서 graph를 파생한다 */
function graphFromCatalog(catalog: Catalog): GraphPort {
  const g = new InMemoryGraph();
  for (const [id, axis] of Object.entries(catalog.axes)) {
    const node: FixtureNode = {
      kind: 'axis',
      id,
      name: axis.name,
      currentVersions: Object.keys(axis.versions),
    };
    g.addNode(node);
  }
  for (const [id, prefix] of Object.entries(catalog.prefixes)) {
    const node: FixtureNode = {
      kind: 'prefix',
      id,
      name: prefix.name,
      dimLabels: [...prefix.labels],
    };
    g.addNode(node);
    for (const [label, dimRef] of Object.entries(prefix.dims)) {
      if (dimRef.kind === 'axis' && dimRef.axisId) {
        g.addEdge('composes', id, dimRef.axisId, { dimKind: 'axis', label });
      } else if (dimRef.kind === 'prefix_ref' && dimRef.prefixId) {
        g.addEdge('composes', id, dimRef.prefixId, { dimKind: 'prefix_ref', label });
        g.addEdge('references', id, dimRef.prefixId, { label });
      } else if (dimRef.kind === 'table_ref' && dimRef.table) {
        g.addEdge('composes', id, dimRef.table, { dimKind: 'table_ref', label });
      }
    }
  }
  return g;
}

/** self-check 대상 패키지 전체 성공 결과 — SELF_CHECK_PKG_NAMES에서 파생 */
function allSuccessResults(): SelfCheckResult[] {
  return SELF_CHECK_PKG_NAMES.flatMap((pkg): SelfCheckResult[] => [
    { pkg, kind: 'build', result: 'success' },
    { pkg, kind: 'test', result: 'passed' },
  ]);
}

export interface DeterminismFixture {
  readonly catalog: Catalog;
  readonly graph: GraphPort;
  readonly usage: UsageData;
}

/**
 * 결정론 입력을 만든다. usage는 self-check 합성 이벤트에서 파생하므로
 * 레코드 timestamp도 clock으로 고정한다.
 */
export function buildDeterminismFixture(catalog: Catalog, clock: Clock): DeterminismFixture {
  const { usage } = analyzeSelfCheck(allSuccessResults(), catalog, 'determinism-fixture', {
    clock,
  });
  return { catalog, graph: graphFromCatalog(catalog), usage };
}
