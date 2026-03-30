/**
 * LocalDataSource — SQLite 직접 접근으로 definition 데이터 조회
 *
 * definition-service.sqlite를 읽기 전용으로 열어
 * DefDataSource 인터페이스를 구현한다. 서버 기동 불필요.
 */

import Database from "better-sqlite3";
import type {
  DefBoundaryContextResult,
  DefBoundaryResult,
  DefDataSource,
  DefDoc,
  DefIncomingLink,
  DefListFilter,
  DefValidationResult,
  DefinitionEntry,
  DefinitionLink,
} from "definition-catalog";
import {
  analyzeImpact,
  computeEffectiveConcerns,
  selectConcernContext,
  selectImpactContext,
} from "definition-catalog";
import {
  getFeedbackRequestSummariesForDoc,
  getSyntheticIncomingLinksForDoc,
} from "./review-feedback-source.js";

function rowToDoc(row: Record<string, unknown>): DefDoc {
  return {
    docId: row["doc_id"] as string,
    title: (row["title"] as string) || (row["doc_id"] as string),
    level: (row["level"] as string) || undefined,
    scope: row["scope"] as string,
    aspect: row["aspect"] as string,
    depth: row["depth"] as string,
    lifecycle: row["lifecycle"] as string,
    layer: (row["layer"] as string) || undefined,
    tags: JSON.parse((row["tags_json"] as string) || "[]"),
    links: JSON.parse((row["links_json"] as string) || "[]"),
    svc: (row["svc"] as string) || undefined,
    address: (row["address"] as string) || undefined,
    version: row["version"] as number,
    purpose: (row["purpose"] as string) || undefined,
    intent: (row["intent"] as string) || undefined,
    context: (row["context"] as string) || undefined,
    caveat: (row["caveat"] as string) || undefined,
    gate: row["gate_json"] ? JSON.parse(row["gate_json"] as string) as DefDoc["gate"] : undefined,
    sourcePath: (row["source_path"] as string) || undefined,
  };
}

export class LocalDataSource implements DefDataSource {
  readonly mode = "local" as const;
  private readonly db: Database.Database;
  private readonly cwd: string;

  constructor(dbPath: string, cwd: string = process.cwd()) {
    this.db = new Database(dbPath, { readonly: true });
    this.cwd = cwd;
  }

