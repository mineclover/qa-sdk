/**
 * DKG bootstrap enrichment — flow schema, headroom, overlap 분석 (logic tier).
 */

import type { Catalog } from '@qa-sdk/core';
import { analyzeGateStructure, identifyCoreGates, type FlowSchema } from 'decision-flow';
import {
  analyzeHeadroom,
  applyHeadroomDecisions,
  scanAxisOverlaps,
  comparePrefixes,
  recordSeparation,
  applySeparationRecord,
} from '@qa-sdk/convergence';
import type { GraphRegistry } from 'dkg';
import { attachFlowSchemaEdges } from 'dkg';
import type { BootstrapDkgOptions } from 'dkg';
import type { DecisionNode, DomainNode, FlowSchemaNode } from 'dkg';

export function enrichDkgGraph(graph: GraphRegistry, options: BootstrapDkgOptions): void {
  const catalog = options.catalog;
  const config = options.config;
  const date = options.date ?? '2026-03-20';
  const domains = config.domains;

  const flowSchemas = config.flowSchemas ?? [];
  const flowSchemaMap = new Map(
    flowSchemas.map((entry) => [entry.schema.id, entry.schema as FlowSchema]),
  );
  const flowSchemaTotalPaths = new Map<string, number>();

  for (const entry of flowSchemas) {
    const schema = entry.schema as FlowSchema;
    const gateProfiles = analyzeGateStructure(schema);
    const node: FlowSchemaNode = {
      kind: 'flow-schema',
      id: schema.id,
      name: schema.name,
      version: schema.version,
      gates: schema.gates.map((gate) => ({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        weight: gate.weight ?? 'tactical',
      })),
      totalPaths: resolveFlowSchemaTotalPaths(
        schema.id,
        flowSchemaMap,
        flowSchemaTotalPaths,
        new Set(),
      ),
      coreGateIds: identifyCoreGates(gateProfiles).map((profile) => profile.gateId),
    };
    graph.addNode(node);
  }

  for (const entry of flowSchemas) {
    const observedPrefixIds = dedupeIds(entry.observedPrefixIds ?? []);
    const axisIds = dedupeIds([
      ...deriveAxisIdsFromObservedPrefixes(catalog, observedPrefixIds),
      ...(entry.axisIds ?? []),
    ]);
    const domainId = entry.domainId ?? inferFlowSchemaDomainId(domains, observedPrefixIds);
    const subFlowIds = dedupeIds(
      entry.schema.gates.flatMap((gate) => (gate.subFlowId ? [gate.subFlowId] : [])),
    );

    attachFlowSchemaEdges(graph, {
      flowSchemaId: entry.schema.id,
      axisIds,
      observedPrefixIds,
      domainId,
      subFlowIds,
    });
  }

  const axisData = Object.entries(catalog.axes).map(([id, axis]) => {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1];
    const latest = axis.versions[latestKey];
    const entries = latest.entries.length;
    const capacity = latest.capacity ?? entries;
    return { id, name: axis.name, entries, capacity };
  });

  const headroomReport = analyzeHeadroom(axisData, { date, graph });
  applyHeadroomDecisions(graph, headroomReport);

  const entriesMap = new Map<string, readonly string[]>();
  for (const [id, axis] of Object.entries(catalog.axes)) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1];
    const latest = axis.versions[latestKey];
    entriesMap.set(id, [...latest.entries]);
  }

  const overlaps = scanAxisOverlaps(graph, entriesMap);
  for (const overlap of overlaps) {
    if (overlap.recommendation === 'merge' && overlap.overlapRatio >= 0.9) {
      const record = recordSeparation(overlap, {
        id: `DEC-SEP-${overlap.a}-${overlap.b}`,
        date,
        rationale: `${overlap.a}(${getUsedBy(graph, overlap.a)})와 ${overlap.b}(${getUsedBy(graph, overlap.b)})는 entries가 동일하지만 다른 도메인 컨텍스트에서 사용된다. 향후 분기 가능성이 있으므로 분리 유지.`,
      });
      applySeparationRecord(graph, record);
    }
    const pairKey = [overlap.a, overlap.b].toSorted().join(':');
    if (pairKey === 'migration_pattern:verdict_result') {
      const dec: DecisionNode = {
        kind: 'decision',
        id: 'DEC-SEP-verdict-migration',
        date,
        title: "verdict_result와 migration_pattern의 'unknown' 공유 수용",
        context: `두 축이 '${overlap.sharedEntries.join(',')}' entry를 공유 (${(overlap.overlapRatio * 100).toFixed(0)}%)`,
        rationale:
          "'unknown'은 범용 예약어로 두 축에서 독립적으로 사용됨. verdict의 unknown은 '판정 불가', migration의 unknown은 '패턴 미식별'. 의미가 다르므로 분리 유지.",
        lifecycle: 'active',
      };
      graph.addNode(dec);
      graph.addEdge('justifies', dec.id, 'verdict_result');
      graph.addEdge('justifies', dec.id, 'migration_pattern');
    }
  }

  const prefixIds = Object.keys(catalog.prefixes);
  for (const pair of config.reviewPairs ?? []) {
    if (prefixIds.includes(pair.a) && prefixIds.includes(pair.b)) {
      const sim = comparePrefixes(graph, pair.a, pair.b);
      if (sim.recommendation === 'review') {
        const dec: DecisionNode = {
          kind: 'decision',
          id: `DEC-SEP-${pair.a}-${pair.b}`,
          date,
          title: `${pair.a}과 ${pair.b} 분리 유지`,
          context: `구조 유사도 ${(sim.structuralSimilarity * 100).toFixed(0)}%: ${sim.sharedAxes.join(',')} 축 공유`,
          rationale: pair.reason,
          lifecycle: 'active',
        };
        graph.addNode(dec);
        graph.addEdge('justifies', dec.id, pair.a);
        graph.addEdge('justifies', dec.id, pair.b);
      }
    }
  }
}

