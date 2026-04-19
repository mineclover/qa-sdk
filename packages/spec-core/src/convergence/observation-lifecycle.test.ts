// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * observation lifecycle 테스트 — 결정적 ID + auto-resolve + store 영속화.
 *
 * 검증 대상:
 * 1. metricsToObservations: 결정적 ID (timestamp 없음)
 * 2. metricsToObservations: 동일 metric → 동일 ID (멱등)
 * 3. resolveRecoveredMetrics: ok 복귀 시 auto-resolve
 * 4. DkgSqliteStore: upsert 덮어쓰기 + updateNode 영속화
 * 5. 반복 converge 시 observation 수 고정 (누적 안 함)
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { metricsToObservations, resolveRecoveredMetrics, collectMetrics } from "@qa-sdk/convergence";
import type { MetricValue, ObservationNode } from "@qa-sdk/convergence";
import { DkgSqliteStore } from "dkg/store";
import { bootstrapDkg } from "dkg";

// ── 결정적 ID ────────────────────────────────────────

describe("metricsToObservations — 결정적 ID", () => {
  const criticalMetric: MetricValue = {
    id: "metric:headroom:status",
    name: "축 여유 공간",
    value: 0,
    status: "critical",
    detail: "status: headroom=0",
    target: "status",
    measuredAt: "2026-03-21",
  };

  const warningMetric: MetricValue = {
    id: "metric:skew:build_event",
    name: "배포 버전 스큐",
    value: 3,
    status: "warning",
    detail: "build_event: 3개 version",
    target: "build_event",
    measuredAt: "2026-03-21",
  };

  const okMetric: MetricValue = {
    id: "metric:headroom:role",
    name: "축 여유 공간",
    value: 5,
    status: "ok",
    target: "role",
    measuredAt: "2026-03-21",
  };

  it("ID에 timestamp가 포함되지 않음", () => {
    const obs = metricsToObservations([criticalMetric]);

    expect(obs).toHaveLength(1);
    expect(obs[0].id).toBe("OBS-METRIC-metric-headroom-status");
    // timestamp 패턴 (13자리 숫자) 미포함
    expect(obs[0].id).not.toMatch(/\d{13}/);
  });

  it("동일 metric → 동일 ID (멱등)", () => {
    const obs1 = metricsToObservations([criticalMetric], { date: "2026-03-21" });
    const obs2 = metricsToObservations([criticalMetric], { date: "2026-03-22" });

    expect(obs1[0].id).toBe(obs2[0].id);
    // date만 다르고 ID는 동일
    expect(obs1[0].date).toBe("2026-03-21");
    expect(obs2[0].date).toBe("2026-03-22");
  });

  it("ok metric은 observation을 생성하지 않음", () => {
    const obs = metricsToObservations([okMetric]);
    expect(obs).toHaveLength(0);
  });

  it("여러 metric → 각각 결정적 ID", () => {
    const obs = metricsToObservations([criticalMetric, warningMetric, okMetric]);

    expect(obs).toHaveLength(2);
    expect(obs[0].id).toBe("OBS-METRIC-metric-headroom-status");
    expect(obs[1].id).toBe("OBS-METRIC-metric-skew-build_event");
  });

  it("critical metric은 suggestion 포함", () => {
    const obs = metricsToObservations([criticalMetric]);
    expect(obs[0].suggestion).toBeDefined();
  });

  it("warning metric은 suggestion 미포함", () => {
    const obs = metricsToObservations([warningMetric]);
    expect(obs[0].suggestion).toBeUndefined();
  });
});

// ── auto-resolve ──────────────────────────────────

