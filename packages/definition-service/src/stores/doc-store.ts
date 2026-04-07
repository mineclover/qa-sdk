import type { DefinitionServiceDatabase } from "../database.module.js";
import type {
  DocRecord,
  DocHistoryRecord,
  CodeReferenceRecord,
  DocIncomingLinkRecord,
  DocOutgoingLinkRecord,
} from "../core/types.js";
import type { DocStore, DocMetadataUpdate, DocListFilter } from "../core/interfaces.js";
import { decideVersion } from "../core/doc-versioner.js";
import { computeDocumentAddress } from "../core/compute-address.js";
import {
  documents,
  documentLinks,
  documentHistory,
  codeReferences,
} from "../db/schema.js";
import {
  eq,
  and,
  asc,
  desc,
  like,
  count,
  sql,
  type SQL,
} from "drizzle-orm";

/** Drizzle select 결과 → DocRecord 변환 */
type DocRow = typeof documents.$inferSelect;

function rowToDoc(row: DocRow): DocRecord {
  return {
    docId: row.docId,
    title: row.title || row.docId,
    docType: row.docType || undefined,
    knowledgeKind: row.knowledgeKind || undefined,
    level: row.level || undefined,
    scope: row.scope,
    aspect: row.aspect,
    depth: row.depth,
    lifecycle: row.lifecycle,
    layer: row.layer || undefined,
    tags: row.tagsJson,
    links: row.linksJson,
    svc: row.svc || undefined,
    docVersion: row.docVersion || undefined,
    revision: row.revision ?? undefined,
    address: row.address || undefined,
    targetPrefix: row.targetPrefix || undefined,
    version: row.version,
    bodyHash: row.bodyHash,
    purpose: row.purpose || undefined,
    intent: row.intent || undefined,
    context: row.context || undefined,
    caveat: row.caveat || undefined,
    gate: row.gateJson
      ? JSON.parse(row.gateJson) as DocRecord["gate"]
      : undefined,
    syncedAt: row.syncedAt,
    sourcePath: row.sourcePath || undefined,
  };
}

/** Drizzle select 결과 → DocHistoryRecord 변환 */
type HistoryRow = typeof documentHistory.$inferSelect;

function rowToHistory(row: HistoryRow): DocHistoryRecord {
  return {
    docId: row.docId,
    title: row.title || row.docId,
    docType: row.docType || undefined,
    knowledgeKind: row.knowledgeKind || undefined,
    level: row.level || undefined,
    scope: row.scope,
    aspect: row.aspect,
    depth: row.depth,
    lifecycle: row.lifecycle,
    layer: row.layer || undefined,
    tags: row.tagsJson,
    links: row.linksJson,
    svc: undefined,
    docVersion: row.docVersion || undefined,
    revision: row.revision ?? undefined,
    address: undefined,
    targetPrefix: undefined,
    version: row.version,
    bodyHash: row.bodyHash,
    purpose: row.purpose || undefined,
    intent: row.intent || undefined,
    context: row.context || undefined,
    caveat: row.caveat || undefined,
    gate: row.gateJson
      ? JSON.parse(row.gateJson) as DocRecord["gate"]
      : undefined,
    syncedAt: row.syncedAt,
    sourcePath: undefined,
    body: row.body,
    changeType: row.changeType as DocHistoryRecord["changeType"],
  };
}

/** drizzle/better-sqlite3 기반 문서 저장소 */
export class SqlDocStore implements DocStore {
  constructor(private readonly db: DefinitionServiceDatabase) {}

  private getSnapshotRow(docId: string): DocRow | undefined {
    return this.db
      .select()
      .from(documents)
      .where(eq(documents.docId, docId))
      .get();
  }

  private backfillLatestSnapshotBody(docId: string, body: string, syncedAt: string): void {
    const row = this.getSnapshotRow(docId);
    if (!row) return;
    if (row.body === body) return;

    this.db
      .update(documents)
      .set({
        body,
        syncedAt,
      })
      .where(eq(documents.docId, docId))
      .run();
  }

