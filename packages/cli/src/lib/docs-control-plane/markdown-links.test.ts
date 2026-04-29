// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildMarkdownLinkRepair,
  buildMarkdownLinkRebase,
  scanMarkdownLinks,
} from "./markdown-links.js";

describe("docs-control-plane markdown links", () => {
  it("scans valid, missing, external, anchor, and ignored code links", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-links-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n", "utf8");
    await writeFile(join(rootDir, "source.md"), [
      "# Source",
      "## Local",
      "",
      "[valid](./target.md)",
      "[missing](./missing.md)",
      "[external](https://example.com)",
      "[anchor](#local)",
      "`[ignored](./missing.md)`",
      "```",
      "[ignored-fence](./missing.md)",
      "```",
      "",
    ].join("\n"), "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });

    expect(result.counts.files).toBe(2);
    expect(result.parser).toBe("markdown-it");
    expect(result.counts.valid).toBe(2);
    expect(result.counts.missing).toBe(1);
    expect(result.counts.external).toBe(1);
    expect(result.links.find((link) => link.rawHref === "#local")?.status).toBe("valid");
    expect(result.links.map((link) => link.rawHref)).not.toContain("./missing.md`");
  });

  it("uses markdown-it tokens for inline links while preserving editable href ranges", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-it-inline-links-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n", "utf8");
    await writeFile(join(rootDir, "source.md"), "[valid **label**](./target.md \"title\")\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(link).toMatchObject({
      kind: "inline",
      rawHref: "./target.md",
      status: "valid",
      resolvedPath: "target.md",
    });
    expect(link?.range).toEqual({ start: 18, end: 29 });
  });

  it("keeps the href range on the URL token when the label repeats the href text", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-it-range-links-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n", "utf8");
    await writeFile(join(rootDir, "source.md"), "[./target.md](./target.md)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(link?.status).toBe("valid");
    expect(link?.range).toEqual({ start: 14, end: 25 });
  });

  it("keeps markdown autolinks scannable even without inline link syntax", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-autolinks-"));
    await writeFile(join(rootDir, "source.md"), "<https://example.com>\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(link).toMatchObject({
      rawHref: "https://example.com",
      status: "external",
      range: { start: 1, end: 20 },
    });
  });

  it("keeps reference definition targets as repairable link records", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-reference-links-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n", "utf8");
    await writeFile(join(rootDir, "source.md"), [
      "[valid][target]",
      "",
      "[target]: ./target.md \"title\"",
      "",
    ].join("\n"), "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links.find((item) => item.kind === "definition");

    expect(result.counts.valid).toBe(1);
    expect(link).toMatchObject({
      rawHref: "./target.md",
      status: "valid",
      resolvedPath: "target.md",
    });
  });

  it("reports missing heading fragments and suggests matching headings", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-heading-links-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\n## Install Guide\n", "utf8");
    await writeFile(join(rootDir, "source.md"), "[target](./target.md#install)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(result.counts.headingMissing).toBe(1);
    expect(link?.status).toBe("heading-missing");
    expect(link?.headingCandidates[0]).toMatchObject({
      slug: "install-guide",
      nextHref: "./target.md#install-guide",
    });
  });

  it("does not treat GitHub-style line fragments as missing headings", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-line-fragment-links-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\ncontent\n", "utf8");
    await writeFile(join(rootDir, "source.md"), "[target](./target.md#L2)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(result.counts.headingMissing).toBe(0);
    expect(link?.status).toBe("valid");
    expect(link?.resolvedPath).toBe("target.md");
  });

  it("treats directory links as links to README or index markdown files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-directory-links-"));
    await mkdir(join(rootDir, "guide"), { recursive: true });
    await writeFile(join(rootDir, "guide", "README.md"), "# Guide\n", "utf8");
    await writeFile(join(rootDir, "source.md"), "[guide](./guide/)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(link?.status).toBe("valid");
    expect(link?.resolvedPath).toBe("guide/README.md");
    expect(link?.candidates).toEqual([]);
  });

  it("treats existing non-markdown file links as valid targets", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-file-links-"));
    await mkdir(join(rootDir, "assets"), { recursive: true });
    await writeFile(join(rootDir, "assets", "diagram.svg"), "<svg />\n", "utf8");
    await writeFile(join(rootDir, "source.md"), "![diagram](./assets/diagram.svg)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(result.counts.valid).toBe(1);
    expect(link?.status).toBe("valid");
    expect(link?.resolvedPath).toBe("assets/diagram.svg");
    expect(link?.resolvedKind).toBe("file");
  });

  it("treats existing directory links without markdown indexes as valid targets", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-plain-directory-links-"));
    await mkdir(join(rootDir, "assets", "screenshots"), { recursive: true });
    await writeFile(join(rootDir, "source.md"), "[screenshots](./assets/screenshots/)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(result.counts.valid).toBe(1);
    expect(link?.status).toBe("valid");
    expect(link?.resolvedPath).toBe("assets/screenshots");
    expect(link?.resolvedKind).toBe("directory");
  });

  it("resolves absolute local paths under the project root", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-absolute-path-links-"));
    await mkdir(join(rootDir, "docs"), { recursive: true });
    await writeFile(join(rootDir, "docs", "target.md"), "# Target\n", "utf8");
    await writeFile(join(rootDir, "source.md"), `[target](${join(rootDir, "docs", "target.md")})\n`, "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links[0];

    expect(result.counts.valid).toBe(1);
    expect(link?.status).toBe("valid");
    expect(link?.resolvedPath).toBe("docs/target.md");
  });

  it("warns when duplicate heading anchors make header references ambiguous", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-duplicate-heading-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\n## Same\n\n## Same\n\n[first](#same)\n[second](#same-1)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const firstHeadingLink = result.links.find((link) => link.rawHref === "#same");
    const secondHeadingLink = result.links.find((link) => link.rawHref === "#same-1");

    expect(result.counts.duplicateHeadings).toBe(1);
    expect(result.counts.repeatableHeadings).toBe(0);
    expect(result.counts.unmarkedRepeatableHeadings).toBe(1);
    expect(firstHeadingLink?.status).toBe("valid");
    expect(secondHeadingLink?.status).toBe("valid");
    expect(secondHeadingLink?.targetHeading?.line).toBe(5);
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "duplicate-heading-anchor")).toMatchObject({
      code: "duplicate-heading-anchor",
      path: "target.md",
    });
  });

  it("allows repeated headings when each heading has a unique marker anchor", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-repeat-heading-with-markers-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\n## Same ^same-a\n\n## Same ^same-b\n\n[first](#same-a)\n[second](#same-b)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });

    expect(result.counts.duplicateHeadings).toBe(0);
    expect(result.counts.repeatableHeadings).toBe(1);
    expect(result.counts.unmarkedRepeatableHeadings).toBe(0);
    expect(result.links.every((link) => link.status === "valid")).toBe(true);
  });

  it("warns repeated headings without unique marker anchors", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-repeat-heading-without-marker-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\n## Same\n\n## Same ^same-b\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });

    expect(result.counts.repeatableHeadings).toBe(0);
    expect(result.counts.unmarkedRepeatableHeadings).toBe(1);
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "repeatable-heading-without-marker")).toMatchObject({
      severity: "warning",
      path: "target.md",
    });
  });

  it("treats trailing heading markers as stable anchor aliases", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-heading-marker-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\n## 목적 ^purpose\n\n[marker](#purpose)\n[caret](#^purpose)\n[slug](#목적-purpose)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });

    expect(result.counts.headingMissing).toBe(0);
    expect(result.links.find((link) => link.rawHref === "#purpose")?.targetHeading).toMatchObject({
      markers: ["purpose"],
      line: 3,
    });
    expect(result.links.find((link) => link.rawHref === "#^purpose")?.status).toBe("valid");
    expect(result.links.find((link) => link.rawHref === "#목적-purpose")?.status).toBe("valid");
  });

  it("reports heading lines relative to the full markdown file when frontmatter exists", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-heading-line-offset-"));
    await writeFile(join(rootDir, "target.md"), [
      "---",
      "def:",
      "  id: target",
      "---",
      "# Target",
      "",
      "## Same",
      "",
      "## Same",
      "",
    ].join("\n"), "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });

    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "repeatable-heading-without-marker")?.message)
      .toContain("line 7, line 9");
  });

  it("warns duplicate marker anchors separately from duplicate heading text", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-duplicate-marker-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\n## 목적 ^purpose\n\n## Goal ^purpose\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });

    expect(result.counts.duplicateHeadings).toBe(0);
    expect(result.counts.duplicateMarkers).toBe(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "duplicate-marker-anchor",
      path: "target.md",
    });
  });

  it("does not resolve duplicate marker anchors to an arbitrary first heading", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-ambiguous-marker-"));
    await writeFile(join(rootDir, "target.md"), "# Target\n\n## Scenario 1 ^overview\n\n## Scenario 2 ^overview\n\n[ambiguous](#overview)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links.find((item) => item.rawHref === "#overview");

    expect(result.counts.headingMissing).toBe(1);
    expect(result.counts.duplicateMarkers).toBe(1);
    expect(link?.status).toBe("heading-missing");
    expect(link?.headingCandidates).toHaveLength(2);
  });

  it("classifies repeated cases/test markers as repeatable contract markers", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-repeatable-contract-marker-"));
    await writeFile(join(rootDir, "target.cases.md"), "# Target\n\n## Scenario 1 ^overview\n\n## Scenario 2 ^overview\n\n[ambiguous](#overview)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links.find((item) => item.rawHref === "#overview");

    expect(result.counts.duplicateMarkers).toBe(0);
    expect(result.counts.repeatableMarkers).toBe(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "repeatable-contract-marker",
      severity: "info",
    });
    expect(link?.status).toBe("heading-missing");
  });

  it("does not use a single repeatable contract marker as a stable anchor", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-single-repeatable-contract-marker-"));
    await writeFile(join(rootDir, "target.test.md"), "# Target\n\n## Steps ^steps\n\n[steps](#steps)\n", "utf8");

    const result = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const link = result.links.find((item) => item.rawHref === "#steps");

    expect(result.counts.headingMissing).toBe(1);
    expect(link?.headingCandidates[0]).toMatchObject({
      slug: "steps-steps",
    });
  });

  it("uses a previous ledger identity to repair moved markdown links", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-links-ledger-"));
    await writeFile(join(rootDir, "source.md"), "[target](./old-target.md)\n", "utf8");
    await writeFile(join(rootDir, "old-target.md"), [
      "---",
      "def:",
      "  id: target-doc",
      "  scope: feature",
      "  aspect: func_def",
      "  depth: specification",
      "  lifecycle: approved",
      "---",
      "# Target",
      "",
    ].join("\n"), "utf8");
    const ledger = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });

    await rename(join(rootDir, "old-target.md"), join(rootDir, "new-target.md"));
    const scan = await scanMarkdownLinks({ rootDir, docsDirs: ["."], ledger });
    const result = await buildMarkdownLinkRepair(scan, { apply: true, threshold: 90 });

    expect(result.counts.planned).toBe(1);
    await expect(readFile(join(rootDir, "source.md"), "utf8")).resolves.toBe("[target](./new-target.md)\n");
  });

  it("detects links that are missing only because they use a different project root", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-links-root-"));
    await mkdir(join(rootDir, "docs", "guide"), { recursive: true });
    await mkdir(join(rootDir, "docs", "shared"), { recursive: true });
    await writeFile(join(rootDir, "docs", "guide", "source.md"), "[shared](shared/target.md)\n", "utf8");
    await writeFile(join(rootDir, "docs", "shared", "target.md"), "# Target\n", "utf8");

    const scan = await scanMarkdownLinks({ rootDir, docsDirs: ["docs"] });
    const missing = scan.links.find((link) => link.status === "missing");

    expect(scan.counts.rootResolvable).toBe(1);
    expect(missing?.resolvedPath).toBe("docs/guide/shared/target.md");
    expect(missing?.rootCandidates[0]).toMatchObject({
      root: "docs",
      path: "docs/shared/target.md",
      nextHref: "../shared/target.md",
    });
  });

  it("detects links that over-specify the docs root from a nested document", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-links-root-prefix-"));
    await mkdir(join(rootDir, "docs", "guide", "plans"), { recursive: true });
    await mkdir(join(rootDir, "docs", "shared"), { recursive: true });
    await writeFile(join(rootDir, "docs", "guide", "plans", "source.md"), "[shared](../../docs/shared/target.md)\n", "utf8");
    await writeFile(join(rootDir, "docs", "shared", "target.md"), "# Target\n", "utf8");

    const scan = await scanMarkdownLinks({ rootDir, docsDirs: ["docs"] });
    const missing = scan.links.find((link) => link.status === "missing");

    expect(scan.counts.rootResolvable).toBe(1);
    expect(missing?.rootCandidates[0]).toMatchObject({
      path: "docs/shared/target.md",
      nextHref: "../../shared/target.md",
      reason: "stripped-parent",
    });
  });

  it("detects links that should resolve from an ancestor directory", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-links-ancestor-"));
    await mkdir(join(rootDir, "docs", "proposal", "reviews"), { recursive: true });
    await writeFile(join(rootDir, "docs", "proposal", "03-decisions.md"), "# Decisions\n", "utf8");
    await writeFile(join(rootDir, "docs", "proposal", "reviews", "source.md"), "[decisions](./03-decisions.md)\n", "utf8");

    const scan = await scanMarkdownLinks({ rootDir, docsDirs: ["docs"] });
    const missing = scan.links.find((link) => link.status === "missing");

    expect(scan.counts.rootResolvable).toBe(1);
    expect(missing?.rootCandidates[0]).toMatchObject({
      path: "docs/proposal/03-decisions.md",
      nextHref: "../03-decisions.md",
      reason: "ancestor",
    });
  });

  it("repairs a root-resolvable missing link without requiring title similarity", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-links-root-repair-"));
    await mkdir(join(rootDir, "docs", "guide"), { recursive: true });
    await mkdir(join(rootDir, "docs", "shared"), { recursive: true });
    await writeFile(join(rootDir, "docs", "guide", "source.md"), "[shared](shared/target.md)\n", "utf8");
    await writeFile(join(rootDir, "docs", "shared", "target.md"), "# Different Title\n", "utf8");

    const scan = await scanMarkdownLinks({ rootDir, docsDirs: ["docs"] });
    const result = await buildMarkdownLinkRepair(scan, { apply: true });

    expect(result.counts.planned).toBe(1);
    await expect(readFile(join(rootDir, "docs", "guide", "source.md"), "utf8")).resolves.toBe("[shared](../shared/target.md)\n");
  });

  it("rebases valid links from one root prefix to another", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "qa-sdk-markdown-links-rebase-"));
    await writeFile(join(rootDir, "source.md"), "[target](./docs/target.md)\n", "utf8");
    await writeFile(join(rootDir, "docs-target-placeholder.md"), "# Placeholder\n", "utf8");
    await mkdir(join(rootDir, "docs"), { recursive: true });
    await writeFile(join(rootDir, "docs", "target.md"), "# Target\n", "utf8");

    const scan = await scanMarkdownLinks({ rootDir, docsDirs: ["."] });
    const result = await buildMarkdownLinkRebase(scan, {
      fromRoot: "docs",
      toRoot: "archive/docs",
      apply: false,
    });

    expect(result.counts.planned).toBe(1);
    expect(result.changes[0]?.nextHref).toBe("./archive/docs/target.md");
  });
});
