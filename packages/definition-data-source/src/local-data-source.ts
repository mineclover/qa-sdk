// @def.doc definition-data-source

/**
 * LocalDataSource — SQLite 직접 접근으로 definition 데이터 조회
 *
 * definition-service.sqlite를 읽기 전용으로 열어
 * DefDataSource 인터페이스를 구현한다. 서버 기동 불필요.
 */

import Database from "better-sqlite3";
import { isAbsolute, relative } from "node:path";
import type {
  DefBoundaryContextResult,
  DefBoundaryResolutionCandidate,
  DefBoundaryResult,
  DefCodeReference,
  DefDataSource,
  DefDoc,
  DefDocBody,
  DefFileBoundaryResolution,
  DefIncomingLink,
  DefListFilter,
  DefOutgoingLink,
  DefValidationResult,
  DefinitionEntry,
  DefinitionLink,
} from "definition-catalog";
import {
  analyzeImpact,
  computeEffectiveConcerns,
  docRowToRegistryInput,
  formatCodeReferenceTarget,
  makeCodeReferenceScopeKey,
  MemoryDefinitionRegistry,
  parseCodeReferenceTarget,
  selectConcernContext,
  selectImpactContext,
  validateGraph,
} from "definition-catalog";
import {
  getFeedbackRequestSummariesForDoc,
  getSyntheticIncomingLinksForDoc,
} from "./review-feedback-source.js";

