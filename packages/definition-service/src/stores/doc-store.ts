import type { DefinitionServiceDatabase } from "../database.module.js";
import type { DocRecord, DocHistoryRecord } from "../core/types.js";
import type { DocStore, DocMetadataUpdate, DocListFilter } from "../core/interfaces.js";
import { decideVersion } from "../core/doc-versioner.js";
import { computeDocumentAddress } from "../core/compute-address.js";
import {
  documents,
  documentLinks,
  documentHistory,
} from "../db/schema.js";
import {
  eq,
  and,
  asc,
  desc,
  like,
  count,
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

  upsert(
    doc: DocRecord,
    body: string,
  ): { action: "created" | "updated" | "unchanged"; version: number } {
    const existing = this.get(doc.docId);
    const decision = decideVersion(existing, doc);

    if (decision.action === "unchanged") {
      return { action: "unchanged", version: decision.version };
    }

    const { version, changeType } = decision;
    const address = computeDocumentAddress(doc.scope, doc.aspect, doc.depth);

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
      address: address ?? doc.address ?? null,
      targetPrefix: doc.targetPrefix ?? null,
      version,
      bodyHash: doc.bodyHash,
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
    const address = computeDocumentAddress(updated.scope, updated.aspect, updated.depth);

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
      address: address ?? updated.address ?? null,
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

    return { action: "updated", version };
  }

  // ── Edge 동기화 ──────────────────────────────────

  private syncLinks(docId: string, links: { target: string; type: string }[]) {
    this.db
      .delete(documentLinks)
      .where(eq(documentLinks.sourceId, docId))
      .run();

    for (const link of links) {
      this.db
        .insert(documentLinks)
        .values({
          sourceId: docId,
          targetId: link.target,
          linkType: link.type,
        })
        .onConflictDoNothing()
        .run();
    }
  }

  // ── Link 쿼리 ──────────────────────────────────────────

  /** 특정 문서에서 나가는 링크 */
  getOutgoingLinks(docId: string): { target: string; type: string }[] {
    return this.db
      .select({
        target: documentLinks.targetId,
        type: documentLinks.linkType,
      })
      .from(documentLinks)
      .where(eq(documentLinks.sourceId, docId))
      .all()
      .map(r => ({ target: r.target, type: r.type }));
  }

  /** 특정 문서로 들어오는 링크 */
  getIncomingLinks(docId: string): { source: string; type: string }[] {
    return this.db
      .select({
        source: documentLinks.sourceId,
        type: documentLinks.linkType,
      })
      .from(documentLinks)
      .where(eq(documentLinks.targetId, docId))
      .all()
      .map(r => ({ source: r.source, type: r.type }));
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
    const row = this.db
      .select()
      .from(documents)
      .where(eq(documents.docId, docId))
      .get();
    return row ? rowToDoc(row) : null;
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
