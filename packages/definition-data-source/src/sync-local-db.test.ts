import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { syncDocsToLocalDb } from "./sync-local-db.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "qa-sdk-def-sync-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("syncDocsToLocalDb", () => {
  it("full body, raw declared links, version/revision을 최신 documents snapshot에 저장한다", async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, "docs");
    const dataDir = join(rootDir, "data");
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    writeFileSync(
      join(docsDir, "sample.md"),
      `---
def:
  id: sample-doc
  version: v2
  revision: 7
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [testing]
  links:
    - target: missing-doc
      type: depends_on
---
# Sample Doc

## 목적 ^purpose

본문 목적

## 구성 ^overview

본문 전체가 저장돼야 한다.
`,
      "utf8",
    );

    const result = await syncDocsToLocalDb({ rootDir });
    expect(result.synced).toBe(1);

    const db = new Database(join(rootDir, "data/definition-service.sqlite"), { readonly: true });
    try {
      const doc = db
        .prepare(`
          SELECT doc_id, doc_version, revision, body, links_json
          FROM documents
          WHERE doc_id = ?
        `)
        .get("sample-doc") as
          | {
              doc_id: string;
              doc_version: string | null;
              revision: number | null;
              body: string;
              links_json: string;
            }
          | undefined;

      expect(doc).toBeDefined();
      expect(doc?.doc_version).toBe("v2");
      expect(doc?.revision).toBe(7);
      expect(doc?.body).toContain("## 목적 ^purpose");
      expect(doc?.body).toContain("본문 전체가 저장돼야 한다.");
      expect(JSON.parse(doc?.links_json ?? "[]")).toEqual([
        { target: "missing-doc", type: "depends_on" },
      ]);

      const rawLink = db
        .prepare(`
          SELECT source_id, target_id, link_type
          FROM document_links
          WHERE source_id = ?
        `)
        .get("sample-doc") as
          | { source_id: string; target_id: string; link_type: string }
          | undefined;

      expect(rawLink).toEqual({
        source_id: "sample-doc",
        target_id: "missing-doc",
        link_type: "depends_on",
      });
    } finally {
      db.close();
    }
  });
});
