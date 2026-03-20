import { describe, it, expect } from "vitest";
import { InMemoryRegistry } from "./registry-port.js";
import { publishSpec } from "./publish.js";
import type { PrefixSpec } from "../spec/prefix-spec.types.js";

describe("publishSpec", () => {
  it("new 모드 — 새 prefix 등록 + draft 생성", async () => {
    const registry = new InMemoryRegistry();
    const spec: PrefixSpec = {
      id: "test-prefix", version: "v1",
      dims: {
        dim1: { kind: "axis", axisId: "role" },
        dim2: { kind: "axis", axisId: "action" },
      },
      export: { dims: ["dim1", "dim2"], pattern: "{dim1}.{dim2}" },
    };

    const result = await publishSpec(registry, { spec, owner: "test-team", mode: "new" });

    expect(result.prefix).toBe("test-prefix");
    expect(result.versionId).toBe("v1");
    expect(result.status).toBe("draft");
    expect(await registry.hasPrefix("test-prefix")).toBe(true);
    expect(await registry.getVersionStatus("test-prefix", "v1")).toBe("draft");
  });

  it("version 모드 — 기존 prefix에 새 version", async () => {
    const registry = new InMemoryRegistry();
    const spec1: PrefixSpec = {
      id: "test", version: "v1",
      dims: { d: { kind: "axis", axisId: "role" } },
      export: { dims: ["d"], pattern: "{d}" },
    };
    await publishSpec(registry, { spec: spec1, owner: "team", mode: "new" });

    const spec2: PrefixSpec = { ...spec1, version: "v2" };
    const result = await publishSpec(registry, { spec: spec2, owner: "team", mode: "version", baseVersion: "v1" });

    expect(result.versionId).toBe("v2");
    expect(await registry.getVersionStatus("test", "v2")).toBe("draft");
  });

  it("prefix_ref가 있으면 kind=composite", async () => {
    const registry = new InMemoryRegistry();
    // 먼저 참조 대상 등록 + activate
    await registry.registerPrefix({ prefix: "service", owner: "infra", kind: "leaf", numberType: "number" });
    await registry.createDraft({ prefix: "service", versionId: "v1", baseVersionId: null, capacity: 100 });
    await registry.release("service", "v1");
    await registry.activate("service", "v1");

    const spec: PrefixSpec = {
      id: "composite-test", version: "v1",
      dims: {
        svc: { kind: "prefix_ref", prefixId: "service" },
        role: { kind: "axis", axisId: "role" },
      },
      export: { dims: ["svc", "role"], pattern: "{svc}.{role}" },
    };

    const result = await publishSpec(registry, { spec, owner: "team", mode: "new" });
    expect(result.refs.length).toBe(1);
    expect(result.refs[0].prefix).toBe("service");
  });
});
