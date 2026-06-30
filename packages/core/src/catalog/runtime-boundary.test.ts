// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from "vitest";
import type { Catalog } from "./catalog.types.js";
import {
  decodePrefix,
  decodePrefixPartial,
  encodePrefix,
  encodePrefixByValue,
  getPrefixShape,
  resolveAddress,
} from "./runtime.js";

const TEST_CATALOG: Catalog = {
  id: "test",
  name: "Test Catalog",
  axes: {
    env: {
      id: "env",
      name: "환경",
      versions: { v1: { entries: ["dev", "prod"], capacity: 4 } },
    },
    role: {
      id: "role",
      name: "역할",
      versions: { v1: { entries: ["admin", "viewer"], capacity: 4 } },
    },
  },
  prefixes: {
    service: {
      id: "service",
      name: "서비스",
      labels: ["env"],
      dims: { env: { kind: "axis", axisId: "env" } },
      versions: [{ version: "v1", axisVersions: { env: "v1" } }],
    },
    permission: {
      id: "permission",
      name: "권한",
      labels: ["svc_ref", "role"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        role: { kind: "axis", axisId: "role" },
      },
      versions: [{
        version: "v1",
        axisVersions: { role: "v1" },
        refEntries: { svc_ref: { values: [0, 1], refVersion: "v1" } },
      }],
    },
  },
};

describe("catalog runtime closed-space boundaries", () => {
  it("encodePrefix rejects positions outside dim capacity", () => {
    expect(() => encodePrefix(TEST_CATALOG, "permission", "v1", {
      svc_ref: 2,
      role: 0,
    })).toThrow(/position.*svc_ref.*\[0, 1\]/);

    expect(() => encodePrefix(TEST_CATALOG, "permission", "v1", {
      svc_ref: 0,
      role: -1,
    })).toThrow(/position.*role.*\[0, 3\]/);
  });

  it("encodePrefixByValue rejects unknown ref values", () => {
    expect(() => encodePrefixByValue(TEST_CATALOG, "permission", "v1", {
      svc_ref: 99,
      role: "admin",
    })).toThrow(/Unknown ref value 99/);
  });

  it("decodePrefix rejects addresses outside prefix capacity", () => {
    const { capacity } = getPrefixShape(TEST_CATALOG, "permission", "v1");
    expect(() => decodePrefix(TEST_CATALOG, "permission", "v1", capacity)).toThrow(
      /address.*permission@v1.*\[0, 7\]/,
    );
  });

  it("decodePrefixPartial uses the same address boundary as full decode", () => {
    const { capacity } = getPrefixShape(TEST_CATALOG, "permission", "v1");
    expect(() => decodePrefixPartial(
      TEST_CATALOG,
      "permission",
      "v1",
      capacity,
      ["svc_ref"],
    )).toThrow(/address.*permission@v1.*\[0, 7\]/);
  });

  it("resolveAddress rejects addresses outside prefix capacity before recursive decode", () => {
    const { capacity } = getPrefixShape(TEST_CATALOG, "permission", "v1");
    expect(() => resolveAddress(TEST_CATALOG, "permission", "v1", capacity)).toThrow(
      /address.*permission@v1.*\[0, 7\]/,
    );
  });
});
