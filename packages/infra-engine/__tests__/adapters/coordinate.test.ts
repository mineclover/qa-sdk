import { describe, it, expect } from "vitest";
import { createCoordinateAdapter } from "../../src/adapters/coordinate.js";

describe("CoordinateAdapter", () => {
  const coord = createCoordinateAdapter();

  it("resolveSvcRef → null (fail-open)", () => {
    expect(coord.resolveSvcRef("ingest-server", "dev", "local")).toBeNull();
  });

  it("encodeDeployEvent with null svcRef → empty", () => {
    expect(coord.encodeDeployEvent(null, "deploy")).toEqual({});
  });

  it("encodeDeployEvent with svcRef → empty (TODO: 실인코딩)", () => {
    expect(coord.encodeDeployEvent("42", "deploy", "ci")).toEqual({});
  });

  it("encodeHealthEvent with null svcRef → empty", () => {
    expect(coord.encodeHealthEvent(null, "healthy")).toEqual({});
  });

  it("encodeHealthEvent with svcRef → empty (TODO: 실인코딩)", () => {
    expect(coord.encodeHealthEvent("42", "healthy")).toEqual({});
  });
});
