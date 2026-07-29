// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { type DefDataSource, type DefDoc } from 'definition-catalog';

export type DomainRelationVia = 'contains' | 'refs' | 'refines←' | 'depends_on←';

export interface DomainRelation {
  readonly doc: DefDoc;
  readonly via: DomainRelationVia;
}

export interface DomainRelations {
  readonly members: readonly DomainRelation[];
  readonly consumers: readonly DomainRelation[];
}

export async function resolveDocId(
  source: DefDataSource,
  docId?: string,
  address?: string,
): Promise<string | null> {
  if (address) {
    const doc = await source.getByAddress(address);
    return doc?.docId ?? null;
  }
  return docId ?? null;
}

/** Resolve structural members and consumers without mixing their semantics. */
export async function collectDomainRelations(
  source: DefDataSource,
  parentId: string,
): Promise<DomainRelations> {
  const seenMembers = new Set<string>();
  const seenConsumers = new Set<string>();
  const members: DomainRelation[] = [];
  const consumers: DomainRelation[] = [];

  const appendMember = (doc: DefDoc | null | undefined, via: DomainRelationVia) => {
    if (!doc || doc.docId === parentId || seenMembers.has(doc.docId)) return;
    seenMembers.add(doc.docId);
    members.push({ doc, via });
  };

  const appendConsumer = (doc: DefDoc | null | undefined, via: DomainRelationVia) => {
    if (!doc || doc.docId === parentId) return;
    if (seenMembers.has(doc.docId) || seenConsumers.has(doc.docId)) return;
    seenConsumers.add(doc.docId);
    consumers.push({ doc, via });
  };

  for (const child of await source.getChildren(parentId)) appendMember(child, 'contains');

  const parent = await source.get(parentId);
  for (const link of parent?.links ?? []) {
    if (link.type === 'refs') appendMember(await source.get(link.target), 'refs');
  }

  for (const link of await source.getIncomingLinks(parentId)) {
    if (link.type === 'refines') appendMember(await source.get(link.source), 'refines←');
    if (link.type === 'depends_on') appendConsumer(await source.get(link.source), 'depends_on←');
  }

  const compare = (a: DomainRelation, b: DomainRelation) =>
    (a.doc.scope ?? '').localeCompare(b.doc.scope ?? '') || a.doc.docId.localeCompare(b.doc.docId);

  return {
    members: members.toSorted(compare),
    consumers: consumers.toSorted(compare),
  };
}

export async function collectDomainMembers(source: DefDataSource, parentId: string): Promise<DefDoc[]> {
  const relations = await collectDomainRelations(source, parentId);
  return relations.members
    .map((relation) => relation.doc)
    .toSorted(
      (a, b) => (a.scope ?? '').localeCompare(b.scope ?? '') || a.docId.localeCompare(b.docId),
    );
}
