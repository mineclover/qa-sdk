/**
 * activation gate + post-activation hook 동적 import 통합 테스트.
 *
 * server.ts의 buildActivationGate/buildPostActivationHook과 동일한
 * 동적 import 경로를 검증한다.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { createActivationGate } from "./activation-gate-adapter.js";
import { createPostActivationHook } from "./post-activation-hook.js";

describe("activation gate — 실제 spec-core 동적 import", () => {
  it("bootstrapDkg() → GraphRegistry 반환 + checkActivationReadiness 호출 가능", async () => {
    const specCore = await import("@qa-sdk/spec-core/propagation");
    const analysis = await import("@qa-sdk/spec-core/analysis");

    // bootstrapDkg가 GraphRegistry를 직접 반환하는지 확인 (.graph가 아님)
    const graph = (analysis as any).bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    expect(typeof graph.getAllNodes).toBe("function");
    expect(graph.getAllNodes().length).toBeGreaterThan(0);

    // checkActivationReadiness가 export되고 호출 가능한지
    expect(typeof specCore.checkActivationReadiness).toBe("function");

    // 실제 gate 생성 + check 호출
    const gate = createActivationGate({
      mode: "warn",
      graphProvider: () => graph,
      checkFn: specCore.checkActivationReadiness,
    });

    const result = await gate.check("tracking", "v1");
    expect(result.allowed).toBe(true);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it("strict 모드: DEMO_CATALOG prefix에 대한 gate check", async () => {
    const specCore = await import("@qa-sdk/spec-core/propagation");
    const analysis = await import("@qa-sdk/spec-core/analysis");

    const graph = (analysis as any).bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

    const gate = createActivationGate({
      mode: "strict",
      graphProvider: () => graph,
      checkFn: specCore.checkActivationReadiness,
    });

    // DEMO_CATALOG의 실제 prefix로 검사
    const result = await gate.check("cart_event", "v1");

    // 실제 DEMO DKG에서 cart_event에 대한 constraint violation이 있는지 여부에 관계없이
    // 구조적으로 올바른 결과가 반환되어야 함
    expect(typeof result.allowed).toBe("boolean");
    expect(Array.isArray(result.diagnostics)).toBe(true);
    for (const d of result.diagnostics) {
      expect(d).toHaveProperty("level");
      expect(d).toHaveProperty("source");
      expect(d).toHaveProperty("id");
      expect(d).toHaveProperty("message");
    }
  });
});

describe("post-activation hook — 실제 spec-core 동적 import", () => {
  it("DkgSqliteStore(:memory:)에 hook 결과 저장", async () => {
    const storeModule = await import("@qa-sdk/spec-core/store");

    const dkgStore = new (storeModule as any).DkgSqliteStore(":memory:", "test-hook");

    const hook = createPostActivationHook({ dkgStore });

    await hook.run({ prefix: "cart_event", versionId: "v2", previousVersion: "v1" });

    // store에 노드가 저장되었는지 확인
    const stats = dkgStore.stats();
    expect(stats.nodes).toBeGreaterThanOrEqual(1);
    expect(stats.edges).toBeGreaterThanOrEqual(1);

    // meta가 업데이트되었는지
    expect(dkgStore.getMeta("last_activation")).toBeTruthy();

    dkgStore.close();
  });

  it("dkgStore 없이도 에러 없이 실행", async () => {
    const hook = createPostActivationHook({});

    await expect(
      hook.run({ prefix: "auth_event", versionId: "v1", previousVersion: null }),
    ).resolves.toBeUndefined();
  });
});

describe("전체 activate 경로 시뮬레이션", () => {
  it("gate check → activate → hook 순서 실행", async () => {
    const specCore = await import("@qa-sdk/spec-core/propagation");
    const analysis = await import("@qa-sdk/spec-core/analysis");
    const storeModule = await import("@qa-sdk/spec-core/store");

    const graph = (analysis as any).bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

    // 1. Gate check
    const gate = createActivationGate({
      mode: "warn",
      graphProvider: () => graph,
      checkFn: specCore.checkActivationReadiness,
    });

    const gateResult = await gate.check("order_event", "v1");
    expect(gateResult.allowed).toBe(true);

    // 2. Activate (시뮬레이션 — 실제 versionStore 없이 게이트 결과만 확인)
    const diagnostics = gateResult.diagnostics;

    // 3. Post-activation hook
    const dkgStore = new (storeModule as any).DkgSqliteStore(":memory:", "e2e-test");

    const hook = createPostActivationHook({ dkgStore });

    await hook.run({ prefix: "order_event", versionId: "v2", previousVersion: "v1" });

    // 결과 검증: DKG store에 VersionEvent 기록됨
    const loadedGraph = dkgStore.loadGraph();
    const veNodes = loadedGraph.getAllNodes().filter((n: any) => n.kind === "version-event");
    expect(veNodes.length).toBeGreaterThanOrEqual(1);

    dkgStore.close();
  });
});
