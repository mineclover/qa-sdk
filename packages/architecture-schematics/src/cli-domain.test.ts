import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("qa-scaffold domain CLI", () => {
  it("generates a domain slice on the real filesystem and validates it", async () => {
    const root = join(tmpdir(), `qa-scaffold-domain-${process.pid}-${Date.now()}`);
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src/app.module.ts"),
      [
        'import { Module } from "@nestjs/common";',
        "",
        "@Module({",
        "  imports: [],",
        "})",
        "export class AppModule {}",
        "",
      ].join("\n"),
    );

    const cli = join(process.cwd(), "dist/cli.js");
    await execFileAsync(process.execPath, [
      cli,
      "domain",
      "inventory-item",
      "--parent-module",
      "src/app.module.ts",
      "--bff",
      "--skip-format",
    ], { cwd: root });

    await execFileAsync(process.execPath, [
      cli,
      "validate",
      "src/modules",
    ], { cwd: root });

    const parentModule = await readFile(join(root, "src/app.module.ts"), "utf-8");
    expect(parentModule).toContain(
      'import { InventoryItemModule } from "./modules/inventory-item/inventory-item.module";',
    );
    expect(parentModule).toContain("imports: [InventoryItemModule]");

    const bff = await readFile(
      join(root, "src/modules/inventory-item/presentation/bff/inventory-item-detail.bff.ts"),
      "utf-8",
    );
    expect(bff).toContain("InventoryItemReadModelPort");
    expect(bff).not.toContain("InventoryItemEntity");

    const openapi = await readFile(
      join(root, "src/modules/inventory-item/contracts/openapi/domains/inventory-item/spec.json"),
      "utf-8",
    );
    expect(openapi).toContain("/bff/inventory-item/{id}");
  });
});
