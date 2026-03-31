import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DefBoundaryContextResult,
  DefBoundaryResult,
  DefDataSource,
  DefDoc,
  DefDocBody,
  DefFeedbackRequestSummary,
  DefIncomingLink,
  DefListFilter,
  DefSyntheticIncomingLink,
  DefValidationResult,
} from "definition-catalog";
import {
  analyzeImpact,
  assembleBoundary,
  computeEffectiveConcerns,
  extractByLevel,
  extractByMarker,
  extractFrontmatter,
  parseDocument,
  scanAndBuild,
  selectConcernContext,
  selectImpactContext,
  validateGraph,
  type DefinitionEntry,
  type DefinitionLink,
  type MemoryDefinitionRegistry,
} from "definition-catalog";
import {
  getFeedbackRequestSummariesForDoc,
  getSyntheticIncomingLinksForDoc,
} from "./review-feedback-source.js";

type ScanIssue = { file: string; error: string };
type ScanLinkIssue = { source: string; target: string; error: string };

function mapEntryToDoc(entry: DefinitionEntry, body?: string): DefDoc {
  return {
    docId: entry.id,
    title: entry.title,
    type: entry.type,
    knowledgeKind: entry.knowledgeKind,
    level: entry.level,
    scope: entry.scope,
    aspect: entry.aspect,
    depth: entry.depth,
    lifecycle: entry.lifecycle,
    layer: entry.layer,
    tags: [...(entry.tags ?? [])],
    links: [],
    svc: entry.serviceId,
    docVersion: entry.version,
    revision: entry.revision,
    address: entry.serialized,
    version: entry.revision ?? 1,
    purpose: body ? extractByLevel(body, "purpose").text || undefined : undefined,
    intent: body ? extractByMarker(body, "intent").text || undefined : undefined,
    context: body ? extractByMarker(body, "context").text || undefined : undefined,
    caveat: body ? extractByMarker(body, "caveat").text || undefined : undefined,
    gate: entry.gate,
    sourcePath: entry.ref,
  };
}

async function loadBodies(
  registry: MemoryDefinitionRegistry,
  rootDir: string,
): Promise<Map<string, string>> {
  const bodies = new Map<string, string>();

  for (const entry of registry.all()) {
    if (!entry.ref) continue;
    try {
      const content = await readFile(join(rootDir, entry.ref), "utf-8");
      const fm = extractFrontmatter(content);
      if (fm) bodies.set(entry.id, fm.body);
    } catch {
      // 개별 파일 읽기 실패는 degraded scan mode에서 무시한다.
    }
  }

  return bodies;
}

async function loadDeclaredLinks(
  registry: MemoryDefinitionRegistry,
  rootDir: string,
): Promise<Map<string, { target: string; type: string }[]>> {
  const links = new Map<string, { target: string; type: string }[]>();

  for (const entry of registry.all()) {
    if (!entry.ref) continue;
    try {
      const filePath = join(rootDir, entry.ref);
      const content = await readFile(filePath, "utf-8");
      const document = parseDocument(content, filePath);
      links.set(
        entry.id,
        document.def.links
          ? document.def.links.map((link) => ({ target: link.target, type: link.type }))
          : [],
      );
    } catch {
      links.set(entry.id, []);
    }
  }

  return links;
}

function buildDeclaredLinkMaps(docs: readonly DefDoc[]) {
  const outgoing = new Map();
  const incoming = new Map();

  for (const doc of docs) {
    outgoing.set(doc.docId, doc.links.map((link) => ({ target: link.target, type: link.type })));
    for (const link of doc.links) {
      const list = incoming.get(link.target) ?? [];
      list.push({ source: doc.docId, type: link.type });
      incoming.set(link.target, list);
    }
  }

  return { outgoing, incoming };
}

function applyFilters(docs: readonly DefDoc[], filter?: DefListFilter): DefDoc[] {
  if (!filter) return [...docs];

  return docs.filter((doc) => {
    if (filter.type && doc.type !== filter.type) return false;
    if (filter.knowledgeKind && doc.knowledgeKind !== filter.knowledgeKind) return false;
    if (filter.scope && doc.scope !== filter.scope) return false;
    if (filter.aspect && doc.aspect !== filter.aspect) return false;
    if (filter.depth && doc.depth !== filter.depth) return false;
    if (filter.lifecycle && doc.lifecycle !== filter.lifecycle) return false;
    if (filter.layer && doc.layer !== filter.layer) return false;
    if (filter.level && doc.level !== filter.level) return false;
    if (filter.svc && doc.svc !== filter.svc) return false;
    if (filter.address && doc.address !== filter.address) return false;
    if (filter.tag && !doc.tags.includes(filter.tag)) return false;
    return true;
  });
}