  upsert(
    doc: DocRecord,
    body: string,
  ): { action: "created" | "updated" | "unchanged"; version: number } {
    const existing = this.get(doc.docId);
    const decision = decideVersion(existing, doc);

    if (decision.action === "unchanged") {
      this.backfillLatestSnapshotBody(doc.docId, body, doc.syncedAt);
      return { action: "unchanged", version: decision.version };
    }

    const { version, changeType } = decision;
    const computedAddress = computeDocumentAddress(doc.scope, doc.aspect, doc.depth);

    const values = {
      docId: doc.docId,
      title: doc.title,
      docType: doc.docType ?? null,
      knowledgeKind: doc.knowledgeKind ?? null,
      level: doc.level ?? null,
      scope: doc.scope,
      aspect: doc.aspect,
      depth: doc.depth,
      lifecycle: doc.lifecycle,
      layer: doc.layer ?? null,
      tagsJson: doc.tags,
      linksJson: doc.links,
      svc: doc.svc ?? null,
      docVersion: doc.docVersion ?? null,
      revision: doc.revision ?? null,
      address: doc.address ?? computedAddress ?? null,
      targetPrefix: doc.targetPrefix ?? null,
      version,
      bodyHash: doc.bodyHash,
      body,
      purpose: doc.purpose ?? null,
      intent: doc.intent ?? null,
      context: doc.context ?? null,
      caveat: doc.caveat ?? null,
      gateJson: doc.gate ? JSON.stringify(doc.gate) : null,
      syncedAt: doc.syncedAt,
      sourcePath: doc.sourcePath ?? null,
    };

    this.db
      .insert(documents)
      .values(values)
      .onConflictDoUpdate({
        target: documents.docId,
        set: {
          title: values.title,
          docType: values.docType,
          knowledgeKind: values.knowledgeKind,
          level: values.level,
          scope: values.scope,
          aspect: values.aspect,
          depth: values.depth,
          lifecycle: values.lifecycle,
          layer: values.layer,
          tagsJson: values.tagsJson,
          linksJson: values.linksJson,
          svc: values.svc,
          docVersion: values.docVersion,
          revision: values.revision,
          address: values.address,
          targetPrefix: values.targetPrefix,
          version: values.version,
          bodyHash: values.bodyHash,
          body: values.body,
          purpose: values.purpose,
          intent: values.intent,
          context: values.context,
          caveat: values.caveat,
          gateJson: values.gateJson,
          syncedAt: values.syncedAt,
          sourcePath: values.sourcePath,
        },
      })
      .run();

    this.db
      .insert(documentHistory)
      .values({
        docId: doc.docId,
        version,
        title: values.title,
        docType: values.docType,
        knowledgeKind: values.knowledgeKind,
        level: values.level,
        scope: values.scope,
        aspect: values.aspect,
        depth: values.depth,
        lifecycle: values.lifecycle,
        layer: values.layer,
        tagsJson: values.tagsJson,
        linksJson: values.linksJson,
        docVersion: values.docVersion,
        revision: values.revision,
        bodyHash: values.bodyHash,
        body,
        purpose: values.purpose,
        intent: values.intent,
        context: values.context,
        caveat: values.caveat,
        gateJson: values.gateJson,
        changeType,
        syncedAt: values.syncedAt,
      })
      .run();

    this.syncLinks(doc.docId, doc.links);
    this.syncLinkAddresses(doc.docId, values.address ?? undefined);

    const action = changeType === "created" ? "created" as const : "updated" as const;
    return { action, version };
  }

