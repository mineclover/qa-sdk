// @def.doc definition-service

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DocStore } from "../core/interfaces.js";
import type { DocRecord } from "../core/types.js";
import { InMemoryDocStore } from "../stores/memory-stores.js";
import { syncDocsToDb } from "./scanner.js";

function writeDoc(rootDir: string, fileName: string, docId: string) {
  const docsDir = join(rootDir, "docs");
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(
    join(docsDir, fileName),
    `---
def:
  id: ${docId}
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
---
# ${docId}

## 목적 ^purpose

${docId} purpose
`,
    "utf8",
  );
}

describe("syncDocsToDb", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("삭제된 문서를 저장소에서 제거한다", async () => {
    const root = mkdtempSync(join(tmpdir(), "def-sync-"));
    roots.push(root);
    writeDoc(root, "a.md", "doc-a");
    writeDoc(root, "b.md", "doc-b");

    const store = new InMemoryDocStore();

    const first = await syncDocsToDb("docs", root, store);
    expect(first.created).toBe(2);
    expect(store.get("doc-a")?.docId).toBe("doc-a");
    expect(store.get("doc-b")?.docId).toBe("doc-b");

    unlinkSync(join(root, "docs", "b.md"));

    const second = await syncDocsToDb("docs", root, store);
    expect(second.deleted).toBe(1);
    expect(store.get("doc-a")?.docId).toBe("doc-a");
    expect(store.get("doc-b")).toBeNull();
  });

  it("삭제 대상 기존 문서를 고정 상한 없이 페이지 단위로 조회한다", async () => {
    const root = mkdtempSync(join(tmpdir(), "def-sync-"));
    roots.push(root);
    writeDoc(root, "current.md", "doc-current");

    const existingDocs = Array.from({ length: 1005 }, (_, index): DocRecord => ({
      docId: `stale-${String(index).padStart(4, "0")}`,
      title: `stale-${index}`,
      scope: "flow",
      aspect: "process_flow",
      depth: "overview",
      lifecycle: "approved",
      tags: [],
      links: [],
      version: 1,
      bodyHash: `stale-${index}`,
      syncedAt: "2026-07-01T00:00:00.000Z",
    }));
    const listCalls: Array<{ limit?: number; offset?: number }> = [];
    const deleted: string[] = [];
    const store = {
      upsert() {
        return { action: "unchanged" as const, version: 1 };
      },
      list(filter = {}) {
        listCalls.push({ limit: filter.limit, offset: filter.offset });
        const offset = filter.offset ?? 0;
        const limit = filter.limit ?? 500;
        return existingDocs.slice(offset, offset + limit);
      },
      delete(docId: string) {
        deleted.push(docId);
        return true;
      },
      replaceCodeReferences() {
        return 0;
      },
    } as Pick<DocStore, "upsert" | "list" | "delete" | "replaceCodeReferences">;

    const result = await syncDocsToDb("docs", root, store as DocStore);

    expect(result.deleted).toBe(1005);
    expect(deleted).toHaveLength(1005);
    expect(listCalls).toEqual([
      { limit: 1000, offset: 0 },
      { limit: 1000, offset: 1000 },
    ]);
  });
});