function getUsedBy(graph: GraphRegistry, axisId: string): string {
  const prefixes = graph.reverseNeighbors(axisId, 'composes');
  return prefixes.join(',') || '미사용';
}

function dedupeIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function deriveAxisIdsFromObservedPrefixes(
  catalog: Catalog,
  prefixIds: readonly string[],
): string[] {
  const axisIds = new Set<string>();

  for (const prefixId of prefixIds) {
    const prefix = catalog.prefixes[prefixId];
    const latest = prefix?.versions[prefix.versions.length - 1];
    if (!prefix || !latest) continue;

    for (const label of prefix.labels) {
      const dim = prefix.dims[label];
      if (dim?.kind === 'axis') {
        axisIds.add(dim.axisId);
      }
    }
  }

  return [...axisIds];
}

function inferFlowSchemaDomainId(
  domains: readonly DomainNode[],
  observedPrefixIds: readonly string[],
): string | undefined {
  if (observedPrefixIds.length === 0) return undefined;

  const exactMatch = domains.find((domain) =>
    observedPrefixIds.every((prefixId) => domain.prefixes.includes(prefixId)),
  );
  if (exactMatch) return exactMatch.id;

  const partialMatch = domains.find((domain) =>
    observedPrefixIds.some((prefixId) => domain.prefixes.includes(prefixId)),
  );
  return partialMatch?.id;
}

function resolveFlowSchemaTotalPaths(
  schemaId: string,
  schemas: ReadonlyMap<string, FlowSchema>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const cached = memo.get(schemaId);
  if (cached !== undefined) return cached;
  if (visiting.has(schemaId)) {
    throw new Error(`FlowSchema subFlow cycle detected: ${schemaId}`);
  }

  const schema = schemas.get(schemaId);
  if (!schema) {
    throw new Error(`FlowSchema "${schemaId}" not found in DkgConfig.flowSchemas`);
  }

  visiting.add(schemaId);

  let totalPaths = 1;
  for (const gate of schema.gates) {
    if (gate.subFlowId) {
      totalPaths *= resolveFlowSchemaTotalPaths(gate.subFlowId, schemas, memo, visiting);
      continue;
    }

    totalPaths *= gate.branches?.length ?? 0;
  }

  visiting.delete(schemaId);
  memo.set(schemaId, totalPaths);
  return totalPaths;
}