  updateMetadata(
    docId: string,
    patch: DocMetadataUpdate,
  ): { action: "updated" | "unchanged"; version: number } | null {
    const existing = this.get(docId);
    if (!existing) return null;

    const updated: DocRecord = {
      ...existing,
      level: patch.level === null ? undefined : (patch.level ?? existing.level),
      scope: patch.scope ?? existing.scope,
      aspect: patch.aspect ?? existing.aspect,
      depth: patch.depth ?? existing.depth,
      lifecycle: patch.lifecycle ?? existing.lifecycle,
      layer: patch.layer === null ? undefined : (patch.layer ?? existing.layer),
      tags: patch.tags ?? existing.tags,
      links: patch.links ?? existing.links,
      svc: patch.svc === null ? undefined : (patch.svc ?? existing.svc),
      syncedAt: new Date().toISOString(),
    };

    // 변경 여부 확인
    const same =
      (updated.level ?? null) === (existing.level ?? null) &&
      updated.scope === existing.scope &&
      updated.aspect === existing.aspect &&
      updated.depth === existing.depth &&
      updated.lifecycle === existing.lifecycle &&
      (updated.layer ?? null) === (existing.layer ?? null) &&
      JSON.stringify(updated.tags) === JSON.stringify(existing.tags) &&
      JSON.stringify(updated.links) === JSON.stringify(existing.links) &&
      (updated.svc ?? null) === (existing.svc ?? null);

    if (same) return { action: "unchanged", version: existing.version };

    const version = existing.version + 1;
    const computedAddress = computeDocumentAddress(updated.scope, updated.aspect, updated.depth);

    const values = {
      docId: updated.docId,
      title: updated.title,
      docType: updated.docType ?? null,
      knowledgeKind: updated.knowledgeKind ?? null,
      level: updated.level ?? null,
      scope: updated.scope,
      aspect: updated.aspect,
      depth: updated.depth,
      lifecycle: updated.lifecycle,
      layer: updated.layer ?? null,
      tagsJson: updated.tags,
      linksJson: updated.links,
      svc: updated.svc ?? null,
      docVersion: updated.docVersion ?? null,
      revision: updated.revision ?? null,
      address: updated.address ?? computedAddress ?? null,
      targetPrefix: updated.targetPrefix ?? null,
      version,
      bodyHash: updated.bodyHash,
      purpose: updated.purpose ?? null,
      intent: updated.intent ?? null,
      context: updated.context ?? null,
      caveat: updated.caveat ?? null,
      gateJson: updated.gate ? JSON.stringify(updated.gate) : null,
      syncedAt: updated.syncedAt,
      sourcePath: updated.sourcePath ?? null,
    };

    this.db
      .insert(documents)
      .values(values)
      .onConflictDoUpdate({
        target: documents.docId,
        set: {
          title: values.title,
          docType: values.docType,
          knowledgeKind: values.knowledgeKind,
          level: values.level,
          scope: values.scope,
          aspect: values.aspect,
          depth: values.depth,
          lifecycle: values.lifecycle,
          layer: values.layer,
          tagsJson: values.tagsJson,
          linksJson: values.linksJson,
          svc: values.svc,
          docVersion: values.docVersion,
          revision: values.revision,
          address: values.address,
          targetPrefix: values.targetPrefix,
          version: values.version,
          bodyHash: values.bodyHash,
          purpose: values.purpose,
          intent: values.intent,
          context: values.context,
          caveat: values.caveat,
          gateJson: values.gateJson,
          syncedAt: values.syncedAt,
          sourcePath: values.sourcePath,
        },
      })
      .run();

    // history: body는 이전 버전에서 가져옴
    const lastHistory = this.db
      .select()
      .from(documentHistory)
      .where(
        and(
          eq(documentHistory.docId, docId),
          eq(documentHistory.version, existing.version),
        ),
      )
      .get();
    const body = lastHistory?.body ?? "";

    this.db
      .insert(documentHistory)
      .values({
        docId,
        version,
        title: values.title,
        docType: values.docType,
        knowledgeKind: values.knowledgeKind,
        level: values.level,
        scope: values.scope,
        aspect: values.aspect,
        depth: values.depth,
        lifecycle: values.lifecycle,
        layer: values.layer,
        tagsJson: values.tagsJson,
        linksJson: values.linksJson,
        docVersion: values.docVersion,
        revision: values.revision,
        bodyHash: values.bodyHash,
        body,
        purpose: values.purpose,
        intent: values.intent,
        context: values.context,
        caveat: values.caveat,
        gateJson: values.gateJson,
        changeType: "metadata_edit",
        syncedAt: values.syncedAt,
      })
      .run();

    this.syncLinks(docId, updated.links);
    this.syncLinkAddresses(docId, values.address ?? undefined);

    return { action: "updated", version };
  }

  delete(docId: string): boolean {
    const existing = this.get(docId);
    if (!existing) return false;

    this.db
      .delete(documentLinks)
      .where(
        sql`${documentLinks.sourceId} = ${docId} OR ${documentLinks.targetId} = ${docId}`,
      )
      .run();

    this.db
      .delete(codeReferences)
      .where(eq(codeReferences.docId, docId))
      .run();

    this.db
      .delete(documentHistory)
      .where(eq(documentHistory.docId, docId))
      .run();

    this.db
      .delete(documents)
      .where(eq(documents.docId, docId))
      .run();

    return true;
  }

  // ── Edge 동기화 ──────────────────────────────────

