// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";

import { DensityController } from "./density.controller.js";
import { DensityReadModelQuery } from "../../application/queries/density-read-model.query.js";
import type { MarginalDensityReadModel } from "../../domain/density.types.js";

const sample: MarginalDensityReadModel = {
  catalog: "sim",
  prefix: "sim.bitmap",
  version: "uv1",
  axes: [
    {
      axisName: "user_action",
      shapeCapacity: 4,
      observedDistinct: 2,
      marginalDensity: 0.5,
      unobservedEntries: ["x", "y"],
    },
  ],
  underutilizedAxes: [],
  saturatedAxes: [],
};

async function build(readModel: Partial<DensityReadModelQuery>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [DensityController],
    providers: [{ provide: DensityReadModelQuery, useValue: readModel }],
  }).compile();
  return moduleRef.get(DensityController);
}

describe("DensityController", () => {
  it("GET /density — 200 with §5 §3.1 schema", async () => {
    const compute = vi.fn(async () => sample);
    const ctrl = await build({ compute });
    const res = await ctrl.density("sim", "sim.bitmap", "uv1");
    expect(res.prefix).toBe("sim.bitmap");
    expect(compute).toHaveBeenCalledWith({
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
    });
  });

  it("GET /density — query param 누락 → BadRequest", async () => {
    const compute = vi.fn(async () => sample);
    const ctrl = await build({ compute });
    await expect(ctrl.density("", "sim.bitmap", "uv1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(ctrl.density("sim", "", "uv1")).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.density("sim", "sim.bitmap", "")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(compute).not.toHaveBeenCalled();
  });
});