  async get(docId: string): Promise<DefDoc | null> {
    const row = this.db.prepare("SELECT * FROM documents WHERE doc_id = ?").get(docId) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  async list(filter?: DefListFilter): Promise<DefDoc[]> {
    // 전문 검색 — 한글 토크나이저 보정: 각 단어에 * 와일드카드 추가
    if (filter?.q) {
      const ftsQuery = filter.q
        .split(/\s+/)
        .filter(t => t.length > 0)
        .map(t => t.endsWith("*") ? t : `${t}*`)
        .join(" ");
      const stmt = this.db.prepare(`
        SELECT d.* FROM documents d
        JOIN documents_fts fts ON fts.doc_id = d.doc_id
        WHERE documents_fts MATCH ?
        LIMIT ?
      `);
      return (stmt.all(ftsQuery, filter?.limit ?? 50) as Record<string, unknown>[]).map(rowToDoc);
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.scope) { conditions.push("scope = ?"); params.push(filter.scope); }
    if (filter?.aspect) { conditions.push("aspect = ?"); params.push(filter.aspect); }
    if (filter?.depth) { conditions.push("depth = ?"); params.push(filter.depth); }
    if (filter?.lifecycle) { conditions.push("lifecycle = ?"); params.push(filter.lifecycle); }
    if (filter?.layer) { conditions.push("layer = ?"); params.push(filter.layer); }
    if (filter?.level) { conditions.push("level = ?"); params.push(filter.level); }
    if (filter?.svc) { conditions.push("svc = ?"); params.push(filter.svc); }
    if (filter?.address) { conditions.push("address = ?"); params.push(filter.address); }
    if (filter?.tag) { conditions.push("tags_json LIKE ?"); params.push(`%"${filter.tag}"%`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter?.limit ?? 500;
    const offset = filter?.offset ?? 0;
    const stmt = this.db.prepare(`SELECT * FROM documents ${where} ORDER BY doc_id LIMIT ? OFFSET ?`);
    return (stmt.all(...params, limit, offset) as Record<string, unknown>[]).map(rowToDoc);
  }

  async getChildren(docId: string): Promise<DefDoc[]> {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN document_links dl ON dl.target_id = d.doc_id
      WHERE dl.source_id = ? AND dl.link_type = 'contains'
      ORDER BY d.doc_id
    `);
    return (stmt.all(docId) as Record<string, unknown>[]).map(rowToDoc);
  }

  async getParent(docId: string): Promise<DefDoc | null> {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN document_links dl ON dl.source_id = d.doc_id
      WHERE dl.target_id = ? AND dl.link_type = 'contains'
      LIMIT 1
    `);
    const row = stmt.get(docId) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  async getIncomingLinks(docId: string): Promise<DefIncomingLink[]> {
    const stmt = this.db.prepare("SELECT source_id, link_type FROM document_links WHERE target_id = ?");
    return (stmt.all(docId) as { source_id: string; link_type: string }[])
      .map(r => ({ source: r.source_id, type: r.link_type }));
  }

  async getSyntheticIncomingLinks(
    docId: string,
  ): Promise<Awaited<ReturnType<typeof getSyntheticIncomingLinksForDoc>>> {
    return getSyntheticIncomingLinksForDoc(this.cwd, docId);
  }

  async getOutgoingLinks(docId: string): Promise<{ target: string; type: string }[]> {
    const stmt = this.db.prepare("SELECT target_id, link_type FROM document_links WHERE source_id = ?");
    return (stmt.all(docId) as { target_id: string; link_type: string }[])
      .map(r => ({ target: r.target_id, type: r.link_type }));
  }

  async getFeedbackRequestsByDocId(
    docId: string,
    limit = 10,
  ): Promise<Awaited<ReturnType<typeof getFeedbackRequestSummariesForDoc>>> {
    return getFeedbackRequestSummariesForDoc(this.cwd, docId, limit);
  }

  async getBoundary(
    docId: string,
    level: "purpose" | "overview" = "overview",
  ): Promise<DefBoundaryResult | null> {
    const doc = await this.get(docId);
    if (!doc) return null;

    const scopeOrder = ["constraint", "state", "data", "feature", "flow", "interface", "ui"];
    const linkOrder = ["constrains", "depends_on", "refines"];
    const summary = (purpose?: string, overview?: string) =>
      (level === "purpose" ? purpose : (purpose ?? overview))
        ?.split("\n")[0]
        ?.trim() || "(요약 없음)";
    const scopeIndex = (scope: string) => {
      const idx = scopeOrder.indexOf(scope);
      return idx === -1 ? 999 : idx;
    };
    const linkIndex = (type: string) => {
      const idx = linkOrder.indexOf(type);
      return idx === -1 ? 999 : idx;
    };

    const children = (await this.getChildren(docId))
      .toSorted((left, right) =>
        scopeIndex(left.scope) - scopeIndex(right.scope) || left.docId.localeCompare(right.docId),
      )
      .map((child) => ({
        docId: child.docId,
        title: child.title ?? child.docId,
        scope: child.scope,
        aspect: child.aspect,
        depth: child.depth,
        summary: summary(child.purpose, child.context),
      }));

    const outgoing = (await this.getOutgoingLinks(docId))
      .filter((link) => link.type === "depends_on" || link.type === "constrains" || link.type === "refines")
      .toSorted((left, right) =>
        linkIndex(left.type) - linkIndex(right.type) || left.target.localeCompare(right.target),
      );

    const incoming = (await this.getIncomingLinks(docId))
      .filter((link) => link.type === "depends_on" || link.type === "constrains" || link.type === "refines")
      .toSorted((left, right) =>
        linkIndex(left.type) - linkIndex(right.type) || left.source.localeCompare(right.source),
      );

    return {
      boundary: {
        docId: doc.docId,
        title: doc.title ?? doc.docId,
        scope: doc.scope,
        aspect: doc.aspect,
        depth: doc.depth,
        lifecycle: doc.lifecycle,
        ...(doc.layer ? { layer: doc.layer } : {}),
        ...(doc.svc ? { svc: doc.svc } : {}),
        ...(doc.purpose ? { purpose: doc.purpose } : {}),
        ...(level === "overview" && doc.context ? { overview: doc.context } : {}),
      },
      members: children,
      couplings: {
        outgoing: await Promise.all(outgoing.map(async (link) => {
          const target = await this.get(link.target);
          return {
            type: link.type,
            target: link.target,
            summary: summary(target?.purpose, target?.context),
          };
        })),
        incoming: await Promise.all(incoming.map(async (link) => {
          const source = await this.get(link.source);
          return {
            type: link.type,
            source: link.source,
            summary: summary(source?.purpose, source?.context),
          };
        })),
      },
    };
  }

  async getBoundaryContext(
    docId: string,
    level: "purpose" | "overview" = "overview",
    mode: "direct" | "transitive" = "transitive",
  ): Promise<DefBoundaryContextResult | null> {
    const boundary = await this.getBoundary(docId, level);
    if (!boundary) return null;

    const entryCache = new Map<string, DefinitionEntry | undefined>();
    const linkCache = new Map<string, readonly DefinitionLink[]>();

    const getEntry = (id: string): DefinitionEntry | undefined => entryCache.get(id);
    const getLinks = (id: string, direction: "outgoing" | "incoming"): readonly DefinitionLink[] =>
      linkCache.get(`${direction}:${id}`) ?? [];

    const seedIds = mode === "transitive"
      ? new Set((await this.list({ limit: 10000 })).map((doc) => doc.docId))
      : new Set<string>([
          docId,
          ...boundary.members.map((member) => member.docId),
          ...boundary.couplings.outgoing.map((coupling) => coupling.target),
          ...boundary.couplings.incoming.map((coupling) => coupling.source),
        ]);

    for (const id of seedIds) {
      const doc = await this.get(id);
      entryCache.set(
        id,
        doc
          ? {
              id: doc.docId,
              title: doc.title ?? doc.docId,
              scope: doc.scope as DefinitionEntry["scope"],
              aspect: doc.aspect as DefinitionEntry["aspect"],
              depth: doc.depth as DefinitionEntry["depth"],
              lifecycle: doc.lifecycle as DefinitionEntry["lifecycle"],
              layer: doc.layer as DefinitionEntry["layer"],
              tags: doc.tags,
              serviceId: doc.svc,
              address: 0,
              serialized: doc.address ?? "",
              createdAt: "",
              updatedAt: "",
            }
          : undefined,
      );

      linkCache.set(
        `outgoing:${id}`,
        (await this.getOutgoingLinks(id)).map((link) => ({
          sourceId: id,
          targetId: link.target,
          linkType: link.type as DefinitionLink["linkType"],
          address: 0,
          serialized: "",
        })),
      );
      linkCache.set(
        `incoming:${id}`,
        (await this.getIncomingLinks(id)).map((link) => ({
          sourceId: link.source,
          targetId: id,
          linkType: link.type as DefinitionLink["linkType"],
          address: 0,
          serialized: "",
        })),
      );
    }

    const concerns = selectConcernContext(
      computeEffectiveConcerns(docId, getEntry, getLinks),
      mode,
    );
    const impact = selectImpactContext(
      analyzeImpact(docId, getEntry, getLinks),
      mode,
    );
    const feedbackTrace = (
      await Promise.all(
        [docId, ...impact.impacted.map((item) => item.id)].map((id) =>
          this.getFeedbackRequestsByDocId(id, 20),
        ),
      )
    )
      .flat()
      .filter((item, index, items) => index === items.findIndex((candidate) => candidate.id === item.id));

    return {
      mode,
      level,
      boundary,
      concerns: {
        docId,
        direct: [...concerns.direct],
        inherited: concerns.inherited.map((item) => ({
          tag: item.concern,
          source: item.from,
          via: item.via,
        })),
        all: [...concerns.all],
      },
      impact: {
        sourceId: impact.sourceId,
        impacted: impact.impacted.map((item) => ({
          docId: item.id,
          via: item.via,
          path: item.path.join(" → "),
          direction: item.direction,
          distance: item.depth,
          ...(item.layer ? { layer: item.layer } : {}),
          crossLayer: item.crossLayer,
        })),
        affectedGroups: [...impact.affectedGroups],
        blastRadius: impact.blastRadius,
        byLayer: impact.byLayer,
      },
      feedbackTrace,
    };
  }

  async validate(): Promise<DefValidationResult> {
    const allDocs = await this.list({ limit: 10000 });
    const allIds = new Set(allDocs.map(d => d.docId));
    const referenced = new Set<string>();
    const issues: DefValidationResult["issues"] = [];

    for (const doc of allDocs) {
      if (doc.lifecycle === "deprecated") continue;
      const outgoing = await this.getOutgoingLinks(doc.docId);
      for (const link of outgoing) {
        referenced.add(link.target);
        if (!allIds.has(link.target)) {
          issues.push({ severity: "error", type: "broken-link", docId: doc.docId, message: `target "${link.target}" (${link.type})가 존재하지 않음` });
        }
      }
      const incoming = await this.getIncomingLinks(doc.docId);
      if (incoming.length > 0) referenced.add(doc.docId);
    }

    for (const doc of allDocs) {
      if (doc.lifecycle !== "approved") continue;
      if (!referenced.has(doc.docId)) {
        const outgoing = await this.getOutgoingLinks(doc.docId);
        if (!outgoing.some(l => l.type === "contains")) {
          issues.push({ severity: "warning", type: "orphan", docId: doc.docId, message: "approved 리프이지만 어디에도 참조되지 않음" });
        }
      }
    }

    const errors = issues.filter(i => i.severity === "error").length;
    const warnings = issues.filter(i => i.severity === "warning").length;
    return { issues, errors, warnings, passed: errors === 0 };
  }

  close() {
    this.db.close();
  }
}