  private syncLinks(docId: string, links: { target: string; type: string }[]) {
    const sourceAddress = this.get(docId)?.address ?? null;
    this.db
      .delete(documentLinks)
      .where(eq(documentLinks.sourceId, docId))
      .run();

    for (const link of links) {
      const targetAddress = this.get(link.target)?.address ?? null;
      this.db
        .insert(documentLinks)
        .values({
          sourceId: docId,
          targetId: link.target,
          sourceAddress,
          targetAddress,
          linkType: link.type,
        })
        .onConflictDoNothing()
        .run();
    }
  }

  private syncLinkAddresses(docId: string, address?: string): void {
    const currentAddress = address ?? null;
    this.db
      .update(documentLinks)
      .set({ sourceAddress: currentAddress })
      .where(eq(documentLinks.sourceId, docId))
      .run();

    this.db
      .update(documentLinks)
      .set({ targetAddress: currentAddress })
      .where(eq(documentLinks.targetId, docId))
      .run();
  }

  // ── Link 쿼리 ──────────────────────────────────────────

  /** 특정 문서에서 나가는 링크 */
  getOutgoingLinks(docId: string): DocOutgoingLinkRecord[] {
    const sourceAddress = this.get(docId)?.address;
    return this.db
      .select({
        target: documentLinks.targetId,
        type: documentLinks.linkType,
        targetAddress: sql<string | null>`coalesce(${documentLinks.targetAddress}, ${documents.address})`,
      })
      .from(documentLinks)
      .leftJoin(documents, eq(documentLinks.targetId, documents.docId))
      .where(eq(documentLinks.sourceId, docId))
      .all()
      .map(r => ({
        target: r.target,
        type: r.type,
        ...(sourceAddress ? { sourceAddress } : {}),
        ...(r.targetAddress ? { targetAddress: r.targetAddress } : {}),
      }));
  }

  /** 특정 문서로 들어오는 링크 */
  getIncomingLinks(docId: string): DocIncomingLinkRecord[] {
    const targetAddress = this.get(docId)?.address;
    return this.db
      .select({
        source: documentLinks.sourceId,
        type: documentLinks.linkType,
        sourceAddress: sql<string | null>`coalesce(${documentLinks.sourceAddress}, ${documents.address})`,
      })
      .from(documentLinks)
      .leftJoin(documents, eq(documentLinks.sourceId, documents.docId))
      .where(eq(documentLinks.targetId, docId))
      .all()
      .map(r => ({
        source: r.source,
        type: r.type,
        ...(r.sourceAddress ? { sourceAddress: r.sourceAddress } : {}),
        ...(targetAddress ? { targetAddress } : {}),
      }));
  }

  /** contains 링크로 연결된 자식 문서 */
  getChildren(docId: string): DocRecord[] {
    const rows = this.db
      .select({
        doc: documents,
      })
      .from(documents)
      .innerJoin(
        documentLinks,
        eq(documentLinks.targetId, documents.docId),
      )
      .where(
        and(
          eq(documentLinks.sourceId, docId),
          eq(documentLinks.linkType, "contains"),
        ),
      )
      .orderBy(asc(documents.docId))
      .all();
    return rows.map(r => rowToDoc(r.doc));
  }

  /** contains 링크로 연결된 부모 문서 */
  getParent(docId: string): DocRecord | null {
    const row = this.db
      .select({
        doc: documents,
      })
      .from(documents)
      .innerJoin(
        documentLinks,
        eq(documentLinks.sourceId, documents.docId),
      )
      .where(
        and(
          eq(documentLinks.targetId, docId),
          eq(documentLinks.linkType, "contains"),
        ),
      )
      .limit(1)
      .get();
    return row ? rowToDoc(row.doc) : null;
  }

  get(docId: string): DocRecord | null {
    const row = this.getSnapshotRow(docId);
    return row ? rowToDoc(row) : null;
  }

  getByAddress(address: string): DocRecord | null {
    const row = this.db
      .select()
      .from(documents)
      .where(eq(documents.address, address))
      .get();
    return row ? rowToDoc(row) : null;
  }

  getBody(docId: string) {
    const row = this.getSnapshotRow(docId);
    if (!row) return null;
    return {
      docId: row.docId,
      body: row.body,
      bodyHash: row.bodyHash,
      docVersion: row.docVersion || undefined,
      revision: row.revision ?? undefined,
      sourcePath: row.sourcePath || undefined,
    };
  }