function scoreQuery(doc: DefDoc, rawQuery: string): number | null {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;

  const values: Array<[number, string | undefined]> = [
    [0, doc.docId],
    [1, doc.title],
    [2, doc.purpose],
    [3, doc.context],
    [4, doc.intent],
    [5, doc.caveat],
    [6, doc.svc],
    [7, doc.address],
    [8, doc.tags.join(" ")],
  ];

  for (const [rank, value] of values) {
    if (!value) continue;
    const normalized = value.toLowerCase();
    if (normalized === query) return rank;
    if (normalized.startsWith(query)) return rank + 10;
    if (normalized.includes(query)) return rank + 20;
  }

  return null;
}

function sortByQuery(docs: readonly DefDoc[], query: string): DefDoc[] {
  return docs
    .map((doc) => ({ doc, score: scoreQuery(doc, query) }))
    .filter((item): item is { doc: DefDoc; score: number } => item.score !== null)
    .sort((left, right) => left.score - right.score || left.doc.docId.localeCompare(right.doc.docId))
    .map((item) => item.doc);
}

export class ScanDataSource implements DefDataSource {
  readonly mode = "scan" as const;

  private constructor(
    private readonly rootDir: string,
    private readonly registry: MemoryDefinitionRegistry,
    private readonly bodies: Map<string, string>,
    private readonly docs: DefDoc[],
    private readonly declaredOutgoingLinks: ReadonlyMap<string, readonly { target: string; type: string }[]>,
    private readonly declaredIncomingLinks: ReadonlyMap<string, readonly { source: string; type: string }[]>,
    private readonly scanErrors: readonly ScanIssue[],
    private readonly scanLinkErrors: readonly ScanLinkIssue[],
  ) {}

  static async create(
    rootDir: string = process.cwd(),
    docsDir = "docs",
  ): Promise<ScanDataSource> {
    const scan = await scanAndBuild(rootDir, [join(rootDir, docsDir)]);
    const bodies = await loadBodies(scan.registry, rootDir);
    const declaredLinks = await loadDeclaredLinks(scan.registry, rootDir);
    const docs = scan.registry.all()
      .map((entry) => {
        const doc = mapEntryToDoc(entry, bodies.get(entry.id));
        const links = declaredLinks.get(entry.id) ?? [];
        return { ...doc, links };
      })
      .sort((left, right) => left.docId.localeCompare(right.docId));

    const { outgoing, incoming } = buildDeclaredLinkMaps(docs);

    return new ScanDataSource(
      rootDir,
      scan.registry,
      bodies,
      docs,
      outgoing,
      incoming,
      scan.errors,
      scan.linkErrors,
    );
  }

  async get(docId: string): Promise<DefDoc | null> {
    return this.docs.find((doc) => doc.docId === docId) ?? null;
  }

  async getBody(docId: string): Promise<DefDocBody | null> {
    const doc = this.docs.find((item) => item.docId === docId);
    if (!doc) return null;
    return {
      docId,
      body: this.bodies.get(docId) ?? "",
      docVersion: doc.docVersion,
      revision: doc.revision,
      sourcePath: doc.sourcePath,
    };
  }

  async list(filter?: DefListFilter): Promise<DefDoc[]> {
    let docs = applyFilters(this.docs, filter);
    if (filter?.q) {
      docs = sortByQuery(docs, filter.q);
    }

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 500;
    return docs.slice(offset, offset + limit);
  }

  async getChildren(docId: string): Promise<DefDoc[]> {
    return this.registry.getLinks(docId, "outgoing")
      .filter((link) => link.linkType === "contains")
      .map((link) => this.docs.find((doc) => doc.docId === link.targetId))
      .filter((doc): doc is DefDoc => doc !== undefined)
      .sort((left, right) => left.docId.localeCompare(right.docId));
  }

  async getParent(docId: string): Promise<DefDoc | null> {
    const parentLink = this.registry.getLinks(docId, "incoming")
      .find((link) => link.linkType === "contains");
    if (!parentLink) return null;
    return this.docs.find((doc) => doc.docId === parentLink.sourceId) ?? null;
  }

  async getIncomingLinks(docId: string): Promise<DefIncomingLink[]> {
    return [...(this.declaredIncomingLinks.get(docId) ?? [])];
  }