describe("resolveRecoveredMetrics — ok 복귀 시 자동 해소", () => {
  const existingObs: ObservationNode[] = [
    {
      kind: "observation",
      id: "OBS-METRIC-metric-headroom-status",
      date: "2026-03-20",
      source: "metric",
      subjects: ["status"],
      finding: "[critical] 축 여유 공간: headroom=0",
    },
    {
      kind: "observation",
      id: "OBS-METRIC-metric-skew-build_event",
      date: "2026-03-20",
      source: "metric",
      subjects: ["build_event"],
      finding: "[warning] 배포 스큐",
    },
    {
      kind: "observation",
      id: "OBS-MANUAL-something",
      date: "2026-03-20",
      source: "manual",
      subjects: ["x"],
      finding: "수동 관측",
    },
  ];

  it("ok 복귀한 metric의 observation을 resolve", () => {
    const metrics: MetricValue[] = [
      { id: "metric:headroom:status", name: "", value: 5, status: "ok", measuredAt: "" },
      { id: "metric:skew:build_event", name: "", value: 1, status: "warning", measuredAt: "" },
    ];

    const resolved = resolveRecoveredMetrics(metrics, existingObs);

    // headroom:status만 ok → 해당 observation만 resolve
    expect(resolved).toHaveLength(1);
    expect(resolved[0].id).toBe("OBS-METRIC-metric-headroom-status");
    expect((resolved[0] as any).resolution).toBeDefined();
    expect((resolved[0] as any).resolution.outcome).toBe("accepted");
    expect((resolved[0] as any).resolution.decisionId).toBe("AUTO-RESOLVE");
  });

  it("이미 해결된 observation은 건너뜀", () => {
    const alreadyResolved: ObservationNode[] = [
      {
        ...existingObs[0],
        resolution: { decisionId: "DEC-1", outcome: "accepted" },
      } as any,
    ];

    const metrics: MetricValue[] = [
      { id: "metric:headroom:status", name: "", value: 5, status: "ok", measuredAt: "" },
    ];

    const resolved = resolveRecoveredMetrics(metrics, alreadyResolved);
    expect(resolved).toHaveLength(0);
  });

  it("수동 observation은 건너뜀 (OBS-METRIC- prefix만 대상)", () => {
    const metrics: MetricValue[] = [
      { id: "metric:headroom:status", name: "", value: 5, status: "ok", measuredAt: "" },
    ];

    // OBS-MANUAL은 metric 기반이 아니므로 무시
    const resolved = resolveRecoveredMetrics(metrics, [existingObs[2]]);
    expect(resolved).toHaveLength(0);
  });

  it("모든 metric이 ok가 아니면 빈 배열", () => {
    const metrics: MetricValue[] = [
      { id: "metric:headroom:status", name: "", value: 0, status: "critical", measuredAt: "" },
    ];

    const resolved = resolveRecoveredMetrics(metrics, existingObs);
    expect(resolved).toHaveLength(0);
  });
});

// ── Store 영속화 + 멱등 반복 ─────────────────────

