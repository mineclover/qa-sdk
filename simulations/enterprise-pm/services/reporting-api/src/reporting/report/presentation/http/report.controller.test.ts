// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";

import { ReportController } from "./report.controller.js";
import { ReportReadModelQuery } from "../../application/queries/report-read-model.query.js";
import { ReportAdminPort } from "../../application/ports/report-admin.port.js";
import { ReportNotFoundException } from "../../domain/index.js";
import type { ReportReadModel } from "../../domain/report.types.js";
import type { ReportId } from "../../domain/report.ids.js";

async function build({
  readModel,
  admin,
}: {
  readModel: Partial<ReportReadModelQuery>;
  admin: Partial<ReportAdminPort>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ReportController],
    providers: [
      { provide: ReportReadModelQuery, useValue: readModel },
      { provide: ReportAdminPort, useValue: admin },
    ],
  }).compile();
  return moduleRef.get(ReportController);
}

const sample: ReportReadModel = {
  id: "r-1" as ReportId,
  name: "weekly",
  queryDefinition: "{}",
  createdBy: "alice",
  createdAt: "2026-04-22T00:00:00.000Z",
  updatedAt: "2026-04-22T00:00:00.000Z",
};

describe("ReportController", () => {
  it("POST /reports — calls admin.create and returns shape", async () => {
    const admin = { create: vi.fn(async () => sample) };
    const ctrl = await build({ readModel: {}, admin });
    const res = await ctrl.create({
      name: "weekly",
      queryDefinition: "{}",
      createdBy: "alice",
    });
    expect(res).toEqual(sample);
    expect(admin.create).toHaveBeenCalled();
  });

  it("POST validation — zod throws for empty name", async () => {
    const ctrl = await build({
      readModel: {},
      admin: { create: vi.fn() },
    });
    await expect(ctrl.create({ name: "" })).rejects.toThrow();
  });

  it("GET /reports — list returns from read model", async () => {
    const ctrl = await build({
      readModel: { listAll: vi.fn(async () => [sample]) },
      admin: {},
    });
    const all = await ctrl.list();
    expect(all).toHaveLength(1);
  });

  it("GET /reports/:id — 200 with read model", async () => {
    const ctrl = await build({
      readModel: { findDetail: vi.fn(async () => sample) },
      admin: {},
    });
    expect(await ctrl.get("r-1")).toEqual(sample);
  });

  it("GET /reports/:id — missing throws ReportNotFoundException", async () => {
    const ctrl = await build({
      readModel: { findDetail: vi.fn(async () => null) },
      admin: {},
    });
    await expect(ctrl.get("missing")).rejects.toBeInstanceOf(ReportNotFoundException);
    await expect(ctrl.get("missing")).rejects.toMatchObject({
      name: "NotFoundError",
      code: "REPORT_NOT_FOUND",
    });
  });

  it("PUT /reports/:id — calls admin.update", async () => {
    const updated = { ...sample, name: "renamed" };
    const admin = { update: vi.fn(async () => updated) };
    const ctrl = await build({ readModel: {}, admin });
    const res = await ctrl.update("r-1", { name: "renamed" });
    expect(res.name).toBe("renamed");
    expect(admin.update).toHaveBeenCalledWith({ id: "r-1", name: "renamed" });
  });

  it("DELETE /reports/:id — returns deleted status", async () => {
    const admin = { delete: vi.fn(async () => undefined) };
    const ctrl = await build({ readModel: {}, admin });
    expect(await ctrl.remove("r-1")).toEqual({ status: "deleted" });
    expect(admin.delete).toHaveBeenCalledWith({ id: "r-1" });
  });
});
