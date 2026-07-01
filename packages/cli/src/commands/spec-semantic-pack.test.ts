// @def.boundary docs-control-plane
// @def.doc coord-semantic-indexing-pack

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, vi, afterEach } from "vitest";
import { main } from "../index.js";
import type { SemanticIndexingPackManifest, SemanticIndexingSurfaceChangeInput } from "@qa-sdk/spec-core/semantic-indexing-pack";

describe("spec semantic-pack report command", () => {
  let tempRoot = "";

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("emits JSON report from manifest and changes without writing files", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "qa-sdk-semantic-pack-report-"));
    const manifestPath = join(tempRoot, "manifest.json");
    const changesPath = join(tempRoot, "changes.json");
    const manifest: SemanticIndexingPackManifest = {
      packId: "coord-semantic-indexing-pack",
      version: "v1",
      planes: [
        { plane: "semantic-source", refs: [{ id: "semantic", kind: "doc", path: "docs/semantic.md" }] },
        { plane: "taxonomy", refs: [{ id: "taxonomy", kind: "doc", path: "docs/taxonomy.md" }] },
        { plane: "coordinate", refs: [{ id: "coordinate", kind: "package", path: "packages/index-meta/src/index.ts" }] },
        { plane: "transition", refs: [{ id: "transition", kind: "package", path: "packages/spec-transition/src/index.ts" }] },
        { plane: "materialization", refs: [{ id: "address-index", kind: "package", path: "packages/address-index/src/index.ts" }] },
        { plane: "feedback", refs: [{ id: "feedback", kind: "source", path: "packages/definition-service/src/core/semantic-grounding/feedback.ts" }] },
      ],
    };
    const changes: readonly SemanticIndexingSurfaceChangeInput[] = [
      {
        surface: { id: "coordinate", path: "packages/index-meta/src/index.ts" },
        changeKind: "axis-add",
      },
    ];
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
    await writeFile(changesPath, JSON.stringify(changes), "utf8");
    await main([
      "spec",
      "semantic-pack",
      "report",
      "--manifest",
      manifestPath,
      "--changes",
      changesPath,
      "--format",
      "json",
      "--no-git",
    ]);

    const payload = JSON.parse(log.mock.calls.map((call) => String(call[0])).join("\n"));
    expect(payload.packId).toBe("coord-semantic-indexing-pack");
    expect(payload.compatibility.verdict).toBe("review-required");
    expect(payload.reviewOnly).toBe(true);
  });
});
