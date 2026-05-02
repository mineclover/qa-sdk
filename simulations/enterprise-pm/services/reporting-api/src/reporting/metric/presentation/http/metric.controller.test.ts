// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";

import { MetricController } from "./metric.controller.js";
import { MetricReadModelQuery } from "../../application/queries/metric-read-model.query.js";
import { MetricAdminPort } from "../../application/ports/metric-admin.port.js";
import type { DailyMetricReadModel } from "../../domain/metric.types.js";
import type { MetricId, MetricKey } from "../../domain/metric.ids.js";

async function build({
  readModel,
  admin,
}: {
  readModel: Partial<MetricReadModelQuery>;
  admin: Partial<MetricAdminPort>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [MetricController],
    providers: [
      { provide: MetricReadModelQuery, useValue: readModel },
      { provide: MetricAdminPort, useValue: admin },
    ],
  }).compile();
  return moduleRef.get(MetricController);
}

const sample: DailyMetricReadModel = {
  id: "m-1" as MetricId,
  metricKey: "k.density" as MetricKey,
  date: "2026-04-22",
  value: 0.5,
  dimensions: "{}",
  computedAt: "2026-04-22T00:00:00.000Z",
};

describe("MetricController", () => {
  it("POST /metrics — calls admin.record and returns shape", async () => {
    const admin = { record: vi.fn(async () => sample) };
    const ctrl = await build({ readModel: {}, admin });
    const res = await ctrl.record({
      metricKey: "k.density",
      date: "2026-04-22",
      value: 0.5,
      dimensions: "{}",
    });
    expect(res.value).toBe(0.5);
    expect(admin.record).toHaveBeenCalled();
  });

  it("POST validation — zod throws for non-finite value", async () => {
    const ctrl = await build({
      readModel: {},
      admin: { record: vi.fn() },
    });
    await expect(
      ctrl.record({ metricKey: "k", date: "2026-04-22", value: Number.POSITIVE_INFINITY, dimensions: "{}" }),
    ).rejects.toThrow();
  });

  it("GET /metrics — listByKey delegates to read model", async () => {
    const ctrl = await build({
      readModel: { listByKey: vi.fn(async () => [sample]) },
      admin: {},
    });
    const res = await ctrl.list("k.density", "2026-04-22", "2026-04-23");
    expect(res).toHaveLength(1);
  });

  it("GET /metrics/keys — listKeys delegates", async () => {
    const ctrl = await build({
      readModel: { listKeys: vi.fn(async () => ["a", "b"]) },
      admin: {},
    });
    expect(await ctrl.listKeys()).toEqual(["a", "b"]);
  });
});