  replaceCodeReferences(references: CodeReferenceRecord[]): number {
    this.db.delete(codeReferences).run();
    if (references.length === 0) return 0;
    for (const ref of references) {
      this.db.insert(codeReferences).values({
        codePath: ref.codePath,
        docId: ref.docId,
        relationType: ref.relationType,
        sourceKind: ref.sourceKind,
        symbol: ref.symbol ?? "",
        line: ref.line ?? null,
      }).run();
    }
    return references.length;
  }

  listCodeReferences(): CodeReferenceRecord[] {
    return this.db
      .select()
      .from(codeReferences)
      .orderBy(asc(codeReferences.codePath), asc(codeReferences.docId), asc(codeReferences.relationType))
      .all()
      .map((row) => ({
        codePath: row.codePath,
        docId: row.docId,
        relationType: row.relationType as CodeReferenceRecord["relationType"],
        sourceKind: row.sourceKind as CodeReferenceRecord["sourceKind"],
        symbol: row.symbol || undefined,
        line: row.line ?? undefined,
      }));
  }

  getCodeReferencesByPath(codePath: string): CodeReferenceRecord[] {
    return this.db
      .select()
      .from(codeReferences)
      .where(eq(codeReferences.codePath, codePath))
      .orderBy(asc(codeReferences.docId), asc(codeReferences.relationType))
      .all()
      .map((row) => ({
        codePath: row.codePath,
        docId: row.docId,
        relationType: row.relationType as CodeReferenceRecord["relationType"],
        sourceKind: row.sourceKind as CodeReferenceRecord["sourceKind"],
        symbol: row.symbol || undefined,
        line: row.line ?? undefined,
      }));
  }

  list(filter?: DocListFilter): DocRecord[] {
    const conditions = this.buildConditions(filter);
    const limit = filter?.limit ?? 500;
    const offset = filter?.offset ?? 0;
    const orderByClause = this.resolveOrderBy(filter?.sort);

    const rows = this.db
      .select()
      .from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset)
      .all();
    return rows.map(rowToDoc);
  }

  /** 필터 조건에 매칭되는 전체 건수 (pagination용) */
  count(filter?: DocListFilter): number {
    const conditions = this.buildConditions(filter);

    const row = this.db
      .select({ cnt: count() })
      .from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get();
    return row?.cnt ?? 0;
  }

  private buildConditions(filter?: DocListFilter): SQL[] {
    const conditions: SQL[] = [];

    if (filter?.type) conditions.push(eq(documents.docType, filter.type));
    if (filter?.knowledgeKind) conditions.push(eq(documents.knowledgeKind, filter.knowledgeKind));
    if (filter?.level) conditions.push(eq(documents.level, filter.level));
    if (filter?.scope) conditions.push(eq(documents.scope, filter.scope));
    if (filter?.aspect) conditions.push(eq(documents.aspect, filter.aspect));
    if (filter?.depth) conditions.push(eq(documents.depth, filter.depth));
    if (filter?.lifecycle) conditions.push(eq(documents.lifecycle, filter.lifecycle));
    if (filter?.layer) conditions.push(eq(documents.layer, filter.layer));
    if (filter?.svc) conditions.push(eq(documents.svc, filter.svc));
    if (filter?.address) conditions.push(eq(documents.address, filter.address));
    if (filter?.tag) {
      conditions.push(like(documents.tagsJson, `%"${filter.tag}"%`));
    }

    return conditions;
  }

  private resolveOrderBy(sort?: string) {
    switch (sort) {
      case "synced_at": return asc(documents.syncedAt);
      case "synced_at_desc": return desc(documents.syncedAt);
      default: return asc(documents.docId);
    }
  }

  getHistory(docId: string, limit = 50): DocHistoryRecord[] {
    const rows = this.db
      .select()
      .from(documentHistory)
      .where(eq(documentHistory.docId, docId))
      .orderBy(desc(documentHistory.version))
      .limit(limit)
      .all();
    return rows.map(rowToHistory);
  }

  getVersion(docId: string, version: number): DocHistoryRecord | null {
    const row = this.db
      .select()
      .from(documentHistory)
      .where(
        and(
          eq(documentHistory.docId, docId),
          eq(documentHistory.version, version),
        ),
      )
      .get();
    return row ? rowToHistory(row) : null;
  }
}
