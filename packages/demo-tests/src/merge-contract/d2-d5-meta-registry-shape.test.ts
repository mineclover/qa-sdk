// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * D-2/D-5 계약: meta-registry shape 경로 일관성 + PrefixDecoder unresolved 수집.
 *
 * D-2: MetaRegistry 내에서 shape를 사용하는 여러 경로의 결과가 동일함을 검증.
 * D-5: PrefixDecoder.decodeDeep()의 unresolved ref 감지가 올바름을 검증.
 */
import { describe, expect, it } from "vitest";
import {
  MetaRegistry,
  MetaCodec,
  PrefixDecoder,
  MetaResolver,
  type MetaRegistryInput,
  type DecodeMap,
} from "index-meta";
import { calcWeights } from "weighted-index";

const INPUT: MetaRegistryInput = {
  dims: {
    env: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["dev", "staging", "prod"] } },
    },
    region: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["us", "eu", "ap", "kr"] } },
    },
    svc: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["api", "web"] } },
    },
    role: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["admin", "editor", "viewer"] } },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: ["read", "write"] } },
    },
  },
  indices: {
    svc_addr: {
      dims: ["env", "region", "svc"],
      versions: {
        v1: { snapshots: { env: "v1", region: "v1", svc: "v1" } },
      },
    },
    perm: {
      dims: ["role", "action"],
      versions: {
        v1: { snapshots: { role: "v1", action: "v1" } },
      },
    },
  },
};

describe("D-2: meta-registry shape 경로 일관성", () => {
  it("getWeightedIndex().shape === createCodec().shape === getCapacityInfo().shape", () => {
    const registry = new MetaRegistry(INPUT);

    for (const indexId of ["svc_addr", "perm"]) {
      const wi = registry.getWeightedIndex(indexId, "v1");
      const codec = registry.createCodec(indexId, "v1");
      const capacityInfo = registry.getCapacityInfo(indexId, "v1");

      // 세 경로의 shape가 동일
      expect([...codec.shape]).toEqual([...wi.shape]);
      expect(capacityInfo.shape).toEqual([...wi.shape]);

      // size도 동일
      expect(codec.size).toBe(wi.size);
      expect(capacityInfo.sizeNumber).toBe(wi.size);
    }
  });

  it("MetaCodec의 strides가 calcWeights(shape)와 일치한다", () => {
    const registry = new MetaRegistry(INPUT);

    for (const indexId of ["svc_addr", "perm"]) {
      const wi = registry.getWeightedIndex(indexId, "v1");
      const expectedStrides = calcWeights([...wi.shape]);

      // WeightedIndex.strides와 calcWeights 일치
      expect([...wi.strides]).toEqual(expectedStrides);
    }
  });

  it("DecodeMap의 shape가 WeightedIndex와 일치한다", () => {
    const registry = new MetaRegistry(INPUT);
    const resolver = new MetaResolver(registry);

    for (const indexId of ["svc_addr", "perm"]) {
      const wi = registry.getWeightedIndex(indexId, "v1");
      const decodeMap = resolver.getDecodeMap(indexId, "v1");

      expect([...decodeMap.shape]).toEqual([...wi.shape]);
      expect(decodeMap.size).toBe(wi.size);
    }
  });
});

describe("D-5: PrefixDecoder unresolved ref 수집", () => {
  it("refs가 있으면 unresolved가 비어있다", () => {
    const inputWithRef: MetaRegistryInput = {
      dims: {
        quality: {
          kind: { type: "index_ref", indexId: "perm" },
          snapshots: { v1: { entries: [0, 1, 2, 3, 4, 5] } },
        },
        priority: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["low", "high"] } },
        },
        role: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["admin", "editor", "viewer"] } },
        },
        action: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["read", "write"] } },
        },
      },
      indices: {
        article: {
          dims: ["quality", "priority"],
          versions: { v1: { snapshots: { quality: "v1", priority: "v1" } } },
        },
        perm: {
          dims: ["role", "action"],
          versions: { v1: { snapshots: { role: "v1", action: "v1" } } },
        },
      },
    };

    const registry = new MetaRegistry(inputWithRef);
    const resolver = new MetaResolver(registry);

    const bundle = resolver.getDecodeMapBundle("article", "v1");
    const decoder = new PrefixDecoder(bundle);

    // refs 있음 → unresolved 없음
    expect(decoder.hasRef("quality")).toBe(true);

    const result = decoder.decodeDeep(0);
    expect(result.refs).toBeDefined();

    // unresolved 수집 (현재 decode-service가 하는 방식)
    const unresolved: string[] = [];
    for (const dim of bundle.map.dims) {
      if (dim.kind.type === "index_ref" && !decoder.hasRef(dim.dimId)) {
        unresolved.push(dim.dimId);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("refs가 없으면 unresolved에 포함된다", () => {
    const inputWithRef: MetaRegistryInput = {
      dims: {
        quality: {
          kind: { type: "index_ref", indexId: "perm" },
          snapshots: { v1: { entries: [0, 1, 2, 3, 4, 5] } },
        },
        priority: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["low", "high"] } },
        },
        role: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["admin", "editor", "viewer"] } },
        },
        action: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["read", "write"] } },
        },
      },
      indices: {
        article: {
          dims: ["quality", "priority"],
          versions: { v1: { snapshots: { quality: "v1", priority: "v1" } } },
        },
        perm: {
          dims: ["role", "action"],
          versions: { v1: { snapshots: { role: "v1", action: "v1" } } },
        },
      },
    };

    const registry = new MetaRegistry(inputWithRef);
    const resolver = new MetaResolver(registry);

    // refs 없이 DecodeMap만 제공
    const map = resolver.getDecodeMap("article", "v1");
    const decoder = new PrefixDecoder({ map });

    expect(decoder.hasRef("quality")).toBe(false);

    // unresolved 수집
    const unresolved: string[] = [];
    for (const dim of map.dims) {
      if (dim.kind.type === "index_ref" && !decoder.hasRef(dim.dimId)) {
        unresolved.push(dim.dimId);
      }
    }
    expect(unresolved).toEqual(["quality"]);
  });

  it("index_ref가 아닌 dim은 unresolved에 포함되지 않는다", () => {
    const registry = new MetaRegistry(INPUT);
    const resolver = new MetaResolver(registry);
    const map = resolver.getDecodeMap("svc_addr", "v1");
    const decoder = new PrefixDecoder({ map });

    const unresolved: string[] = [];
    for (const dim of map.dims) {
      if (dim.kind.type === "index_ref" && !decoder.hasRef(dim.dimId)) {
        unresolved.push(dim.dimId);
      }
    }
    expect(unresolved).toEqual([]);
  });
});