  async getSyntheticIncomingLinks(docId: string): Promise<DefSyntheticIncomingLink[]> {
    return getSyntheticIncomingLinksForDoc(this.rootDir, docId);
  }

  async getOutgoingLinks(docId: string): Promise<{ target: string; type: string }[]> {
    return [...(this.declaredOutgoingLinks.get(docId) ?? [])];
  }

  async getFeedbackRequestsByDocId(
    docId: string,
    limit = 10,
  ): Promise<DefFeedbackRequestSummary[]> {
    return getFeedbackRequestSummariesForDoc(this.rootDir, docId, limit);
  }

  async getBoundary(
    docId: string,
    level: "purpose" | "overview" = "overview",
  ): Promise<DefBoundaryResult | null> {
    const assembled = assembleBoundary(
      docId,
      (id) => this.registry.get(id),
      (id, direction) => this.registry.getLinks(id, direction),
      (id) => this.bodies.get(id),
      level,
    );
    if (!assembled) return null;

    const doc = await this.get(docId);
    return {
      boundary: {
        docId: assembled.boundary.id,
        title: assembled.boundary.title,
        scope: assembled.boundary.scope,
        aspect: assembled.boundary.aspect,
        depth: assembled.boundary.depth,
        lifecycle: doc?.lifecycle ?? "approved",
        ...(doc?.layer ? { layer: doc.layer } : {}),
        ...(doc?.svc ? { svc: doc.svc } : {}),
        ...(assembled.boundary.purpose ? { purpose: assembled.boundary.purpose } : {}),
        ...(level === "overview" && assembled.boundary.overview.length > 0
          ? { overview: assembled.boundary.overview.join("\n") }
          : {}),
      },
      members: assembled.members.map((member) => ({
        docId: member.id,
        title: member.title,
        scope: member.scope,
        aspect: member.aspect,
        depth: member.depth,
        summary: member.purpose ?? member.overview[0] ?? "(요약 없음)",
      })),
      couplings: {
        outgoing: assembled.couplings.outgoing.map((item) => ({
          type: item.linkType,
          target: item.doc.id,
          summary: item.doc.purpose ?? item.doc.overview[0] ?? "(요약 없음)",
        })),
        incoming: assembled.couplings.incoming.map((item) => ({
          type: item.linkType,
          source: item.doc.id,
          summary: item.doc.purpose ?? item.doc.overview[0] ?? "(요약 없음)",
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

    const concerns = selectConcernContext(
      computeEffectiveConcerns(
        docId,
        (id) => this.registry.get(id),
        (id, direction) => {
          if (direction === "outgoing") {
            return (this.declaredOutgoingLinks.get(id) ?? []).map((link) => ({
              sourceId: id,
              targetId: link.target,
              linkType: link.type as DefinitionLink["linkType"],
              address: 0,
              serialized: "",
            }));
          }
          return (this.declaredIncomingLinks.get(id) ?? []).map((link) => ({
            sourceId: link.source,
            targetId: id,
            linkType: link.type as DefinitionLink["linkType"],
            address: 0,
            serialized: "",
          }));
        },
      ),
      mode,
    );
    const impact = selectImpactContext(
      analyzeImpact(
        docId,
        (id) => this.registry.get(id),
        (id, direction) => {
          if (direction === "outgoing") {
            return (this.declaredOutgoingLinks.get(id) ?? []).map((link) => ({
              sourceId: id,
              targetId: link.target,
              linkType: link.type as DefinitionLink["linkType"],
              address: 0,
              serialized: "",
            }));
          }
          return (this.declaredIncomingLinks.get(id) ?? []).map((link) => ({
            sourceId: link.source,
            targetId: id,
            linkType: link.type as DefinitionLink["linkType"],
            address: 0,
            serialized: "",
          }));
        },
      ),
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
    const graph = validateGraph(this.registry);
    const issues: DefValidationResult["issues"] = [
      ...this.scanErrors.map((item) => ({
        severity: "error" as const,
        type: "scan-error",
        docId: item.file,
        message: item.error,
      })),
      ...this.scanLinkErrors.map((item) => ({
        severity: "error" as const,
        type: "broken-link",
        docId: item.source,
        message: `${item.target}: ${item.error}`,
      })),
      ...graph.issues.map((issue) => ({
        severity: issue.severity,
        type: issue.type,
        docId: issue.docId,
        message: issue.message,
      })),
    ];

    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    return { issues, errors, warnings, passed: errors === 0 };
  }
}
