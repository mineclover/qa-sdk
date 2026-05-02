import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildHttpHeader,
  parseHttpHeader,
  type HttpHeader,
} from "./http-header.js";

describe("HTTP header grammar (#4)", () => {
  it("builds x-canary-stage from canonical input", () => {
    const out = buildHttpHeader({
      kind: "header",
      domain: "canary",
      attr: "stage",
    });
    expect(out).toBe("x-canary-stage");
  });

  it("builds x-trace-decision-id (multi-segment attr)", () => {
    const out = buildHttpHeader({
      kind: "header",
      domain: "trace",
      attr: "decision-id",
    });
    expect(out).toBe("x-trace-decision-id");
  });

  it("parses x-service-version back to original shape", () => {
    const orig: HttpHeader = {
      kind: "header",
      domain: "service",
      attr: "version",
    };
    expect(parseHttpHeader(buildHttpHeader(orig))).toEqual(orig);
  });

  it("rejects domain outside allowlist", () => {
    expect(() =>
      buildHttpHeader({
        kind: "header",
        domain: "auth" as never,
        attr: "token",
      }),
    ).toThrow();
  });

  it("rejects PascalCase attr (kebab-case 위반)", () => {
    expect(() =>
      buildHttpHeader({
        kind: "header",
        domain: "canary",
        attr: "Stage" as never,
      }),
    ).toThrow();
  });

  it("rejects parsing of X-Canary-Stage (case 위반)", () => {
    expect(() => parseHttpHeader("X-Canary-Stage")).toThrow();
  });

  it("rejects parsing of header without x- prefix", () => {
    expect(() => parseHttpHeader("canary-stage")).toThrow();
  });

  it("rejects parsing of header with unknown domain", () => {
    expect(() => parseHttpHeader("x-auth-token")).toThrow();
  });

  it("roundtrip property", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("service", "canary", "trace", "sim"),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/),
        (domain, attr) => {
          const orig: HttpHeader = { kind: "header", domain, attr };
          expect(parseHttpHeader(buildHttpHeader(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
