// @def.boundary observability-system-root
// @def.doc observability-system-root

import { describe, expect, it } from "vitest";
import { createLabelRegistry, PrefixCodec } from "weighted-index";
import { buildAddressRanges } from "./address-ranges.js";

// ── Test Fixture ───────────────────────────────────────

const labels = createLabelRegistry({
  env:    [{ version: "v1", ids: ["dev", "prod"] }],
  region: [{ version: "v1", ids: ["asia", "usa"] }],
  svc:    [{ version: "v1", ids: ["web", "api"] }],
});

const codec = new PrefixCodec(labels, {
  infra: {
    labels: ["env", "region", "svc"],
    versions: [
      { version: "v1", labelVersions: { env: "v1", region: "v1", svc: "v1" } },
    ],
  },
});

// shape = [2, 2, 2] → capacity = 8

describe("buildAddressRanges", () => {
  it("와일드카드 전체 범위를 반환한다", () => {
    const ranges = buildAddressRanges(codec, {
      prefix: "infra",
      constraints: [null, null, null],
    });

    // 전체: [0, 7]
    expect(ranges).toEqual([[0, 7]]);
  });

  it("단일 차원 고정 시 연속 범위를 반환한다", () => {
    const ranges = buildAddressRanges(codec, {
      prefix: "infra",
      constraints: ["1", null, null],  // env=dev (position 1)
    });

    // env=1 → base 0, stride 4 → [0, 3]
    expect(ranges).toEqual([[0, 3]]);
  });

  it("다중 차원 고정 시 정확한 범위를 반환한다", () => {
    const ranges = buildAddressRanges(codec, {
      prefix: "infra",
      constraints: ["1", "1", null],  // env=dev, region=asia
    });

    // env=1,region=1 → [0, 1]
    expect(ranges).toEqual([[0, 1]]);
  });

  it("모든 차원 고정 시 단일 주소를 반환한다", () => {
    const ranges = buildAddressRanges(codec, {
      prefix: "infra",
      constraints: ["1", "1", "1"],
    });

    expect(ranges).toEqual([[0, 0]]);
  });

  it("범위 제약 조건을 지원한다", () => {
    const ranges = buildAddressRanges(codec, {
      prefix: "infra",
      constraints: ["1-2", null, null],  // env=dev or prod
    });

    // 모든 env → 전체 범위
    expect(ranges).toEqual([[0, 7]]);
  });

  it("버전 지정이 동작한다", () => {
    const ranges = buildAddressRanges(codec, {
      prefix: "infra",
      version: "v1",
      constraints: [null, null, null],
    });

    expect(ranges).toEqual([[0, 7]]);
  });
});
