import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { LocalDataSource } from "./local-data-source.js";
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

  it("같은 파일이라도 symbol 단위로 authoritative boundary를 분리한다", async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, "docs");
    const dataDir = join(rootDir, "data");
    const pkgDir = join(rootDir, "packages/demo/src");
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(pkgDir, { recursive: true });

    writeFileSync(
      join(docsDir, "event-prefix-group.md"),
      `---
def:
  id: event-prefix-group
  level: module
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
---

## 목적 ^purpose

이벤트 prefix 그룹.

## 구성 ^overview

이벤트 prefix를 묶는다.
`,
      "utf8",
    );

    writeFileSync(
      join(docsDir, "observation-prefix-group.md"),
      `---
def:
  id: observation-prefix-group
  level: module
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
---

## 목적 ^purpose

관측 prefix 그룹.

## 구성 ^overview

관측 prefix를 묶는다.
`,
      "utf8",
    );

    writeFileSync(
      join(pkgDir, "catalog.ts"),
      `// @def.boundary event-prefix-group#Catalog.events.auth_event
// @def.boundary observation-prefix-group#Catalog.observations.page_view
export const Catalog = {
  events: { auth_event: {} },
  observations: { page_view: {} },
};
`,
      "utf8",
    );

    const result = await syncDocsToLocalDb({ rootDir });
    expect(result.codeReferences).toBe(2);

    const source = new LocalDataSource(join(rootDir, "data/definition-service.sqlite"), rootDir);
    try {
      const ambiguous = await source.resolveByFile("packages/demo/src/catalog.ts");
      expect(ambiguous.kind).toBe("ambiguous");

      const eventMapping = await source.resolveByFile("packages/demo/src/catalog.ts:Catalog.events.auth_event");
      expect(eventMapping.kind).toBe("unique");
      if (eventMapping.kind === "unique") {
        expect(eventMapping.anchor.docId).toBe("event-prefix-group");
      }

      const observationMapping = await source.resolveByFile("packages/demo/src/catalog.ts:Catalog.observations.page_view");
      expect(observationMapping.kind).toBe("unique");
      if (observationMapping.kind === "unique") {
        expect(observationMapping.anchor.docId).toBe("observation-prefix-group");
      }
    } finally {
      source.close();
    }
  });
});
