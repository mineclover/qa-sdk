// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { ResourceController } from "./resource.controller.js";
import { ResourceUseCase } from "../../application/use-cases/resource.use-case.js";
import { ResourceReadModelQuery } from "../../application/queries/resource-read-model.query.js";

async function build(args: {
  useCase?: Partial<ResourceUseCase>;
  readModel?: Partial<ResourceReadModelQuery>;
}) {
  const m = await Test.createTestingModule({
    controllers: [ResourceController],
    providers: [
      { provide: ResourceUseCase, useValue: args.useCase ?? {} },
      { provide: ResourceReadModelQuery, useValue: args.readModel ?? {} },
    ],
  }).compile();
  return m.get(ResourceController);
}

describe("ResourceController", () => {
  it("POST create + read-model 반환", async () => {
    const useCase = { create: vi.fn(async (cmd: { id: string }) => ({ id: cmd.id, status: "draft" })) };
    const detail = {
      id: "rsr_1",
      projectId: "p",
      requesterId: "u",
      resourceType: "consultant",
      description: "x",
      status: "draft",
      updatedAt: "x",
    };
    const readModel = { findDetail: vi.fn(async () => detail) };
    const c = await build({ useCase, readModel });
    expect(
      await c.create({
        projectId: "p",
        requesterId: "u",
        resourceType: "consultant",
        description: "x",
      }),
    ).toEqual(detail);
  });

  it("GET 미존재 → ResourceNotFoundException", async () => {
    const readModel = { findDetail: vi.fn(async () => null) };
    const c = await build({ readModel });
    await expect(c.get("missing")).rejects.toMatchObject({
      name: "NotFoundError",
      code: "RESOURCE_NOT_FOUND",
    });
  });
});
