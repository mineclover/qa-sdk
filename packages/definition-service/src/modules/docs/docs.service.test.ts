import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema.js";
import type { DocRecord } from "../../core/types.js";
import { mergeSemanticDocumentResults } from "../../core/semantic-grounding/planner.js";
import { DocsService } from "./docs.service.js";

function doc(docId: string, overrides: Partial<DocRecord> = {}): DocRecord {
  return {
    docId,
    title: docId,
    scope: "data",
    aspect: "domain_data",
    depth: "overview",
    lifecycle: "approved",
    tags: [],
    links: [],
    version: 1,
    bodyHash: `${docId}-hash`,
    syncedAt: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

function createDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE documents (
      doc_id text PRIMARY KEY NOT NULL,
      title text,
      doc_type text,
      knowledge_kind text,
      level text,
      tier text,
      scope text NOT NULL,
      aspect text NOT NULL,
      depth text NOT NULL,
      lifecycle text NOT NULL,
      target_prefix text,
      layer text,
      tags_json text NOT NULL DEFAULT '[]',
      links_json text NOT NULL DEFAULT '[]',
      svc text,
      doc_version text,
      revision integer,
      address text,
      version integer NOT NULL DEFAULT 1,
      body_hash text NOT NULL,
      body text NOT NULL DEFAULT '',
      purpose text,
      intent text,
      context text,
      caveat text,
      gate_json text,
      synced_at text NOT NULL,
      source_path text
    );
    CREATE TABLE document_history (
      id integer PRIMARY KEY AUTOINCREMENT,
      doc_id text NOT NULL,
      version integer NOT NULL,
      title text,
      doc_type text,
      knowledge_kind text,
      level text,
      tier text,
      scope text NOT NULL,
      aspect text NOT NULL,
      depth text NOT NULL,
      lifecycle text NOT NULL,
      layer text,
      tags_json text NOT NULL,
      links_json text NOT NULL,
      doc_version text,
      revision integer,
      body_hash text NOT NULL,
      body text NOT NULL,
      purpose text,
      intent text,
      context text,
      caveat text,
      gate_json text,
      change_type text NOT NULL,
      synced_at text NOT NULL
    );
    CREATE TABLE document_links (
      source_id text NOT NULL,
      target_id text NOT NULL,
      source_address text,
      target_address text,
      link_type text NOT NULL,
      PRIMARY KEY (source_id, target_id, link_type)
    );
  `);

  return drizzle({ client: sqlite, schema });
}

function createService() {
  const db = createDb();
  const searchCalls: Array<{ query: string; limit: number; offset: number }> = [];
  const countCalls: string[] = [];
  const indexCalls: Array<[string, string | undefined, string | undefined, string | undefined, string | undefined]> = [];
  const planCalls: string[] = [];
  const recordCalls: Array<{
    query: string;
    plan: { candidateDocIds: readonly string[] };
    docs: readonly DocRecord[];
    legacyCount: number;
    semanticCandidateCount: number;
    semanticHitCount: number;
    semanticOnlyCount: number;
    legacyOnlyCount: number;
  }> = [];
  const materializeCalls: Array<readonly DocRecord[]> = [];

  const search = {
    search(query: string, limit: number, offset: number) {
      searchCalls.push({ query, limit, offset });
      return [];
    },
    searchCount(query: string) {
      countCalls.push(query);
      return 0;
    },
    index(docId: string, purpose?: string, intent?: string, context?: string, caveat?: string) {
      indexCalls.push([docId, purpose, intent, context, caveat]);
    },
  };

  const semantic = {
    planDocumentSearch(query: string) {
      planCalls.push(query);
      return {
        kind: "document-search",
        query,
        candidateDocIds: [] as readonly string[],
        candidates: [],
      };
    },
    recordDocumentSearch(input: {
      query: string;
      plan: { candidateDocIds: readonly string[] };
      docs: readonly DocRecord[];
      legacyCount: number;
      semanticCandidateCount: number;
      semanticHitCount: number;
      semanticOnlyCount: number;
      legacyOnlyCount: number;
    }) {
      recordCalls.push(input);
    },
    materializeDocuments(docs: readonly DocRecord[]) {
      materializeCalls.push(docs);
      return { terms: docs.length, aliases: 0 };
    },
  };

  const service = new DocsService(db, search as any);
  (service as any).semantic = semantic;

  return {
    service,
    db,
    searchCalls,
    countCalls,
    indexCalls,
    planCalls,
    recordCalls,
    materializeCalls,
    semantic,
  };
}

function seedDocs(service: DocsService, docs: readonly DocRecord[]) {
  for (const item of docs) {
    service.getStore().upsert(item, `${item.docId} body`);
  }
}

describe("DocsService semantic search merge", () => {
  it("keeps semantic candidate docs before legacy FTS docs and removes duplicates", () => {
    const result = mergeSemanticDocumentResults({
      semanticDocs: [doc("semantic-b"), doc("semantic-a")],
      legacyDocs: [doc("semantic-a"), doc("legacy-c")],
      candidateDocIds: ["semantic-a", "semantic-b"],
      limit: 10,
      offset: 0,
    });

    expect(result.map((item) => item.docId)).toEqual(["semantic-a", "semantic-b", "legacy-c"]);
  });

  it("applies pagination after semantic and legacy results are merged", () => {
    const result = mergeSemanticDocumentResults({
      semanticDocs: [doc("semantic-a"), doc("semantic-b")],
      legacyDocs: [doc("legacy-c")],
      candidateDocIds: ["semantic-a", "semantic-b"],
      limit: 1,
      offset: 1,
    });

    expect(result.map((item) => item.docId)).toEqual(["semantic-b"]);
  });
});

describe("DocsService semantic search integration", () => {
  it("merges semantic candidates into list results before legacy search docs", () => {
    const { service, searchCalls, planCalls, recordCalls } = createService();
    seedDocs(service, [doc("semantic-a"), doc("semantic-b"), doc("legacy-c")]);

    const search = {
      search(query: string, limit: number, offset: number) {
        searchCalls.push({ query, limit, offset });
        return [doc("semantic-a"), doc("legacy-c")];
      },
      searchCount(query: string) {
        return query === "semantic" ? 2 : 0;
      },
      index() {},
    };
    (service as any).search = search;
    (service as any).semantic = {
      planDocumentSearch(query: string) {
        planCalls.push(query);
        return {
          kind: "document-search",
          query,
          candidateDocIds: ["semantic-a", "semantic-b"],
          candidates: [],
        };
      },
      recordDocumentSearch(input: any) {
        recordCalls.push(input);
      },
      materializeDocuments() {
        return { terms: 0, aliases: 0 };
      },
    };

    const docs = service.list({ q: "semantic", limit: 10, offset: 0 });

    expect(docs.map((item) => item.docId)).toEqual(["semantic-a", "semantic-b", "legacy-c"]);
    expect(searchCalls).toEqual([{ query: "semantic", limit: 50, offset: 0 }]);
    expect(planCalls).toEqual(["semantic"]);
    expect(recordCalls[0]).toMatchObject({
      query: "semantic",
      legacyCount: 2,
    });
  });

  it("applies semantic pagination before returning listPaginated results", () => {
    const { service } = createService();
    seedDocs(service, [doc("semantic-a"), doc("semantic-b"), doc("legacy-c")]);

    const search = {
      search() {
        return [doc("semantic-a"), doc("legacy-c")];
      },
      searchCount() {
        return 2;
      },
      index() {},
    };
    (service as any).search = search;
    (service as any).semantic = {
      planDocumentSearch() {
        return {
          kind: "document-search",
          query: "semantic",
          candidateDocIds: ["semantic-a", "semantic-b"],
          candidates: [],
        };
      },
      recordDocumentSearch() {},
      materializeDocuments() {
        return { terms: 0, aliases: 0 };
      },
    };

    const result = service.listPaginated({ q: "semantic", limit: 1, offset: 1 });

    expect(result.docs.map((item) => item.docId)).toEqual(["semantic-b"]);
    expect(result.total).toBe(3);
    expect(result.offset).toBe(1);
    expect(result.limit).toBe(1);
  });

  it("does not load the full legacy result set when semantic candidates extend beyond the fetched buffer", () => {
    const { service, searchCalls } = createService();
    seedDocs(service, [doc("semantic-only")]);

    const search = {
      search(query: string, limit: number, offset: number) {
        searchCalls.push({ query, limit, offset });
        return Array.from({ length: limit }, (_, index) => doc(`legacy-${index + 1}`));
      },
      searchCount() {
        return 100;
      },
      matchDocIds() {
        return new Set<string>();
      },
      index() {},
    };
    (service as any).search = search;
    (service as any).semantic = {
      planDocumentSearch() {
        return {
          kind: "document-search",
          query: "semantic",
          candidateDocIds: ["semantic-only"],
          candidates: [],
        };
      },
      recordDocumentSearch() {},
      materializeDocuments() {
        return { terms: 0, aliases: 0 };
      },
    };

    const result = service.listPaginated({ q: "semantic", limit: 1, offset: 0 });

    expect(result.docs.map((item) => item.docId)).toEqual(["semantic-only"]);
    expect(result.total).toBe(101);
    expect(searchCalls).toEqual([{ query: "semantic", limit: 50, offset: 0 }]);
  });

  it("looks up semantic candidate docs by id instead of scanning the first 10000 docs", () => {
    const { service } = createService();
    const lateDoc = doc("zz-semantic-late");
    (service as any).store = {
      list() {
        return [];
      },
      get(docId: string) {
        return docId === lateDoc.docId ? lateDoc : null;
      },
      getMany(docIds: readonly string[]) {
        return docIds
          .map((docId) => docId === lateDoc.docId ? lateDoc : null)
          .filter((item): item is DocRecord => Boolean(item));
      },
    };

    (service as any).search = {
      search() {
        return [];
      },
      searchCount() {
        return 0;
      },
      matchDocIds() {
        return new Set<string>();
      },
      index() {},
    };
    (service as any).semantic = {
      planDocumentSearch() {
        return {
          kind: "document-search",
          query: "late",
          candidateDocIds: ["zz-semantic-late"],
          candidates: [],
        };
      },
      recordDocumentSearch() {},
      materializeDocuments() {
        return { terms: 0, aliases: 0 };
      },
    };

    const result = service.listPaginated({ q: "late", limit: 10, offset: 0 });

    expect(result.docs.map((item) => item.docId)).toEqual(["zz-semantic-late"]);
    expect(result.total).toBe(1);
  });

  it("records pre-pagination semantic hits when the requested page is empty", () => {
    const { service, recordCalls } = createService();
    seedDocs(service, [doc("semantic-a"), doc("semantic-b"), doc("legacy-c")]);

    const search = {
      search() {
        return [doc("semantic-a"), doc("legacy-c")];
      },
      searchCount() {
        return 2;
      },
      index() {},
    };
    (service as any).search = search;
    (service as any).semantic = {
      planDocumentSearch() {
        return {
          kind: "document-search",
          query: "semantic",
          candidateDocIds: ["semantic-a", "semantic-b"],
          candidates: [],
        };
      },
      recordDocumentSearch(input: any) {
        recordCalls.push(input);
      },
      materializeDocuments() {
        return { terms: 0, aliases: 0 };
      },
    };

    const result = service.listPaginated({ q: "semantic", limit: 1, offset: 5 });

    expect(result.docs).toHaveLength(0);
    expect(result.total).toBe(3);
    expect(recordCalls[0]?.docs.map((item: DocRecord) => item.docId)).toEqual(["semantic-a", "semantic-b", "legacy-c"]);
  });

  it("keeps legacy list behavior when semantic grounding is absent", () => {
    const db = createDb();
    const search = {
      search(query: string, limit: number, offset: number) {
        return [doc("legacy-a"), doc("legacy-b")].slice(offset, offset + limit);
      },
      searchCount() {
        return 2;
      },
      index() {},
    };
    const service = new DocsService(db, search as any);
    seedDocs(service, [doc("legacy-a"), doc("legacy-b")]);

    const docs = service.list({ q: "legacy", limit: 10, offset: 0 });
    const paginated = service.listPaginated({ q: "legacy", limit: 1, offset: 1 });

    expect(docs.map((item) => item.docId)).toEqual(["legacy-a", "legacy-b"]);
    expect(paginated.docs.map((item) => item.docId)).toEqual(["legacy-b"]);
    expect(paginated.total).toBe(2);
  });

  it("keeps legacy counts stable when semantic planning yields no candidates", () => {
    const { service, planCalls, recordCalls } = createService();
    seedDocs(service, [doc("legacy-a"), doc("legacy-b")]);

    const search = {
      search(query: string, limit: number, offset: number) {
        return [doc("legacy-a"), doc("legacy-b")].slice(offset, offset + limit);
      },
      searchCount() {
        return 2;
      },
      index() {},
    };
    (service as any).search = search;
    (service as any).semantic = {
      planDocumentSearch(query: string) {
        planCalls.push(query);
        return {
          kind: "document-search",
          query,
          candidateDocIds: [],
          candidates: [],
          fallbackReason: "no-candidate",
        };
      },
      recordDocumentSearch(input: any) {
        recordCalls.push(input);
      },
      materializeDocuments() {
        return { terms: 0, aliases: 0 };
      },
    };

    const result = service.listPaginated({ q: "legacy", limit: 1, offset: 1 });

    expect(result.docs.map((item) => item.docId)).toEqual(["legacy-b"]);
    expect(result.total).toBe(2);
    expect(planCalls).toEqual(["legacy"]);
    expect(recordCalls[0]?.docs.map((item: DocRecord) => item.docId)).toEqual(["legacy-a", "legacy-b"]);
  });

  it("ignores stale semantic candidates that no longer have matching docs", () => {
    const { service, planCalls, recordCalls } = createService();
    seedDocs(service, [doc("legacy-a")]);

    const search = {
      search(query: string, limit: number, offset: number) {
        return [doc("legacy-a")].slice(offset, offset + limit);
      },
      searchCount() {
        return 1;
      },
      index() {},
    };
    (service as any).search = search;
    (service as any).semantic = {
      planDocumentSearch(query: string) {
        planCalls.push(query);
        return {
          kind: "document-search",
          query,
          candidateDocIds: ["stale-semantic-doc"],
          candidates: [],
        };
      },
      recordDocumentSearch(input: any) {
        recordCalls.push(input);
      },
      materializeDocuments() {
        return { terms: 0, aliases: 0 };
      },
    };

    const result = service.listPaginated({ q: "semantic", limit: 10, offset: 0 });

    expect(result.docs.map((item) => item.docId)).toEqual(["legacy-a"]);
    expect(result.total).toBe(1);
    expect(planCalls).toEqual(["semantic"]);
    expect(recordCalls[0]).toMatchObject({
      semanticCandidateCount: 1,
      semanticHitCount: 0,
      legacyCount: 1,
      semanticOnlyCount: 0,
      legacyOnlyCount: 1,
    });
    expect(recordCalls[0]?.docs.map((item: DocRecord) => item.docId)).toEqual(["legacy-a"]);
  });

  it("materializes updated documents after metadata updates", () => {
    const { service, materializeCalls, indexCalls } = createService();
    seedDocs(service, [doc("semantic-a", { purpose: "old purpose", intent: "old intent", context: "old context", caveat: "old caveat" })]);

    const result = service.updateMetadata("semantic-a", { tags: ["updated"] });

    expect(result?.action).toBe("updated");
    expect(indexCalls).toHaveLength(1);
    expect(materializeCalls).toHaveLength(1);
    expect(materializeCalls[0]?.[0]).toMatchObject({
      docId: "semantic-a",
      tags: ["updated"],
    });
  });
});