describe("observation store 멱등성 — 반복 converge 시 누적 안 함", () => {
  it("동일 observation을 3회 upsert → 노드 수 1건 유지", () => {
    const store = new DkgSqliteStore(":memory:", "idempotent-test");

    const obs: ObservationNode = {
      kind: "observation",
      id: "OBS-METRIC-metric-headroom-status",
      date: "2026-03-21",
      source: "metric",
      subjects: ["status"],
      finding: "[critical] headroom=0",
    };

    // 3회 저장
    for (let i = 0; i < 3; i++) {
      store.saveUsageSnapshotWithObservations(
        {
          collectionPeriod: { from: "2026-03-21", to: "2026-03-21" },
          entryUsages: [],
          addressUsages: [],
          coOccurrences: [],
          versionUsages: [],
        } as any,
        [obs],
      );
    }

    // 노드는 1건만 존재 (upsert)
    const graph = store.loadGraph();
    const obsNodes = graph.getAllNodes().filter((n: any) => n.id === obs.id);
    expect(obsNodes).toHaveLength(1);

    store.close();
  });

  it("updateNode으로 resolution 영속화 후 reload 시 유지", () => {
    const store = new DkgSqliteStore(":memory:", "persist-test");

    // 1. observation 저장
    const obs: ObservationNode = {
      kind: "observation",
      id: "OBS-METRIC-metric-skew-test",
      date: "2026-03-21",
      source: "metric",
      subjects: ["test_event"],
      finding: "[warning] skew",
    };
    store.saveNodes([obs], [{ type: "observes", from: obs.id, to: "test_event" }], "auto");

    // 2. resolution 추가 후 updateNode
    const resolved = {
      ...obs,
      resolution: { decisionId: "AUTO-RESOLVE", outcome: "accepted", note: "ok 복귀" },
    };
    store.updateNode(resolved as any);

    // 3. reload 후 resolution 유지 확인
    const graph = store.loadGraph();
    const loaded = graph.getNode(obs.id) as any;
    expect(loaded).toBeDefined();
    expect(loaded.resolution).toBeDefined();
    expect(loaded.resolution.outcome).toBe("accepted");

    store.close();
  });

  it("cleanStaleMetricObservations: timestamp 기반 ID만 제거", () => {
    const store = new DkgSqliteStore(":memory:", "cleanup-test");

    // timestamp 기반 (stale)
    const staleObs = {
      kind: "observation" as const,
      id: "OBS-METRIC-metric-headroom-status-1774080879115-1",
      date: "2026-03-20",
      source: "metric" as const,
      subjects: ["status"],
      finding: "stale",
    };

    // 결정적 ID (보존)
    const goodObs = {
      kind: "observation" as const,
      id: "OBS-METRIC-metric-headroom-status",
      date: "2026-03-21",
      source: "metric" as const,
      subjects: ["status"],
      finding: "good",
    };

    // 수동 (보존)
    const manualObs = {
      kind: "observation" as const,
      id: "OBS-MANUAL-something",
      date: "2026-03-21",
      source: "manual" as const,
      subjects: ["x"],
      finding: "manual",
    };

    store.saveNodes(
      [staleObs, goodObs, manualObs],
      [],
      "auto",
    );

    const cleaned = store.cleanStaleMetricObservations();
    expect(cleaned).toBe(1); // stale만 제거

    const graph = store.loadGraph();
    const remaining = graph.getAllNodes().map((n: any) => n.id);
    expect(remaining).toContain("OBS-METRIC-metric-headroom-status");
    expect(remaining).toContain("OBS-MANUAL-something");
    expect(remaining).not.toContain("OBS-METRIC-metric-headroom-status-1774080879115-1");

    store.close();
  });

  it("전체 converge 사이클 멱등성: bootstrap → metrics → observations → store → 재실행", () => {
    const store = new DkgSqliteStore(":memory:", "cycle-test");

    // 1. bootstrap
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    store.saveGraph(graph);
    const initialStats = store.stats();

    // 2. collectMetrics → metricsToObservations → save (1회차)
    const metrics1 = collectMetrics(DEMO_CATALOG, graph, null);
    const obs1 = metricsToObservations(metrics1);
    if (obs1.length > 0) {
      store.saveUsageSnapshotWithObservations(
        { collectionPeriod: { from: "2026-03-21", to: "2026-03-21" }, entryUsages: [], addressUsages: [], coOccurrences: [], versionUsages: [] } as any,
        obs1,
      );
    }
    const afterFirst = store.stats();

    // 3. 동일 사이클 재실행 (2회차)
    const metrics2 = collectMetrics(DEMO_CATALOG, graph, null);
    const obs2 = metricsToObservations(metrics2);
    if (obs2.length > 0) {
      store.saveUsageSnapshotWithObservations(
        { collectionPeriod: { from: "2026-03-21", to: "2026-03-21" }, entryUsages: [], addressUsages: [], coOccurrences: [], versionUsages: [] } as any,
        obs2,
      );
    }
    const afterSecond = store.stats();

    // 4. 동일 사이클 3회차
    const metrics3 = collectMetrics(DEMO_CATALOG, graph, null);
    const obs3 = metricsToObservations(metrics3);
    if (obs3.length > 0) {
      store.saveUsageSnapshotWithObservations(
        { collectionPeriod: { from: "2026-03-21", to: "2026-03-21" }, entryUsages: [], addressUsages: [], coOccurrences: [], versionUsages: [] } as any,
        obs3,
      );
    }
    const afterThird = store.stats();

    // 노드 수: 1회차 이후와 2회차/3회차가 동일해야 함 (snapshot은 증가하지만 노드는 아님)
    expect(afterSecond.nodes).toBe(afterFirst.nodes);
    expect(afterThird.nodes).toBe(afterFirst.nodes);

    // observation ID 동일 확인
    expect(obs1.map(o => o.id).toSorted()).toEqual(obs2.map(o => o.id).toSorted());
    expect(obs2.map(o => o.id).toSorted()).toEqual(obs3.map(o => o.id).toSorted());

    store.close();
  });
});
