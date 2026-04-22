// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { DensityController } from "./density.controller.js";
import type {
  MarginalDensityResponse,
  MarginalDensityService,
} from "./density.service.js";

function makeSvc(response: MarginalDensityResponse) {
  return {
    compute: vi.fn(async () => response),
  } as unknown as MarginalDensityService;
}

const sampleResponse: MarginalDensityResponse = {
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

describe("DensityController", () => {
  it("GET /density — 200 + §5 §3.1 schema", async () => {
    const svc = makeSvc(sampleResponse);
    const ctrl = new DensityController(svc);
    const result = await ctrl.density("sim", "sim.bitmap", "uv1");
    expect(result.prefix).toBe("sim.bitmap");
    expect(result.axes).toHaveLength(1);
    expect(svc.compute).toHaveBeenCalledWith({
      catalog: "sim",
      prefix: "sim.bitmap",
      version: "uv1",
    });
  });

  it("GET /density — query param 누락 → BadRequest", async () => {
    const svc = makeSvc(sampleResponse);
    const ctrl = new DensityController(svc);
    await expect(ctrl.density("", "sim.bitmap", "uv1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(ctrl.density("sim", "", "uv1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(ctrl.density("sim", "sim.bitmap", "")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(svc.compute).not.toHaveBeenCalled();
  });
});
