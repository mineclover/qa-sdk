// @def.doc definition-service

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
});
