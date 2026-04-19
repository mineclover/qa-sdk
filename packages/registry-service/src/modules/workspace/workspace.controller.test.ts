// @def.boundary registry-system
// @def.doc registry-system

import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../../app.module.js";
import { REGISTRY_SERVICE } from "../../registry-core.module.js";
import type { RegistryService } from "../../lib/registry-service.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe("WorkspaceController (Nest)", () => {
  it("POST /workspace/simulate and /workspace/analyze wrap draft-workspace helpers", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);
    const registry = app.get<RegistryService>(REGISTRY_SERVICE);

    await registry.registerPrefix({
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });
    await registry.registerPrefix({
      prefix: "action",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });
    await registry.registerPrefix({
      prefix: "perm",
      owner: "service-b",
      kind: "composite",
      numberType: "number",
    });

    await registry.createDraft({
      prefix: "role",
      versionId: "v1",
      baseVersionId: null,
      capacity: 10,
    });
    await registry.createDraft({
      prefix: "action",
      versionId: "v1",
      baseVersionId: null,
      capacity: 5,
    });
    await registry.createDraft({
      prefix: "perm",
      versionId: "v1",
      baseVersionId: null,
      capacity: 0,
      refs: [
        { prefix: "role", versionId: "v1" },
        { prefix: "action", versionId: "v1" },
      ],
    });

    const simulateResponse = await request(app, "POST", "/workspace/simulate", {
      changes: {
        role: { capacity: 12 },
      },
    });
    expect(simulateResponse.statusCode).toBe(200);
    const simulateBody = json<{
      ready: boolean;
      impact: Array<{ prefix: string; newShape: number[]; newProduct: number }>;
      releaseOrder: string[];
    }>(simulateResponse);
    expect(simulateBody.ready).toBe(true);
    expect(simulateBody.impact).toEqual([
      expect.objectContaining({
        prefix: "perm",
        newShape: [12, 5],
        newProduct: 60,
      }),
    ]);
    expect(simulateBody.releaseOrder).toContain("perm");

    const analyzeResponse = await request(app, "POST", "/workspace/analyze");
    expect(analyzeResponse.statusCode).toBe(200);
    const analyzeBody = json<{
      ready: boolean;
      drafts: Array<{ prefix: string; status: string }>;
      releaseOrder: string[];
    }>(analyzeResponse);
    expect(analyzeBody.ready).toBe(true);
    expect(analyzeBody.drafts).toEqual([
      expect.objectContaining({ prefix: "role", status: "draft" }),
      expect.objectContaining({ prefix: "action", status: "draft" }),
      expect.objectContaining({ prefix: "perm", status: "draft" }),
    ]);
    expect(analyzeBody.releaseOrder).toContain("perm");
    expect(analyzeBody.releaseOrder.indexOf("role")).toBeLessThan(analyzeBody.releaseOrder.indexOf("perm"));
    expect(analyzeBody.releaseOrder.indexOf("action")).toBeLessThan(analyzeBody.releaseOrder.indexOf("perm"));
  });
});
