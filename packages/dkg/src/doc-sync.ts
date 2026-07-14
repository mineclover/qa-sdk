// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * Doc Sync — 문서가 코드 상태와 일치하는지 검증하고, 최신 값을 생성한다.
 *
 * 문서에 하드코딩된 숫자(축 수, prefix 수, 노드 수 등)를
 * DEMO_CATALOG + DKG에서 자동 파생하여 항상 정확하게 유지한다.
 *
 * md 파일에 <!-- dkg:axes_count --> 같은 마커를 넣으면
 * 이 도구가 실제 값으로 대체할 수 있다.
 */

import type { Catalog } from '@qa-sdk/core';
import type { GraphPort } from 'spec-schema';
import type { PrefixNode } from './dkg.types.js';

export interface DocSyncReport {
  readonly timestamp: string;
  /** DEMO_CATALOG에서 파생된 현재 값 */
  readonly catalog: {
    readonly axesCount: number;
    readonly prefixCount: number;
    readonly tableCount: number;
    readonly totalEntries: number;
    readonly totalCapacity: number;
    readonly axesList: readonly {
      id: string;
      name: string;
      entries: number;
      capacity: number;
      versions: number;
    }[];
    readonly prefixesList: readonly {
      id: string;
      name: string;
      dims: number;
      category: string;
      versions: number;
    }[];
  };
  /** DKG GraphRegistry에서 파생된 현재 값 */
  readonly dkg: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly nodesByKind: Record<string, number>;
    readonly prefixesByCategory: Record<string, string[]>;
  };
  /** 문서에 쓸 수 있는 markdown 스니펫 */
  readonly snippets: Record<string, string>;
}

/**
 * 현재 코드 상태에서 문서용 리포트를 생성한다.
 * 이 리포트의 값이 문서의 SSOT.
 */
export function generateDocSyncReport(catalog: Catalog, graph: GraphPort): DocSyncReport {
  // Catalog
  const axesList = Object.entries(catalog.axes).map(([id, axis]) => {
    const versions = Object.keys(axis.versions);
    const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions];
    return {
      id,
      name: axis.name,
      entries: latest.entries?.length ?? 0,
      capacity: latest.capacity ?? latest.entries?.length ?? 0,
      versions: versions.length,
    };
  });

  const prefixesList = Object.entries(catalog.prefixes).map(([id, p]) => {
    const prefixNode = graph.getNode(id) as PrefixNode | undefined;
    return {
      id,
      name: p.name,
      dims: Object.keys(p.dims).length,
      category: prefixNode?.category ?? 'entity',
      versions: p.versions.length,
    };
  });

  // DKG
  const nodesByKind: Record<string, number> = {};
  for (const kind of [
    'axis',
    'prefix',
    'spec',
    'schema',
    'decision',
    'version-event',
    'constraint',
    'observation',
    'domain',
    'consumer',
    'intent-link',
    'dsl-bundle',
  ] as const) {
    const count = graph.getNodesByKind(kind).length;
    if (count > 0) nodesByKind[kind] = count;
  }

  const prefixesByCategory: Record<string, string[]> = {};
  for (const [cat, nodes] of Object.entries(graph.groupPrefixesByCategory())) {
    prefixesByCategory[cat] = nodes.map((n) => n.id);
  }

  // Snippets
  const snippets: Record<string, string> = {
    axes_count: String(axesList.length),
    prefix_count: String(prefixesList.length),
    table_count: String(Object.keys(catalog.tables ?? {}).length),
    total_entries: String(axesList.reduce((s, a) => s + a.entries, 0)),
    total_capacity: String(axesList.reduce((s, a) => s + a.capacity, 0)),
    dkg_node_count: String(graph.nodeCount),
    dkg_edge_count: String(graph.edgeCount),
    dkg_node_kinds: String(Object.keys(nodesByKind).length),
    category_list: Object.entries(prefixesByCategory)
      .map(([cat, ids]) => `[${cat}] ${ids.join(', ')}`)
      .join('\n'),
    prefix_table: prefixesList
      .map((p) => `| ${p.id} | ${p.name} | ${p.category} | ${p.dims} | ${p.versions} |`)
      .join('\n'),
    axes_table: axesList
      .map((a) => `| ${a.id} | ${a.name} | ${a.entries} | ${a.capacity} | ${a.versions} |`)
      .join('\n'),
  };

  return {
    timestamp: new Date().toISOString(),
    catalog: {
      axesCount: axesList.length,
      prefixCount: prefixesList.length,
      tableCount: Object.keys(catalog.tables ?? {}).length,
      totalEntries: axesList.reduce((s, a) => s + a.entries, 0),
      totalCapacity: axesList.reduce((s, a) => s + a.capacity, 0),
      axesList,
      prefixesList,
    },
    dkg: {
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      nodesByKind,
      prefixesByCategory,
    },
    snippets,
  };
}