function rowToDoc(row: Record<string, unknown>): DefDoc {
  return {
    docId: row["doc_id"] as string,
    title: (row["title"] as string) || (row["doc_id"] as string),
    type: (row["doc_type"] as string) || undefined,
    knowledgeKind: (row["knowledge_kind"] as string) || undefined,
    level: (row["level"] as string) || undefined,
    tier: (row["tier"] as string) || undefined,
    scope: (row["scope"] as string) || undefined,
    aspect: (row["aspect"] as string) || undefined,
    depth: (row["depth"] as string) || undefined,
    lifecycle: row["lifecycle"] as string,
    layer: (row["layer"] as string) || undefined,
    ownerSystem: (row["owner_system"] as string) || undefined,
    projectionPlane: (row["projection_plane"] as string) || undefined,
    intentHierarchy: (row["intent_hierarchy"] as string) || undefined,
    lineageFacet: (row["lineage_facet"] as string) || undefined,
    lineageKind: (row["lineage_kind"] as string) || undefined,
    tags: JSON.parse((row["tags_json"] as string) || "[]"),
    links: JSON.parse((row["links_json"] as string) || "[]"),
    svc: (row["svc"] as string) || undefined,
    docVersion: (row["doc_version"] as string) || undefined,
    revision: (row["revision"] as number | null) ?? undefined,
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

  async getByAddress(address: string): Promise<DefDoc | null> {
    const row = this.db.prepare("SELECT * FROM documents WHERE address = ?").get(address) as Record<string, unknown> | undefined;
    return row ? rowToDoc(row) : null;
  }

  async getBody(docId: string): Promise<DefDocBody | null> {
    const row = this.db
      .prepare(`
        SELECT doc_id, body, body_hash, doc_version, revision, source_path
        FROM documents
        WHERE doc_id = ?
      `)
      .get(docId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      docId: row["doc_id"] as string,
      body: (row["body"] as string) || "",
      bodyHash: (row["body_hash"] as string) || undefined,
      docVersion: (row["doc_version"] as string) || undefined,
      revision: (row["revision"] as number | null) ?? undefined,
      sourcePath: (row["source_path"] as string) || undefined,
    };
  }

  async resolveByFile(filePath: string): Promise<DefFileBoundaryResolution> {
    const requested = this.normalizeCodeReferenceTarget(filePath);
    const refs = this.db
      .prepare(`
        SELECT code_path, doc_id, relation_type, source_kind, symbol, line
        FROM code_references
        WHERE code_path = ?
        ORDER BY doc_id, relation_type
      `)
      .all(requested.codePath) as Array<Record<string, unknown>>;

    const references: DefCodeReference[] = refs.map((row) => ({
      codePath: row["code_path"] as string,
      docId: row["doc_id"] as string,
      relationType: row["relation_type"] as DefCodeReference["relationType"],
      sourceKind: row["source_kind"] as DefCodeReference["sourceKind"],
      symbol: (row["symbol"] as string) || undefined,
      line: (row["line"] as number | null) ?? undefined,
    }));

    const scopedReferences = requested.symbol
      ? references.filter((ref) => (ref.symbol ?? "") === requested.symbol || !ref.symbol)
      : references;

    if (scopedReferences.length === 0) {
      return { kind: "none", codePath: formatCodeReferenceTarget(requested), references: scopedReferences };
    }

    const supportingDocs = await Promise.all(
      [...new Set(scopedReferences.map((ref) => ref.docId))].map((docId) => this.get(docId)),
    );
    const docs = supportingDocs.filter((doc): doc is DefDoc => Boolean(doc));
    if (docs.length === 0) {
      return { kind: "none", codePath: formatCodeReferenceTarget(requested), references: scopedReferences };
    }

    const boundaryRefs = scopedReferences.filter((ref) => ref.relationType === "boundary");
    const boundaryDocIds = [...new Set(boundaryRefs.map((ref) => ref.docId))];
    if (boundaryDocIds.length > 1) {
      const candidates = docs
        .filter((doc) => boundaryDocIds.includes(doc.docId))
        .map((anchor) => ({
          anchor,
          supportingDocs: docs.filter((doc) => doc.docId === anchor.docId),
          references: scopedReferences,
        }));
      return { kind: "ambiguous", codePath: formatCodeReferenceTarget(requested), candidates, references: scopedReferences };
    }

    const byAnchor = new Map<string, DefBoundaryResolutionCandidate>();

    for (const doc of docs) {
      const anchor = boundaryDocIds.length === 1
        ? docs.find((item) => item.docId === boundaryDocIds[0]) ?? doc
        : await this.resolveBoundaryAnchor(doc);
      const existing = byAnchor.get(anchor.docId);
      if (existing) {
        existing.supportingDocs.push(doc);
      } else {
        byAnchor.set(anchor.docId, { anchor, supportingDocs: [doc], references: scopedReferences });
      }
    }

    const candidates = [...byAnchor.values()].map((candidate) => ({
      anchor: candidate.anchor,
          supportingDocs: candidate.supportingDocs.toSorted((a: DefDoc, b: DefDoc) => a.docId.localeCompare(b.docId)),
      references: scopedReferences,
    }));

    if (candidates.length === 1) {
      return {
        kind: "unique",
        codePath: formatCodeReferenceTarget(requested),
        anchor: candidates[0]!.anchor,
        supportingDocs: candidates[0]!.supportingDocs,
        references: scopedReferences,
      };
    }

    return { kind: "ambiguous", codePath: formatCodeReferenceTarget(requested), candidates, references: scopedReferences };
  }

  async list(filter?: DefListFilter): Promise<DefDoc[]> {
    // 전문 검색 — MATCH 실패 시 LIKE fallback으로 exact id/title 검색을 보완한다.
    if (filter?.q) {
      const ftsQuery = filter.q
        .split(/\s+/)
        .filter(t => t.length > 0)
        .map(t => t.endsWith("*") ? t : `${t}*`)
        .join(" ");
      try {
        const stmt = this.db.prepare(`
          SELECT d.* FROM documents d
          JOIN documents_fts fts ON fts.doc_id = d.doc_id
          WHERE documents_fts MATCH ?
          LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(ftsQuery, filter?.limit ?? 50, filter?.offset ?? 0) as Record<string, unknown>[];
        if (rows.length > 0) {
          return rows.map(rowToDoc);
        }
      } catch {
        // hyphenated doc id 등 FTS 구문 오류는 LIKE fallback으로 처리한다.
      }

      return this.searchByLike(filter.q, filter?.limit ?? 50, filter?.offset ?? 0);
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.type) { conditions.push("doc_type = ?"); params.push(filter.type); }
    if (filter?.knowledgeKind) { conditions.push("knowledge_kind = ?"); params.push(filter.knowledgeKind); }
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

  private searchByLike(query: string, limit: number, offset: number): DefDoc[] {
    const pattern = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM documents
      WHERE purpose LIKE ?
         OR intent LIKE ?
         OR context LIKE ?
         OR caveat LIKE ?
         OR doc_id LIKE ?
         OR title LIKE ?
         OR svc LIKE ?
         OR address LIKE ?
         OR tags_json LIKE ?
      ORDER BY doc_id
      LIMIT ? OFFSET ?
    `);
    return (
      stmt.all(
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        limit,
        offset,
      ) as Record<string, unknown>[]
    ).map(rowToDoc);
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
    const targetAddress = (await this.get(docId))?.address;
    const stmt = this.db.prepare(`
      SELECT dl.source_id, dl.link_type,
             COALESCE(dl.source_address, d.address) AS source_address
      FROM document_links dl
      LEFT JOIN documents d ON d.doc_id = dl.source_id
      WHERE dl.target_id = ?
    `);
    return (stmt.all(docId) as {
      source_id: string;
      link_type: string;
      source_address: string | null;
    }[]).map((r) => ({
      source: r.source_id,
      type: r.link_type,
      ...(r.source_address ? { sourceAddress: r.source_address } : {}),
      ...(targetAddress ? { targetAddress } : {}),
    }));
  }

  async getSyntheticIncomingLinks(
    docId: string,
  ): Promise<Awaited<ReturnType<typeof getSyntheticIncomingLinksForDoc>>> {
    return getSyntheticIncomingLinksForDoc(this.cwd, docId);
  }

  async getOutgoingLinks(docId: string): Promise<DefOutgoingLink[]> {
    const sourceAddress = (await this.get(docId))?.address;
    const stmt = this.db.prepare(`
      SELECT dl.target_id, dl.link_type,
             COALESCE(dl.target_address, d.address) AS target_address
      FROM document_links dl
      LEFT JOIN documents d ON d.doc_id = dl.target_id
      WHERE dl.source_id = ?
    `);
    return (stmt.all(docId) as {
      target_id: string;
      link_type: string;
      target_address: string | null;
    }[]).map((r) => ({
      target: r.target_id,
      type: r.link_type,
      ...(sourceAddress ? { sourceAddress } : {}),
      ...(r.target_address ? { targetAddress: r.target_address } : {}),
    }));
  }

  /** 전체 링크를 한번에 조회 — validate() 등 일괄 처리용. source_id 기준 그룹핑. */
  private getAllLinks(): Map<string, { target: string; type: string }[]> {
    const stmt = this.db.prepare("SELECT source_id, target_id, link_type FROM document_links");
    const rows = stmt.all() as { source_id: string; target_id: string; link_type: string }[];
    const grouped = new Map<string, { target: string; type: string }[]>();
    for (const r of rows) {
      let list = grouped.get(r.source_id);
      if (!list) { list = []; grouped.set(r.source_id, list); }
      list.push({ target: r.target_id, type: r.link_type });
    }
    return grouped;
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
    const scopeIndex = (scope?: string) => {
      if (!scope) return 999;
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
        scope: child.scope ?? undefined,
        aspect: child.aspect ?? undefined,
        depth: child.depth ?? undefined,
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
        ...(impact.sourceAddress ? { sourceAddress: impact.sourceAddress } : {}),
        impacted: impact.impacted.map((item) => ({
          docId: item.id,
          ...(item.address ? { address: item.address } : {}),
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
    const issues: DefValidationResult["issues"] = [];
    const registry = new MemoryDefinitionRegistry();

    for (const doc of allDocs) {
      registry.register(docRowToRegistryInput(doc));
    }

    const allLinks = this.getAllLinks();
    for (const doc of allDocs) {
      const outgoing = allLinks.get(doc.docId) ?? [];
      for (const link of outgoing) {
        if (!allIds.has(link.target)) {
          issues.push({
            severity: "error",
            type: "broken-link",
            docId: doc.docId,
            message: `target "${link.target}" (${link.type})가 존재하지 않음`,
          });
          continue;
        }
        registry.link(doc.docId, link.target, link.type as DefinitionLink["linkType"]);
      }
    }

    issues.push(...validateGraph(registry).issues);

    const refs = this.getAllCodeReferences();
    const docsById = new Map(allDocs.map((doc) => [doc.docId, doc]));
    const refsByPath = new Map<string, DefCodeReference[]>();

    for (const ref of refs) {
      const doc = docsById.get(ref.docId);
      if (!doc) {
        issues.push({
          severity: "error",
          type: "broken-code-reference",
          docId: ref.docId,
          message: `code reference "${ref.codePath}"가 존재하지 않는 문서 "${ref.docId}"를 참조`,
        });
        continue;
      }
      if (ref.relationType === "boundary" && doc.level !== "group" && doc.level !== "module") {
        issues.push({
          severity: "error",
          type: "invalid-code-boundary",
          docId: ref.docId,
          message: `boundary reference "${ref.codePath}"는 group/module 문서를 가리켜야 함`,
        });
      }
      const scopeKey = makeCodeReferenceScopeKey(ref.codePath, ref.symbol);
      const bucket = refsByPath.get(scopeKey) ?? [];
      bucket.push(ref);
      refsByPath.set(scopeKey, bucket);
    }

    for (const [_scopeKey, pathRefs] of refsByPath) {
      const targetLabel = formatCodeReferenceTarget({
        codePath: pathRefs[0]!.codePath,
        symbol: pathRefs[0]!.symbol,
      });
      const boundaryIds = [...new Set(
        pathRefs
          .filter((ref) => ref.relationType === "boundary" && docsById.has(ref.docId))
          .map((ref) => ref.docId),
      )];

      if (boundaryIds.length > 1) {
        issues.push({
          severity: "error",
          type: "ambiguous-code-boundary",
          docId: boundaryIds[0]!,
          message: `code reference "${targetLabel}"에 둘 이상의 boundary가 선언됨: ${boundaryIds.join(", ")}`,
        });
        continue;
      }

      const explicitBoundaryId = boundaryIds[0] ?? null;
      const inferredAnchorIds = new Set<string>();
      for (const ref of pathRefs) {
        const doc = docsById.get(ref.docId);
        if (!doc) continue;
        const anchor = await this.resolveBoundaryAnchor(doc);
        inferredAnchorIds.add(anchor.docId);
        if (explicitBoundaryId && anchor.docId !== explicitBoundaryId) {
          issues.push({
            severity: "error",
            type: "inconsistent-code-boundary",
            docId: ref.docId,
            message: `code reference "${targetLabel}"의 explicit boundary "${explicitBoundaryId}"와 문서 "${ref.docId}"의 anchor "${anchor.docId}"가 다름`,
          });
        }
      }

      if (!explicitBoundaryId && inferredAnchorIds.size > 1) {
        issues.push({
          severity: "error",
          type: "ambiguous-code-boundary",
          docId: pathRefs[0]!.docId,
          message: `code reference "${targetLabel}"가 여러 boundary anchor에 걸침: ${[...inferredAnchorIds].join(", ")}`,
        });
      }
    }

    const errors = issues.filter(i => i.severity === "error").length;
    const warnings = issues.filter(i => i.severity === "warning").length;
    return { issues, errors, warnings, passed: errors === 0 };
  }

  close() {
    this.db.close();
  }

  private getAllCodeReferences(): DefCodeReference[] {
    const rows = this.db
      .prepare(`
        SELECT code_path, doc_id, relation_type, source_kind, symbol, line
        FROM code_references
        ORDER BY code_path, doc_id, relation_type
      `)
      .all() as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      codePath: row["code_path"] as string,
      docId: row["doc_id"] as string,
      relationType: row["relation_type"] as DefCodeReference["relationType"],
      sourceKind: row["source_kind"] as DefCodeReference["sourceKind"],
      symbol: (row["symbol"] as string) || undefined,
      line: (row["line"] as number | null) ?? undefined,
    }));
  }

  private normalizeCodeReferenceTarget(filePath: string): { codePath: string; symbol?: string } {
    const parsed = parseCodeReferenceTarget(filePath.replaceAll("\\", "/"));
    const rawPath = parsed?.codePath ?? filePath;
    const symbol = parsed?.symbol;
    if (isAbsolute(rawPath)) {
      const relPath = relative(this.cwd, rawPath).replaceAll("\\", "/");
      if (relPath !== "" && !relPath.startsWith("../")) {
        return { codePath: relPath, symbol };
      }
    }
    return { codePath: rawPath.replaceAll("\\", "/"), symbol };
  }

  private async resolveBoundaryAnchor(doc: DefDoc): Promise<DefDoc> {
    if (doc.level === "group" || doc.level === "module") return doc;
    let current = doc;
    const visited = new Set<string>([doc.docId]);
    while (true) {
      const parent = await this.getParent(current.docId);
      if (!parent || visited.has(parent.docId)) return current;
      if (parent.level === "group" || parent.level === "module") return parent;
      visited.add(parent.docId);
      current = parent;
    }
  }
}
