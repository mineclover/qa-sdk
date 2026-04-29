// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildMarkdownBundlePreview,
  renderMarkdownBundlePreview,
} from "./markdown-bundle.js";

describe("docs-control-plane markdown bundle preview", () => {
  it("renders a read-only temporary markdown bundle without writing a merged file", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-bundle-"));
    await mkdir(join(rootDir, "plans"), { recursive: true });
    await writeFile(join(rootDir, "plans", "A-stage-2b-grammar-tooling.md"), "# Stage 2b\n\n## Tooling\n", "utf8");
    await writeFile(join(rootDir, "plans", "A-stage-1-host-and-ingest.md"), "# Stage 1\n\n## Host\n", "utf8");

    const preview = await buildMarkdownBundlePreview({
      rootDir,
      target: "plans",
      order: ["A-stage-1-host-and-ingest", "A-stage-2b-grammar-tooling"],
    });
    const markdown = renderMarkdownBundlePreview(preview, "markdown");

    expect(preview.temporary).toBe(true);
    expect(preview.sources.map((source) => source.path)).toEqual([
      "plans/A-stage-1-host-and-ingest.md",
      "plans/A-stage-2b-grammar-tooling.md",
    ]);
    expect(markdown).toContain("TEMPORARY READ-ONLY BUNDLE PREVIEW");
    expect(markdown).toContain("Do not edit it as a source document");
    expect(markdown).toContain("BEGIN TEMPORARY SOURCE COPY");
  });

  it("renders stats with a temporary preview marker and largest-file hint", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-bundle-stats-"));
    await mkdir(join(rootDir, "plans"), { recursive: true });
    await writeFile(join(rootDir, "plans", "A-stage-1.md"), "# One\n", "utf8");
    await writeFile(join(rootDir, "plans", "A-stage-2.md"), "# Two\n\nline\n", "utf8");

    const preview = await buildMarkdownBundlePreview({ rootDir, target: "plans" });
    const stats = renderMarkdownBundlePreview(preview, "stats");

    expect(stats).toContain("TEMPORARY READ-ONLY BUNDLE PREVIEW");
    expect(stats).toContain("<- largest");
  });
});
