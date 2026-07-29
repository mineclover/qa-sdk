// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  type DefDataSource,
  type DefinitionEntry,
  type DefinitionLink,
  type DomainRootRegistry,
} from 'definition-catalog';

/** Materialize the source snapshot required by domain-root derivation. */
export async function buildDomainRootRegistry(source: DefDataSource): Promise<DomainRootRegistry> {
  const docs = await source.list({ limit: 10000 });
  const entries = new Map<string, DefinitionEntry>();
  const outgoingLinks = new Map<string, DefinitionLink[]>();
  const incomingLinks = new Map<string, DefinitionLink[]>();

  for (const doc of docs) {
    entries.set(doc.docId, {
      id: doc.docId,
      title: doc.title ?? doc.docId,
      tier: doc.tier as DefinitionEntry['tier'],
      scope: doc.scope as DefinitionEntry['scope'],
      aspect: doc.aspect as DefinitionEntry['aspect'],
      depth: doc.depth as DefinitionEntry['depth'],
      layer: doc.layer as DefinitionEntry['layer'],
      lifecycle: doc.lifecycle as DefinitionEntry['lifecycle'],
      owner_system: doc.ownerSystem,
      createdAt: '',
      updatedAt: '',
    });
  }

  for (const doc of docs) {
    for (const link of doc.links) {
      const definitionLink: DefinitionLink = {
        sourceId: doc.docId,
        targetId: link.target,
        linkType: link.type as DefinitionLink['linkType'],
      };
      const outgoing = outgoingLinks.get(doc.docId) ?? [];
      outgoing.push(definitionLink);
      outgoingLinks.set(doc.docId, outgoing);
      const incoming = incomingLinks.get(link.target) ?? [];
      incoming.push(definitionLink);
      incomingLinks.set(link.target, incoming);
    }
  }

  return {
    all: () => [...entries.values()],
    get: (id: string) => entries.get(id),
    getLinks: (id: string, direction: 'outgoing' | 'incoming' | 'both' = 'both') => {
      if (direction === 'outgoing') return outgoingLinks.get(id) ?? [];
      if (direction === 'incoming') return incomingLinks.get(id) ?? [];
      return [...(outgoingLinks.get(id) ?? []), ...(incomingLinks.get(id) ?? [])];
    },
  };
}
