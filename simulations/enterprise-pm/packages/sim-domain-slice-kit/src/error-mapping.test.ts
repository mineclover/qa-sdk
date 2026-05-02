// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { mapDomainErrorToHttp } from "./error-mapping.js";

describe("mapDomainErrorToHttp", () => {
  it("maps NotFoundError → 404 / NOT_FOUND", () => {
    const err = Object.assign(new Error("missing"), { name: "NotFoundError" });
    const { status, payload } = mapDomainErrorToHttp(err, "trace-1");
    expect(status).toBe(404);
    expect(payload.code).toBe("NOT_FOUND");
    expect(payload.message).toBe("missing");
    expect(payload.traceId).toBe("trace-1");
  });

  it("maps ValidationError → 400 / VALIDATION_ERROR", () => {
    const err = Object.assign(new Error("bad"), { name: "ValidationError" });
    const { status, payload } = mapDomainErrorToHttp(err, "t");
    expect(status).toBe(400);
    expect(payload.code).toBe("VALIDATION_ERROR");
  });

  it("maps ConflictError → 409 / CONFLICT", () => {
    const err = Object.assign(new Error("dup"), { name: "ConflictError" });
    const { status, payload } = mapDomainErrorToHttp(err, "t");
    expect(status).toBe(409);
    expect(payload.code).toBe("CONFLICT");
  });

  it("maps UnauthorizedError → 401 / UNAUTHORIZED", () => {
    const err = Object.assign(new Error("nope"), { name: "UnauthorizedError" });
    const { status } = mapDomainErrorToHttp(err, "t");
    expect(status).toBe(401);
  });

  it("maps ForbiddenError → 403 / FORBIDDEN", () => {
    const err = Object.assign(new Error("nope"), { name: "ForbiddenError" });
    const { status } = mapDomainErrorToHttp(err, "t");
    expect(status).toBe(403);
  });

  it("preserves explicit err.code over name-based default", () => {
    const err = Object.assign(new Error("x"), {
      name: "NotFoundError",
      code: "ASSIGNMENT_NOT_FOUND",
    });
    const { status, payload } = mapDomainErrorToHttp(err, "t");
    expect(status).toBe(404);
    expect(payload.code).toBe("ASSIGNMENT_NOT_FOUND");
  });

  it("includes details when provided", () => {
    const err = Object.assign(new Error("v"), {
      name: "ValidationError",
      details: { field: "name" },
    });
    const { payload } = mapDomainErrorToHttp(err, "t");
    expect(payload.details).toEqual({ field: "name" });
  });

  it("falls back to 500 / INTERNAL_ERROR for unknown errors", () => {
    const err = new Error("kaboom");
    const { status, payload } = mapDomainErrorToHttp(err, "trace-99");
    expect(status).toBe(500);
    expect(payload.code).toBe("INTERNAL_ERROR");
    expect(payload.traceId).toBe("trace-99");
  });

  it("falls back to 500 for non-object thrown values", () => {
    const { status, payload } = mapDomainErrorToHttp("oops", "t");
    expect(status).toBe(500);
    expect(payload.code).toBe("INTERNAL_ERROR");
    expect(payload.message).toBe("oops");
  });
});
