import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema.js";
import { SearchService } from "./search.service.js";

function createService() {
  const raw = new Database(":memory:");
  raw.exec(`
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
    INSERT INTO documents (
      doc_id, title, scope, aspect, depth, lifecycle, tags_json, links_json,
      version, body_hash, purpose, synced_at
    ) VALUES
      ('doc-a', 'Doc A', 'data', 'domain_data', 'overview', 'approved', '[]', '[]', 1, 'hash-a', '상품 담기 문서', '2026-06-30T00:00:00.000Z'),
      ('doc-b', 'Doc B', 'data', 'domain_data', 'overview', 'approved', '[]', '[]', 1, 'hash-b', 'checkout document', '2026-06-30T00:00:00.000Z');
  `);
  const db = drizzle({ client: raw, schema });
  const service = new SearchService(raw, db);
  service.onModuleInit();
  service.index("doc-a", "상품 담기 문서");
  service.index("doc-b", "checkout document");
  return { raw, service };
}

describe("SearchService", () => {
  it("matches only the requested document ids for a query", () => {
    const { raw, service } = createService();

    expect(service.matchDocIds("상품 담기", ["doc-a", "doc-b", "missing"])).toEqual(new Set(["doc-a"]));

    raw.close();
  });
});
