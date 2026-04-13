import type {
  DefDataSource,
  DefDoc,
  DefinitionEntry,
  MemoryDefinitionRegistry,
} from "definition-catalog";
import type { GateDescriptor } from "quality-ledger";
import type { QualityGateSpec } from "work-domain";

export interface QualityTopologyDoc {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly level?: string;
  readonly scope: string;
  readonly aspect: string;
  readonly depth: string;
  readonly serviceId?: string;
  readonly tags?: readonly string[];
  readonly gate?: QualityGateSpec;
}

export type QualityGateTopologyDoc = QualityTopologyDoc & {
  readonly gate: QualityGateSpec;
};

export interface QualityGateTopology {
  readonly rootId: string;
  readonly containedDocs: readonly QualityTopologyDoc[];
  readonly gateDocs: readonly QualityGateTopologyDoc[];
  readonly gateDescriptors: readonly GateDescriptor[];
}

interface TopologyDocVersionOptions {
  readonly version?: number;
}

export function toQualityTopologyDoc(
  entry: DefinitionEntry,
  options: TopologyDocVersionOptions = {},
): QualityTopologyDoc {
  return {
    id: entry.id,
    title: entry.title,
    version: options.version ?? entry.revision ?? 1,
    level: entry.level,
    scope: entry.scope,
    aspect: entry.aspect,
    depth: entry.depth,
    serviceId: entry.serviceId,
    tags: entry.tags,
    gate: entry.gate,
  };
}

export function defDocToQualityTopologyDoc(
  doc: DefDoc,
): QualityTopologyDoc {
  return {
    id: doc.docId,
    title: doc.title ?? doc.docId,
    version: doc.version,
    level: doc.level,
    scope: doc.scope,
    aspect: doc.aspect,
    depth: doc.depth,
    serviceId: doc.svc,
    tags: doc.tags,
    gate: doc.gate,
  };
}

export function collectContainedQualityDocs(
  registry: MemoryDefinitionRegistry,
  rootId: string,
  options: TopologyDocVersionOptions = {},
): QualityTopologyDoc[] {
  const visited = new Set<string>();
  const collected: QualityTopologyDoc[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);

    const children = registry
      .getLinks(id, "outgoing")
      .filter((link) => link.linkType === "contains")
      .map((link) => registry.get(link.targetId))
      .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined);

    for (const child of children) {
      collected.push(toQualityTopologyDoc(child, options));
      visit(child.id);
    }
  }

  visit(rootId);
  return collected;
}

export async function collectContainedQualityDocsFromDataSource(
  source: Pick<DefDataSource, "getChildren">,
  rootId: string,
): Promise<QualityTopologyDoc[]> {
  const visited = new Set<string>();
  const collected: QualityTopologyDoc[] = [];

  async function visit(id: string): Promise<void> {
    if (visited.has(id)) return;
    visited.add(id);

    const children = await source.getChildren(id);
    for (const child of children) {
      collected.push(defDocToQualityTopologyDoc(child));
      await visit(child.docId);
    }
  }

  await visit(rootId);
  return collected;
}

export function collectQualityGateDocs(
  docs: readonly QualityTopologyDoc[],
): QualityGateTopologyDoc[] {
  return docs.filter(
    (doc): doc is QualityGateTopologyDoc => doc.gate !== undefined,
  );
}

export function toGateDescriptors(
  bundleId: string | null,
  docs: readonly QualityTopologyDoc[],
): GateDescriptor[] {
  return collectQualityGateDocs(docs).map((doc) => ({
    gateDocId: doc.id,
    docVersion: doc.version,
    bundleId,
  }));
}

export function resolveQualityGateTopology(
  registry: MemoryDefinitionRegistry,
  rootId: string,
  options: TopologyDocVersionOptions & { readonly bundleId?: string | null } = {},
): QualityGateTopology {
  const containedDocs = collectContainedQualityDocs(registry, rootId, options);
  const gateDocs = collectQualityGateDocs(containedDocs);
  const bundleId = options.bundleId === undefined ? rootId : options.bundleId;
  return {
    rootId,
    containedDocs,
    gateDocs,
    gateDescriptors: toGateDescriptors(bundleId, gateDocs),
  };
}
