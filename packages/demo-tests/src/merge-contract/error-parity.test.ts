// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * 에러 패리티 계약: 같은 잘못된 입력에 대해 PermissionCodec, PrefixCodec, MetaCodec이
 * 모두 에러를 던지는지 검증한다.
 *
 * "거부해야 할 입력"에 대한 동작이 코덱 간 갈라지면 리팩터링 시 silent regression이 된다.
 */
import { describe, expect, it } from "vitest";
import { MetaCodec, type DecodeMap } from "index-meta";
import { PermissionCodec, type CodecDims } from "permission-engine";
import { PrefixCodec, createLabelRegistry, createBinder } from "weighted-index";

const DIMS: CodecDims = {
  services: ["shop/payment", "cms/auth"],
  types: ["api", "page"],
  resources: ["admin/teams", "billing/invoices", "dashboard"],
  actions: ["GET", "POST"],
};

const DECODE_MAP: DecodeMap = {
  indexId: "perm",
  versionId: "v1",
  shape: [DIMS.services.length, DIMS.types.length, DIMS.resources.length, DIMS.actions.length],
  size: DIMS.services.length * DIMS.types.length * DIMS.resources.length * DIMS.actions.length,
  dims: [
    { dimId: "service", snapshotId: "v1", kind: { type: "string_enum" }, entries: [...DIMS.services] },
    { dimId: "type", snapshotId: "v1", kind: { type: "string_enum" }, entries: [...DIMS.types] },
    { dimId: "resource", snapshotId: "v1", kind: { type: "string_enum" }, entries: [...DIMS.resources] },
    { dimId: "action", snapshotId: "v1", kind: { type: "string_enum" }, entries: [...DIMS.actions] },
  ],
};

function createPrefixCodec(): PrefixCodec {
  const labels = createLabelRegistry({
    service: [{ version: "v1", ids: [...DIMS.services] }],
    type: [{ version: "v1", ids: [...DIMS.types] }],
    resource: [{ version: "v1", ids: [...DIMS.resources] }],
    action: [{ version: "v1", ids: [...DIMS.actions] }],
  });
  return new PrefixCodec(labels, {
    perm: {
      labels: ["service", "type", "resource", "action"],
      versions: [{
        version: "v1",
        labelVersions: { service: "v1", type: "v1", resource: "v1", action: "v1" },
      }],
    },
  });
}

describe("에러 패리티: unknown label 거부", () => {
  it("PermissionCodec이 unknown service를 거부한다", () => {
    const codec = new PermissionCodec("v1", DIMS);
    expect(() => codec.encodeRaw("unknown", "api", "admin/teams", "GET")).toThrow();
  });

  it("PrefixCodec이 unknown entity를 거부한다", () => {
    const codec = createPrefixCodec();
    expect(() => codec.encodeFromIds("perm", {
      service: "unknown",
      type: "api",
      resource: "admin/teams",
      action: "GET",
    })).toThrow();
  });

  it("MetaCodec이 unknown entity를 거부한다", () => {
    const codec = new MetaCodec(DECODE_MAP);
    expect(() => codec.encode({
      service: "unknown",
      type: "api",
      resource: "admin/teams",
      action: "GET",
    })).toThrow();
  });
});

describe("에러 패리티: out-of-range address 거부", () => {
  it("모든 코덱이 음수 주소를 거부한다", () => {
    const permCodec = new PermissionCodec("v1", DIMS);
    const metaCodec = new MetaCodec(DECODE_MAP);

    expect(() => permCodec.decode(-1)).toThrow();
    expect(() => metaCodec.decodeValue(-1)).toThrow();
  });

  it("모든 코덱이 size 이상 주소를 거부한다", () => {
    const permCodec = new PermissionCodec("v1", DIMS);
    const prefixCodec = createPrefixCodec();
    const metaCodec = new MetaCodec(DECODE_MAP);
    const size = permCodec.size;

    expect(() => permCodec.decode(size)).toThrow();
    expect(() => prefixCodec.decodeToIds({ prefix: "perm", v: "v1", id: size })).toThrow();
    expect(() => metaCodec.decodeValue(size)).toThrow();
  });
});

describe("에러 패리티: partial bind 누락값", () => {
  it("createBinder에서 누락 label로 resolve하면 에러", () => {
    const prefixCodec = createPrefixCodec();
    const binder = createBinder(prefixCodec, "perm", { service: "shop/payment" });

    // type, resource, action 중 하나 누락
    expect(() => binder.resolveId({
      type: "api",
      resource: "admin/teams",
      // action 누락
    } as Record<string, string>)).toThrow();
  });
});

describe("에러 패리티: parse error", () => {
  it("PermissionCodec.parse가 잘못된 형식을 거부한다", () => {
    const codec = new PermissionCodec("v1", DIMS);
    expect(() => codec.parse("")).toThrow();
    expect(() => codec.parse("not-a-number")).toThrow();
  });
});
