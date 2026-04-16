import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { createOntologyPackScaffoldPlan } from "./ontology-pack-scaffold-plan.js";
import { writeOntologyPackScaffoldPlan } from "./ontology-pack-scaffold-write.js";

describe("ontology pack scaffold write mode", () => {
  it("writes the dry-run preview file list into a temporary workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-pack-scaffold-write-"));
    try {
      const plan = createOntologyPackScaffoldPlan({
        packId: "risk-model-ontology",
        rootDir: dir,
        mode: "write",
        implementationPackage: "generated-risk-ontology",
        packageRoot: "packages/generated-risk-ontology",
        docsDir: "docs/specs/generated-risk-ontology",
      });

      const summary = await writeOntologyPackScaffoldPlan(plan, { rootDir: dir });

      expect(summary).toMatchObject({
        mode: "write",
        status: "written",
        writesApplied: true,
        fileCount: plan.preview.files.length,
        writtenCount: plan.preview.files.length,
        blockedCount: 0,
        diagnostics: [],
        knownPackRegistrationCandidate: {
          targetPath: "packages/cli/src/lib/known-ontology-packs.ts",
          applyMode: "candidate-only",
        },
      });
      expect(summary.files.map((file) => file.path)).toEqual(
        plan.preview.files.map((file) => file.path),
      );

      for (const file of plan.preview.files) {
        const writtenContent = await readFile(join(dir, file.path), "utf8");
        expect(writtenContent).toBe(file.content);
      }
      expect(await readFile(
        join(dir, "packages/generated-risk-ontology/src/internal/risk-model-ontology-pack.ts"),
        "utf8",
      )).toContain("validateRiskModelOntologyPack");
      expect(await readFile(
        join(dir, "docs/specs/generated-risk-ontology/risk-model-ontology-system.spec.md"),
        "utf8",
      )).toContain("operational-ontology-pack-interface");
      expect(existsSync(join(dir, "packages/cli/src/lib/known-ontology-packs.ts"))).toBe(false);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("blocks existing files without writing any additional scaffold outputs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qa-sdk-pack-scaffold-existing-"));
    try {
      const plan = createOntologyPackScaffoldPlan({
        packId: "risk-model-ontology",
        rootDir: dir,
        mode: "write",
        implementationPackage: "generated-risk-ontology",
        packageRoot: "packages/generated-risk-ontology",
        docsDir: "docs/specs/generated-risk-ontology",
      });
      const existingFile = plan.componentSchemaFiles[0]!;
      const existingPath = join(dir, existingFile.path);
      await mkdir(dirname(existingPath), { recursive: true });
      await writeFile(existingPath, "existing content\n", "utf8");

      const summary = await writeOntologyPackScaffoldPlan(plan, { rootDir: dir });

      expect(summary).toMatchObject({
        mode: "write",
        status: "blocked",
        writesApplied: false,
        writtenCount: 0,
        blockedCount: 1,
      });
      expect(summary.diagnostics).toEqual([
        expect.objectContaining({
          severity: "error",
          code: "existing-output-file",
          path: existingFile.path,
        }),
      ]);
      expect(summary.files.map((file) => file.path)).toEqual(
        plan.preview.files.map((file) => file.path),
      );
      expect(await readFile(existingPath, "utf8")).toBe("existing content\n");

      for (const file of plan.preview.files.filter((file) => file.path !== existingFile.path)) {
        expect(existsSync(join(dir, file.path))).toBe(false);
      }
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
