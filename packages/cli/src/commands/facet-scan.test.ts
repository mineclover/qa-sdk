import { describe, it, expect } from "vitest";
import { parseFacetMarker } from "./facet-scan.js";

describe("parseFacetMarker", () => {
  it("@facet 마커 → 파일 수준 선언", () => {
    expect(parseFacetMarker("// @facet")).toEqual({ type: "file", exports: [] });
  });

  it("@facet export fn1, fn2 → export 목록", () => {
    expect(parseFacetMarker("// @facet export validateOrder, calcDiscount")).toEqual({
      type: "file",
      exports: ["validateOrder", "calcDiscount"],
    });
  });

  it("@facet 없는 줄 → null", () => {
    expect(parseFacetMarker("// normal comment")).toBeNull();
    expect(parseFacetMarker("const x = 1;")).toBeNull();
  });

  it("# 주석 (Python) 지원", () => {
    expect(parseFacetMarker("# @facet")).toEqual({ type: "file", exports: [] });
  });

  it("JSDoc 스타일 * 주석 지원", () => {
    expect(parseFacetMarker(" * @facet export foo")).toEqual({ type: "file", exports: ["foo"] });
  });
});
