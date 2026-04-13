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

export interface QualityGateDescriptorResolutionRef {
  readonly ref: string;
  readonly bundleId?: string | null;
  readonly directGateOnly?: boolean;
  readonly directChildGatesOnly?: boolean;
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

export async function resolveQualityGateDescriptorsFromDataSource(
  source: Pick<DefDataSource, "get" | "getChildren">,
  refs: readonly QualityGateDescriptorResolutionRef[],
): Promise<GateDescriptor[]> {
  const descriptors: GateDescriptor[] = [];
  const seenGateDocIds = new Set<string>();

  for (const ref of refs) {
    try {
      const resolved = await resolveQualityGateDescriptorsForRef(source, ref);
      for (const descriptor of resolved) {
        if (seenGateDocIds.has(descriptor.gateDocId)) continue;
        seenGateDocIds.add(descriptor.gateDocId);
        descriptors.push(descriptor);
      }
    } catch {
      // Descriptor resolution is sidecar topology discovery; callers decide how to report misses.
    }
  }

  return descriptors;
}

async function resolveQualityGateDescriptorsForRef(
  source: Pick<DefDataSource, "get" | "getChildren">,
  input: QualityGateDescriptorResolutionRef,
): Promise<GateDescriptor[]> {
  const docId = definitionDocRefCandidate(input.ref);
  if (!docId) return [];

  const root = await source.get(docId);
  if (!root) return [];
  if (root.gate) {
    return [{
      gateDocId: root.docId,
      docVersion: root.version,
      bundleId: input.bundleId ?? null,
    }];
  }
  if (input.directGateOnly) return [];

  return resolveQualityGateDescriptorsForContainer(
    source,
    root,
    input.bundleId,
    input.directChildGatesOnly === true,
  );
}

async function resolveQualityGateDescriptorsForContainer(
  source: Pick<DefDataSource, "get" | "getChildren">,
  root: DefDoc,
  bundleId: string | null | undefined,
  directChildGatesOnly = false,
): Promise<GateDescriptor[]> {
  const children = await source.getChildren(root.docId);
  const directGateDescriptors = children
    .filter((child) => child.gate !== undefined)
    .map((child): GateDescriptor => ({
      gateDocId: child.docId,
      docVersion: child.version,
      bundleId: bundleId === undefined ? root.docId : bundleId,
    }));
  if (directChildGatesOnly) {
    return directGateDescriptors;
  }
  const childBundles = children.filter(isQualityBundleDoc);
  if (bundleId === undefined && childBundles.length > 0) {
    const childBundleDescriptors = await Promise.all(
      childBundles.map(async (child) => {
        const containedDocs = await collectContainedQualityDocsFromDataSource(
          source,
          child.docId,
        );
        return toGateDescriptors(child.docId, containedDocs);
      }),
    );
    return [
      ...directGateDescriptors,
      ...childBundleDescriptors.flat(),
    ];
  }

  const containedDocs = await collectContainedQualityDocsFromDataSource(
    source,
    root.docId,
  );
  return toGateDescriptors(bundleId === undefined ? root.docId : bundleId, containedDocs);
}

function isQualityBundleDoc(doc: DefDoc): boolean {
  return doc.tags.includes("quality-bundle");
}

function definitionDocRefCandidate(ref: string): string | undefined {
  const strippedArtifact = ref.startsWith("artifact:")
    ? ref.slice("artifact:".length)
    : ref;
  const strippedWorkArea = strippedArtifact.startsWith("work-area:")
    ? strippedArtifact.slice("work-area:".length)
    : strippedArtifact;
  if (!strippedWorkArea || strippedWorkArea.includes("/") || strippedWorkArea.includes(":")) {
    return undefined;
  }
  return strippedWorkArea;
}
