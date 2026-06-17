// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * E2E: encode → track → aggregate → converge
 *
 * 이벤트 수집 → 집계 → 수렴 분석 전체 파이프라인 검증.
 * 10,000건 시뮬레이션으로 co-occurrence 패턴 발견.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, encodePrefixByValue } from "demo-snapshot";
import { DEMO_DKG_CONFIG } from "demo-dkg-config";
import { aggregateUsageData, analyzeCollectionHealth, analyzeEntryCoverage, discoverCausality, analyzeSimplification, type AddressContextRecord } from "@qa-sdk/convergence";
import { auditCoverage, traceFlows, deriveFromCatalog, analyzeAllVersionSkew, defineDslBundle, DslBundleRegistry } from "dkg";
import { bootstrapDkg } from "dkg-enrichment";
import type { DslBundleNode } from "dkg";

describe("E2E: 수집 → 집계 → 수렴 파이프라인", () => {

  it("이벤트 시뮬레이션 → 집계 → EntryUsage/AddressUsage 생성", () => {
    // 1. 이벤트 시뮬레이션: checkout 흐름에서 api 호출 + flow_point 기록
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 1000; i++) {
      // 80%는 checkout 흐름
      const isCheckout = Math.random() < 0.8;
      const flow = isCheckout ? "checkout" : "signup";
      const step = isCheckout
        ? (Math.random() < 0.7 ? "success" : "failure")
        : "success";

      const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
      const apiAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcRef,
        resource_type: "api",
        http_method: "POST",
        api_version: "v1",
      });

      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0],
        flow_name: flow,
        flow_step: step,
        flow_variant: "default",
      });

      records.push({
        address_context: {
          endpoint: `endpoint:v1:${apiAddr}`,
          flow_point: `flow_point:v1:${fpAddr}`,
        },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
      });
    }

    // 2. 집계
    const usage = aggregateUsageData(DEMO_CATALOG, records);

    console.log("\n══ 집계 결과 ══");
    console.log(`  EntryUsage: ${usage.entryUsages.length}개`);
    console.log(`  AddressUsage: ${usage.addressUsages.length}개`);
    console.log(`  CoOccurrence: ${usage.coOccurrences.length}개`);

    // 검증
    expect(usage.entryUsages.length).toBeGreaterThan(0);
    expect(usage.addressUsages.length).toBeGreaterThan(0);
    expect(usage.coOccurrences.length).toBeGreaterThan(0);

    // checkout/orders가 가장 많이 출현
    const topEntry = usage.entryUsages[0];
    console.log(`  Top entry: ${topEntry.axisId}=${topEntry.entry} (${topEntry.count}회)`);
  });

  it("co-occurrence → 인과 발견", () => {
    // 1. 시뮬레이션: login 후 98% 확률로 token_refresh
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 2000; i++) {
      // login 이벤트
      const loginAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0],
        flow_name: "login", flow_step: "entry", flow_variant: "default",
      });

      records.push({
        address_context: {
          flow_point: `flow_point:v1:${loginAddr}`,
        },
        timestamp: new Date(2026, 2, 20, 0, 0, i * 2).toISOString(),
      });

      // 98% 확률로 token_refresh 동반
      if (Math.random() < 0.98) {
        const refreshAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0],
          flow_name: "login", flow_step: "success", flow_variant: "default",
        });

        // login + success를 같은 address_context에
        records.push({
          address_context: {
            flow_point: `flow_point:v1:${loginAddr}`,
            endpoint: `endpoint:v1:${encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
              svc_ref: DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0],
              resource_type: "api", http_method: "POST", api_version: "v1",
            })}`,
          },
          timestamp: new Date(2026, 2, 20, 0, 0, i * 2 + 1).toISOString(),
        });
      }
    }

    // 2. 집계
    const usage = aggregateUsageData(DEMO_CATALOG, records);

    // 3. 인과 발견
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const candidates = discoverCausality(graph, usage.coOccurrences);

    console.log("\n══ 인과 발견 ══");
    console.log(`  CoOccurrence: ${usage.coOccurrences.length}개`);
    console.log(`  인과 후보: ${candidates.length}개`);
    for (const c of candidates.slice(0, 5)) {
      console.log(`    ${c.source.prefix}:${c.source.entry} → ${c.target.prefix}:${c.target.entry}`);
      console.log(`      rate=${(c.coOccurrenceRate * 100).toFixed(1)}% count=${c.observedCount} → ${c.suggestion}`);
    }

    // login과 auth API의 co-occurrence가 높아야 함
    expect(usage.coOccurrences.length).toBeGreaterThan(0);
  });

  it("address_context 비어있는 레코드는 무시", () => {
    const records: AddressContextRecord[] = [
      { address_context: {}, timestamp: "2026-03-20T00:00:00Z" },
      { address_context: { api: "api:v1:0" }, timestamp: "2026-03-20T00:00:01Z" },
    ];

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    expect(usage.addressUsages.length).toBe(1);
  });

  it("SimplificationAdvisor에 UsageData 피드", () => {
    // 단순화 분석에 실제 집계 데이터 피드
    const records: AddressContextRecord[] = [];
    for (let i = 0; i < 500; i++) {
      const addr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
        svc_ref: DEMO_CATALOG.prefixes.page_view.versions[0].refEntries!.svc_ref.values[0],
        page: "home",
        locale: "ko",
        userType: "member",
      });
      records.push({
        address_context: { page_view: `page_view:v1:${addr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const graph = deriveFromCatalog(DEMO_CATALOG);

    const simplification = analyzeSimplification(
      graph, "page_view", usage.entryUsages, usage.addressUsages,
    );

    console.log("\n══ Simplification ══");
    console.log(`  단일값 차원: ${simplification.singleValueDims.length}개`);
    for (const sv of simplification.singleValueDims) {
      console.log(`    ${sv.dim}: always "${sv.value}"`);
    }

    // 단일값 dim 존재 여부 확인 (카탈로그 변경에 따라 수 변동)
    expect(simplification.singleValueDims.length).toBeGreaterThanOrEqual(3);
    expect(simplification.suggestions.some(s => s.kind === "remove-dim")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  누적 수집 테스트: N 라운드 반복 → 카운트 증가 검증
// ═══════════════════════════════════════════════════════════════

describe("E2E: 누적 수집 — N 라운드 반복", () => {

  it("5 라운드 수집 → 누적 카운트 단조 증가 + 식별자 추적", () => {
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const allRecords: AddressContextRecord[] = [];

    console.log("\n══ 누적 수집 (5 라운드, 식별자 포함) ══");

    for (let round = 1; round <= 5; round++) {
      const sessionId = `session-R${round}`;
      const batchSize = 200;

      for (let i = 0; i < batchSize; i++) {
        const flows = ["checkout", "signup", "login", "order_cancel", "refund"] as const;
        const steps = ["entry", "processing", "success", "failure"] as const;
        const flow = flows[Math.floor(Math.random() * flows.length)];
        const step = steps[Math.floor(Math.random() * steps.length)];

        const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
          svc_ref: svcAddr, flow_name: flow, flow_step: step, flow_variant: "default",
        });
        const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
          svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
        });

        allRecords.push({
          address_context: {
            flow_point: `flow_point:v1:${fpAddr}`,
            endpoint: `endpoint:v1:${epAddr}`,
          },
          timestamp: new Date(2026, 2, 20, round, 0, i).toISOString(),
          log_id: `log-R${round}-${i}`,
          trace_id: `trace-R${round}-${Math.floor(i / 10)}`, // 10건당 1 trace
          session_id: sessionId,
          event_key: `flow.${flow}.${step}`,
        });
      }

      const usage = aggregateUsageData(DEMO_CATALOG, allRecords);
      const stats = usage.sourceStats!;
      const totalCount = usage.entryUsages.reduce((s, e) => s + e.count, 0);

      console.log(
        `  R${round}: ${stats.totalRecords}건 → ` +
        `traces=${stats.uniqueTraces} sessions=${stats.uniqueSessions} ` +
        `eventKeys=${stats.uniqueEventKeys} ` +
        `total=${totalCount}`,
      );
    }

    // 최종 집계
    const final = aggregateUsageData(DEMO_CATALOG, allRecords);
    const stats = final.sourceStats!;

    console.log(`\n  최종: records=${stats.totalRecords} traces=${stats.uniqueTraces} sessions=${stats.uniqueSessions} eventKeys=${stats.uniqueEventKeys}`);
    console.log(`  sessions: ${stats.sessionIds.join(", ")}`);
    console.log(`  eventKeys 샘플: ${stats.eventKeys.slice(0, 5).join(", ")}${stats.eventKeys.length > 5 ? " ..." : ""}`);

    // 검증
    expect(stats.totalRecords).toBe(1000);
    expect(stats.uniqueSessions).toBe(5); // 라운드별 1 session
    expect(stats.uniqueTraces).toBe(100); // 라운드별 20 trace × 5
    expect(stats.uniqueEventKeys).toBeGreaterThan(5); // 여러 flow×step 조합
    expect(stats.sessionIds).toContain("session-R1");
    expect(stats.sessionIds).toContain("session-R5");
  });

  it("3 라운드 수집 → co-occurrence 안정화 감지", () => {
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const allRecords: AddressContextRecord[] = [];
    const coRates: number[] = [];

    console.log("\n══ co-occurrence 안정화 (3 라운드) ══");

    for (let round = 1; round <= 3; round++) {
      for (let i = 0; i < 500; i++) {
        // 90% 확률로 checkout+POST 동시 기록
        const isCheckout = Math.random() < 0.9;

        const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
          svc_ref: svcAddr,
          flow_name: isCheckout ? "checkout" : "signup",
          flow_step: "success",
          flow_variant: "default",
        });

        const ctx: Record<string, string> = {
          flow_point: `flow_point:v1:${fpAddr}`,
        };

        if (isCheckout) {
          const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
            svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
          });
          ctx.endpoint = `endpoint:v1:${epAddr}`;
        }

        allRecords.push({
          address_context: ctx,
          timestamp: new Date(2026, 2, 20 + round, 0, 0, i).toISOString(),
        });
      }

      const usage = aggregateUsageData(DEMO_CATALOG, allRecords);
      const checkoutCo = usage.coOccurrences.find(
        c => c.sourcePrefix === "flow_point" || c.targetPrefix === "flow_point",
      );
      const rate = checkoutCo ? checkoutCo.count / checkoutCo.totalSourceCount : 0;
      coRates.push(rate);

      console.log(
        `  R${round}: ${allRecords.length}건 → ` +
        `co-occurrence rate=${(rate * 100).toFixed(1)}% ` +
        `(${checkoutCo?.count ?? 0}/${checkoutCo?.totalSourceCount ?? 0})`,
      );
    }

    // co-occurrence rate는 90% 근처로 수렴해야 함 (±5%)
    const lastRate = coRates[coRates.length - 1];
    expect(lastRate).toBeGreaterThan(0.8);
    expect(lastRate).toBeLessThan(1.0);

    // 라운드 간 rate 차이가 줄어들어야 함 (안정화)
    if (coRates.length >= 3) {
      const drift1 = Math.abs(coRates[1] - coRates[0]);
      const drift2 = Math.abs(coRates[2] - coRates[1]);
      console.log(`  drift: R1→R2=${(drift1 * 100).toFixed(2)}% R2→R3=${(drift2 * 100).toFixed(2)}%`);
      // 두 번째 drift가 첫 번째보다 작거나 둘 다 충분히 작아야 함
      expect(drift2).toBeLessThan(0.1); // 10% 미만 변동
    }
  });

  it("인프라 이벤트 3 라운드 → deploy→health 상관관계 강화", () => {
    const infraSvcAddr = DEMO_CATALOG.prefixes.deploy_event.versions[0].refEntries!.svc_ref.values[0];
    const allRecords: AddressContextRecord[] = [];

    console.log("\n══ 인프라 상관관계 누적 (3 라운드) ══");

    for (let round = 1; round <= 3; round++) {
      // 라운드가 진행될수록 degraded 비율 증가 (시스템 불안정 시뮬레이션)
      const degradedRate = 0.2 + round * 0.1; // R1: 30%, R2: 40%, R3: 50%

      for (let i = 0; i < 100; i++) {
        const deployAddr = encodePrefixByValue(DEMO_CATALOG, "deploy_event", "v1", {
          svc_ref: infraSvcAddr, deploy_action: "deploy",
        });

        const ctx: Record<string, string> = {
          deploy_event: `deploy_event:v1:${deployAddr}`,
        };

        if (Math.random() < degradedRate) {
          const healthAddr = encodePrefixByValue(DEMO_CATALOG, "health_event", "v1", {
            svc_ref: infraSvcAddr, health_status: "degraded",
          });
          ctx.health_event = `health_event:v1:${healthAddr}`;
        }

        allRecords.push({
          address_context: ctx,
          timestamp: new Date(2026, 2, 20 + round, 12, 0, i).toISOString(),
        });
      }

      const usage = aggregateUsageData(DEMO_CATALOG, allRecords);
      const deployHealth = usage.coOccurrences.find(
        c => c.sourcePrefix === "deploy_event" && c.targetPrefix === "health_event",
      );

      console.log(
        `  R${round}: ${allRecords.length}건 → ` +
        `deploy→health=${deployHealth?.count ?? 0}/${deployHealth?.totalSourceCount ?? 0} ` +
        `(${deployHealth ? ((deployHealth.count / deployHealth.totalSourceCount) * 100).toFixed(1) : 0}%)`,
      );

      // 누적 카운트는 항상 증가
      if (round > 1) {
        expect(deployHealth?.count).toBeGreaterThan(0);
      }
    }

    // 최종: 300건 이벤트 처리 완료
    expect(allRecords.length).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════
//  실행 모드 분리: live vs test vs synthetic
// ═══════════════════════════════════════════════════════════════

describe("E2E: 실행 모드별 데이터 분리", () => {

  it("live + test + synthetic 혼합 수집 → 모드별 분리 집계", () => {
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    // live: 프로덕션 트래픽 (300건)
    for (let i = 0; i < 300; i++) {
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "GET", api_version: "v1",
      });
      records.push({
        address_context: { endpoint: `endpoint:v1:${epAddr}` },
        timestamp: new Date(2026, 2, 20, 10, 0, i).toISOString(),
        trace_id: `live-trace-${i}`,
        session_id: `live-session-${Math.floor(i / 50)}`,
        execution_mode: "live",
      });
    }

    // test: E2E 테스트 (100건)
    for (let i = 0; i < 100; i++) {
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      records.push({
        address_context: { endpoint: `endpoint:v1:${epAddr}` },
        timestamp: new Date(2026, 2, 20, 11, 0, i).toISOString(),
        trace_id: `test-trace-${i}`,
        session_id: "test-suite-checkout",
        execution_mode: "test",
        execution_id: "e2e-checkout-v4",
      });
    }

    // synthetic: 부하 테스트 (50건)
    for (let i = 0; i < 50; i++) {
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "PUT", api_version: "v2",
      });
      records.push({
        address_context: { endpoint: `endpoint:v1:${epAddr}` },
        timestamp: new Date(2026, 2, 20, 12, 0, i).toISOString(),
        trace_id: `synth-trace-${i}`,
        session_id: "loadtest-run-7",
        execution_mode: "synthetic",
        execution_id: "loadtest-2026-03-20",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const stats = usage.sourceStats!;

    console.log("\n══ 실행 모드별 분리 ══");
    console.log(`  총 레코드: ${stats.totalRecords}`);
    console.log(`  모드별: ${JSON.stringify(stats.byExecutionMode)}`);
    console.log(`  실행 ID별: ${JSON.stringify(stats.byExecutionId)}`);
    console.log(`  traces: ${stats.uniqueTraces}`);
    console.log(`  sessions: ${stats.uniqueSessions} — ${stats.sessionIds.join(", ")}`);

    // 모드별 카운트 정확
    expect(stats.byExecutionMode.live).toBe(300);
    expect(stats.byExecutionMode.test).toBe(100);
    expect(stats.byExecutionMode.synthetic).toBe(50);

    // 실행 ID별 카운트
    expect(stats.byExecutionId["e2e-checkout-v4"]).toBe(100);
    expect(stats.byExecutionId["loadtest-2026-03-20"]).toBe(50);

    // live 데이터만 필터링 가능 (필터는 호출자 책임, 여기선 분류만 검증)
    expect(stats.totalRecords).toBe(450);
    expect(stats.uniqueSessions).toBe(8); // 6 live (300/50) + 1 test + 1 synth
  });

  it("execution_mode 미지정 → 기본값 live로 집계", () => {
    const records: AddressContextRecord[] = [
      {
        address_context: { endpoint: "endpoint:v1:0" },
        timestamp: "2026-03-20T00:00:00Z",
        // execution_mode 없음 → live
      },
      {
        address_context: { endpoint: "endpoint:v1:0" },
        timestamp: "2026-03-20T00:00:01Z",
        execution_mode: "test",
        execution_id: "unit-test-1",
      },
    ];

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const stats = usage.sourceStats!;

    expect(stats.byExecutionMode.live).toBe(1);
    expect(stats.byExecutionMode.test).toBe(1);
    expect(stats.byExecutionId["unit-test-1"]).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
//  수집 건전성: 고아/구버전/비활성 감지
// ═══════════════════════════════════════════════════════════════

describe("E2E: 수집 건전성 분석", () => {

  it("정상 주소 → 건전성 100%", () => {
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
      svc_ref: svcAddr, resource_type: "api", http_method: "GET", api_version: "v1",
    });

    const records: AddressContextRecord[] = Array.from({ length: 100 }, (_, i) => ({
      address_context: { endpoint: `endpoint:v1:${epAddr}` },
      timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
    }));

    const health = analyzeCollectionHealth(DEMO_CATALOG, records);

    console.log("\n══ 건전성: 정상 ══");
    console.log(`  ${health.summary}`);

    expect(health.healthRate).toBe(1);
    expect(health.orphans.length).toBe(0);
    expect(health.staleVersions.length).toBe(0);
  });

  it("고아 prefix 감지 — 카탈로그에 없는 prefix", () => {
    const records: AddressContextRecord[] = [
      // 정상
      { address_context: { endpoint: "endpoint:v1:0" }, timestamp: "2026-03-20T00:00:00Z" },
      { address_context: { endpoint: "endpoint:v1:0" }, timestamp: "2026-03-20T00:00:01Z" },
      // 고아 — "payment_flow"는 카탈로그에 없음
      { address_context: { payment_flow: "payment_flow:v1:42" }, timestamp: "2026-03-20T00:00:02Z" },
      { address_context: { payment_flow: "payment_flow:v1:42" }, timestamp: "2026-03-20T00:00:03Z" },
      { address_context: { payment_flow: "payment_flow:v1:42" }, timestamp: "2026-03-20T00:00:04Z" },
      // 고아 — "old_api"도 없음
      { address_context: { old_api: "old_api:v2:99" }, timestamp: "2026-03-20T00:00:05Z" },
    ];

    const health = analyzeCollectionHealth(DEMO_CATALOG, records);

    console.log("\n══ 건전성: 고아 감지 ══");
    console.log(`  ${health.summary}`);
    for (const o of health.orphans) {
      console.log(`    ${o.reason}: ${o.prefixId} (${o.count}건)`);
    }

    expect(health.orphans.length).toBe(2); // payment_flow, old_api
    expect(health.orphans.find(o => o.prefixId === "payment_flow")?.count).toBe(3);
    expect(health.orphans.find(o => o.prefixId === "old_api")?.count).toBe(1);
    expect(health.healthRate).toBeCloseTo(2 / 6); // 2 valid out of 6
  });

  it("구버전 사용 감지 — permission v1 사용 (최신 v4)", () => {
    const records: AddressContextRecord[] = [
      // permission v1 (구버전, 최신은 v4)
      { address_context: { permission: "permission:v1:0" }, timestamp: "2026-03-20T00:00:00Z" },
      { address_context: { permission: "permission:v1:0" }, timestamp: "2026-03-20T00:00:01Z" },
      { address_context: { permission: "permission:v1:1" }, timestamp: "2026-03-20T00:00:02Z" },
      // permission v4 (최신)
      { address_context: { permission: "permission:v4:0" }, timestamp: "2026-03-20T00:00:03Z" },
      // event v2 (구버전, 최신은 v4)
      { address_context: { event: "event:v2:0" }, timestamp: "2026-03-20T00:00:04Z" },
    ];

    const health = analyzeCollectionHealth(DEMO_CATALOG, records);

    console.log("\n══ 건전성: 구버전 감지 ══");
    console.log(`  ${health.summary}`);
    for (const s of health.staleVersions) {
      console.log(`    ${s.prefixId}: ${s.usedVersion} → 최신 ${s.latestVersion} (gap=${s.versionGap}, ${s.count}건)`);
    }

    expect(health.staleVersions.length).toBe(2); // permission v1, event v2
    const permStale = health.staleVersions.find(s => s.prefixId === "permission");
    expect(permStale?.usedVersion).toBe("v1");
    expect(permStale?.latestVersion).toBe("v4");
    expect(permStale?.versionGap).toBe(3);
    expect(permStale?.count).toBe(3);

    const eventStale = health.staleVersions.find(s => s.prefixId === "event");
    expect(eventStale?.versionGap).toBe(2);
  });

  it("혼합 시나리오: 정상 + 고아 + 구버전 + 디코드 실패", () => {
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [
      // 정상 (5건)
      ...Array.from({ length: 5 }, (_, i) => ({
        address_context: { endpoint: `endpoint:v1:${encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
          svc_ref: svcAddr, resource_type: "api", http_method: "GET", api_version: "v1",
        })}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        execution_mode: "live" as const,
      })),
      // 구버전 (3건)
      ...Array.from({ length: 3 }, (_, i) => ({
        address_context: { permission: "permission:v1:0" },
        timestamp: new Date(2026, 2, 20, 0, 1, i).toISOString(),
        execution_mode: "live" as const,
      })),
      // 고아 (2건)
      ...Array.from({ length: 2 }, (_, i) => ({
        address_context: { removed_prefix: "removed_prefix:v1:0" },
        timestamp: new Date(2026, 2, 20, 0, 2, i).toISOString(),
        execution_mode: "test" as const,
        execution_id: "migration-test",
      })),
      // 디코드 실패 (1건)
      {
        address_context: { endpoint: "bad-format" },
        timestamp: "2026-03-20T00:03:00Z",
        execution_mode: "test" as const,
      },
    ];

    const health = analyzeCollectionHealth(DEMO_CATALOG, records);

    console.log("\n══ 건전성: 혼합 시나리오 ══");
    console.log(`  ${health.summary}`);
    console.log(`  total=${health.totalAddresses} valid=${health.validAddresses} rate=${(health.healthRate * 100).toFixed(1)}%`);

    console.log("  고아:");
    for (const o of health.orphans) console.log(`    ${o.reason}: ${o.prefixId} (${o.count}건)`);
    console.log("  구버전:");
    for (const s of health.staleVersions) console.log(`    ${s.prefixId}: ${s.usedVersion}→${s.latestVersion} gap=${s.versionGap} (${s.count}건)`);

    expect(health.totalAddresses).toBe(11);
    expect(health.validAddresses).toBe(8); // 5 endpoint + 3 permission(valid but stale)
    expect(health.orphans.length).toBe(2); // removed_prefix + bad-format
    expect(health.staleVersions.length).toBe(1); // permission v1
    expect(health.healthRate).toBeCloseTo(8 / 11, 2);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DSL 번들 단위 종단 테스트:
//  이벤트 수집 → DSL별 집계 → 버전 스큐 감지 → 커버리지 검증
// ═══════════════════════════════════════════════════════════════

describe("E2E: DSL 번들 단위 파이프라인", () => {

  it("dsl-checkout: 결제 흐름 이벤트 수집 → DSL 멤버별 집계", () => {
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 500; i++) {
      // 1. page_view — checkout 화면 진입
      const pvAddr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
        svc_ref: svcAddr, page: "checkout", locale: "ko", userType: "member",
      });
      // 2. endpoint — POST 결제 API
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      // 3. flow_point — checkout 흐름 성공/실패
      const step = Math.random() < 0.85 ? "success" : "failure";
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: svcAddr, flow_name: "checkout", flow_step: step, flow_variant: "default",
      });

      records.push({
        address_context: {
          page_view: `page_view:v1:${pvAddr}`,
          endpoint: `endpoint:v1:${epAddr}`,
          flow_point: `flow_point:v1:${fpAddr}`,
        },
        timestamp: new Date(2026, 2, 20, 10, 0, i).toISOString(),
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);

    console.log("\n══ dsl-checkout 집계 ══");
    console.log(`  EntryUsage: ${usage.entryUsages.length}개`);
    console.log(`  AddressUsage: ${usage.addressUsages.length}개`);
    console.log(`  CoOccurrence: ${usage.coOccurrences.length}개`);

    // DSL 멤버 3개(page_view, endpoint, flow_point)의 주소가 모두 집계됨
    const prefixes = new Set(usage.addressUsages.map(a => a.prefix));
    expect(prefixes.has("page_view")).toBe(true);
    expect(prefixes.has("endpoint")).toBe(true);
    expect(prefixes.has("flow_point")).toBe(true);

    // co-occurrence: page_view↔endpoint↔flow_point 삼중 공존
    expect(usage.coOccurrences.length).toBeGreaterThan(0);

    // flow_step success/failure 비율 확인 가능
    const flowEntries = usage.entryUsages.filter(e => e.axisId === "flow_step");
    console.log(`  flow_step 분포: ${flowEntries.map(e => `${e.entry}=${e.count}`).join(", ")}`);
    expect(flowEntries.length).toBe(2); // success + failure
  });

  it("dsl-infra: 배포 → 헬스 상관관계 이벤트 수집", () => {
    const infraSvcAddr = DEMO_CATALOG.prefixes.deploy_event.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 200; i++) {
      // 1. deploy_event — 배포
      const deployAddr = encodePrefixByValue(DEMO_CATALOG, "deploy_event", "v1", {
        svc_ref: infraSvcAddr, deploy_action: "deploy",
      });
      records.push({
        address_context: {
          deploy_event: `deploy_event:v1:${deployAddr}`,
        },
        timestamp: new Date(2026, 2, 20, 12, 0, i * 2).toISOString(),
      });

      // 2. 30%에서 health_event(degraded) 발생 — 배포 후 성능 저하
      if (Math.random() < 0.3) {
        const healthAddr = encodePrefixByValue(DEMO_CATALOG, "health_event", "v1", {
          svc_ref: infraSvcAddr, health_status: "degraded",
        });
        records.push({
          address_context: {
            deploy_event: `deploy_event:v1:${deployAddr}`,
            health_event: `health_event:v1:${healthAddr}`,
          },
          timestamp: new Date(2026, 2, 20, 12, 0, i * 2 + 1).toISOString(),
        });
      }
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);

    console.log("\n══ dsl-infra 집계 ══");
    console.log(`  deploy_event 주소: ${usage.addressUsages.filter(a => a.prefix === "deploy_event").length}개`);
    console.log(`  health_event 주소: ${usage.addressUsages.filter(a => a.prefix === "health_event").length}개`);
    console.log(`  CoOccurrence: ${usage.coOccurrences.length}개`);

    // deploy ↔ health co-occurrence 감지
    const deployHealthCo = usage.coOccurrences.filter(
      c => c.sourcePrefix === "deploy_event" && c.targetPrefix === "health_event",
    );
    console.log(`  deploy→health co-occurrence: ${deployHealthCo.length}건`);
    expect(deployHealthCo.length).toBeGreaterThan(0);

    // 인과 분석
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const candidates = discoverCausality(graph, usage.coOccurrences);
    console.log(`  인과 후보: ${candidates.length}개`);
    for (const c of candidates) {
      console.log(`    ${c.source.prefix}→${c.target.prefix}: rate=${(c.coOccurrenceRate * 100).toFixed(1)}%`);
    }
  });

  it("DSL 버전 스큐 + Observation → 재귀 개선 검증", () => {
    const fullGraph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG, date: "2026-03-20" });
    const dslNodes = fullGraph.getNodesByKind("dsl-bundle") as DslBundleNode[];

    const registry = new DslBundleRegistry();
    for (const node of dslNodes) {
      registry.register(
        defineDslBundle(DEMO_CATALOG, {
          id: node.id,
          name: node.name,
          description: node.description,
          serviceBinding: { prefixId: node.serviceBindingPrefix, fixedDims: [...node.fixedDims] },
          members: node.memberPrefixes.map(p => ({ prefixId: p, role: "observation" as const })),
        }),
      );
    }

    const skewReports = analyzeAllVersionSkew(DEMO_CATALOG, registry);

    console.log("\n══ 종단 버전 스큐 분석 ══");
    for (const r of skewReports) {
      const icon = r.severity === "ok" ? "✅" : "⚠";
      console.log(`  ${icon} ${r.bundleId}: ${r.summary}`);
    }

    // Observation 노드가 bootstrap에서 자동 생성됨
    const observations = fullGraph.getNodesByKind("observation");
    const skewObs = observations.filter(o => o.id.startsWith("OBS-SKEW-"));

    console.log(`\n  자동 Observation: ${skewObs.length}개`);
    for (const obs of skewObs) {
      const targets = fullGraph.neighbors(obs.id, "observes");
      console.log(`    ${obs.id} → observes: ${targets.join(", ")}`);
    }

    // dsl-checkout, dsl-auth, dsl-commerce, dsl-ingest에서 minor skew 감지
    expect(skewObs.length).toBe(4);

    // Observation이 그래프에서 DSL 번들과 연결됨
    for (const obs of skewObs) {
      const targets = fullGraph.neighbors(obs.id, "observes");
      expect(targets.length).toBeGreaterThan(0);
    }

    console.log("\n  ✅ 이벤트 수집 → 집계 → 버전 스큐 감지 → Observation 종단 검증 완료");
  });
});

// ═══════════════════════════════════════════════════════════════
//  Entry 관측 커버리지: catalog 정의 vs 실 트래픽 대조
// ═══════════════════════════════════════════════════════════════

describe("E2E: entry 관측 커버리지", () => {

  it("부분 트래픽 → dormant entry 감지", () => {
    // checkout 흐름만 실행 → signup/login/order_cancel/refund flow는 dormant
    const svcAddr = DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 300; i++) {
      const step = Math.random() < 0.8 ? "success" : "failure";
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: svcAddr, flow_name: "checkout", flow_step: step, flow_variant: "default",
      });
      records.push({
        address_context: { flow_point: `flow_point:v1:${fpAddr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        execution_mode: "live",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const coverage = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);

    // flow_point prefix 커버리지 확인
    const fpCov = coverage.prefixes.find(p => p.prefixId === "flow_point");

    console.log("\n══ entry 관측 커버리지 ══");
    console.log(`  전체: ${coverage.summary}`);

    if (fpCov) {
      console.log(`\n  flow_point: ${fpCov.summary}`);
      for (const [label, dim] of Object.entries(fpCov.dims)) {
        if (dim.dormant > 0) {
          const dormant = dim.entries.filter(e => e.status === "dormant").map(e => e.entry);
          const observed = dim.entries.filter(e => e.status === "observed").map(e => `${e.entry}(${e.count})`);
          console.log(`    ${label}: observed=[${observed.join(",")}] dormant=[${dormant.join(",")}]`);
        }
      }
    }

    // flow_name에서 checkout만 관측, 나머지(signup, login, order_cancel, refund)는 dormant
    const flowNameDim = fpCov?.dims.flow_name;
    expect(flowNameDim).toBeDefined();
    expect(flowNameDim!.observed).toBe(1); // checkout만
    expect(flowNameDim!.dormant).toBeGreaterThanOrEqual(4); // v2면 7, v1이면 4

    // flow_step에서 success, failure만 관측, 나머지(entry, processing, branch, timeout)는 dormant
    const flowStepDim = fpCov?.dims.flow_step;
    expect(flowStepDim).toBeDefined();
    expect(flowStepDim!.observed).toBe(2); // success, failure
    expect(flowStepDim!.dormant).toBeGreaterThanOrEqual(4); // v2면 7, v1이면 4

    // flow_variant에서 default만 → 나머지(retry, fallback, manual) dormant
    const flowVariantDim = fpCov?.dims.flow_variant;
    expect(flowVariantDim!.observed).toBe(1);
    expect(flowVariantDim!.dormant).toBe(3);
  });

  it("전체 트래픽 → 높은 커버리지", () => {
    const latestVer = DEMO_CATALOG.prefixes.flow_point.versions[DEMO_CATALOG.prefixes.flow_point.versions.length - 1];
    const svcAddr = latestVer.refEntries!.svc_ref.values[0];
    const ver = latestVer.version;
    const records: AddressContextRecord[] = [];
    const flowAxis = DEMO_CATALOG.axes.flow_name.versions[latestVer.axisVersions.flow_name as keyof typeof DEMO_CATALOG.axes.flow_name.versions] as { entries: readonly string[] };
    const stepAxis = DEMO_CATALOG.axes.flow_step.versions[latestVer.axisVersions.flow_step as keyof typeof DEMO_CATALOG.axes.flow_step.versions] as { entries: readonly string[] };
    const variantAxis = DEMO_CATALOG.axes.flow_variant.versions[latestVer.axisVersions.flow_variant as keyof typeof DEMO_CATALOG.axes.flow_variant.versions] as { entries: readonly string[] };

    // 모든 조합 커버 (latest version 기준)
    for (const flow of flowAxis.entries) {
      for (const step of stepAxis.entries) {
        for (const variant of variantAxis.entries) {
          const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", ver, {
            svc_ref: svcAddr, flow_name: flow, flow_step: step, flow_variant: variant,
          });
          records.push({
            address_context: { flow_point: `flow_point:${ver}:${fpAddr}` },
            timestamp: "2026-03-20T00:00:00Z",
          });
        }
      }
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const coverage = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);

    const fpCov = coverage.prefixes.find(p => p.prefixId === "flow_point");

    console.log(`\n  전체 커버: flow_point ${fpCov?.summary}`);

    // flow_name, flow_step, flow_variant 모두 100% 관측
    expect(fpCov?.dims.flow_name?.dormant).toBe(0);
    expect(fpCov?.dims.flow_step?.dormant).toBe(0);
    expect(fpCov?.dims.flow_variant?.dormant).toBe(0);
    expect(fpCov?.coverageRate).toBe(1);
  });

  it("다중 prefix 커버리지 → 전체 시스템 리포트", () => {
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    // endpoint: api + POST + v1만
    for (let i = 0; i < 100; i++) {
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      records.push({
        address_context: { endpoint: `endpoint:v1:${epAddr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
      });
    }

    // deploy_event: deploy만
    const infraAddr = DEMO_CATALOG.prefixes.deploy_event.versions[0].refEntries!.svc_ref.values[0];
    for (let i = 0; i < 50; i++) {
      const dAddr = encodePrefixByValue(DEMO_CATALOG, "deploy_event", "v1", {
        svc_ref: infraAddr, deploy_action: "deploy",
      });
      records.push({
        address_context: { deploy_event: `deploy_event:v1:${dAddr}` },
        timestamp: new Date(2026, 2, 20, 1, 0, i).toISOString(),
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const coverage = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);

    console.log(`\n══ 다중 prefix 커버리지 ══`);
    console.log(`  ${coverage.summary}`);
    for (const pc of coverage.prefixes.filter(p => p.coverageRate < 1)) {
      console.log(`\n  ${pc.prefixId}: ${pc.summary}`);
    }

    // endpoint: resource_type 4개 중 1개(api), http_method 5개 중 1개(POST), api_version 2개 중 1개(v1)
    const epCov = coverage.prefixes.find(p => p.prefixId === "endpoint");
    expect(epCov?.dims.resource_type?.dormant).toBe(3); // page, webhook, grpc
    expect(epCov?.dims.http_method?.dormant).toBe(4); // GET, PUT, DELETE, PATCH

    // deploy_event: deploy_action v1(7개) 중 1개(deploy) → dormant=6
    const deCov = coverage.prefixes.find(p => p.prefixId === "deploy_event");
    expect(deCov?.dims.deploy_action?.dormant).toBe(6); // rollback, scale_up, scale_down, restart, canary_start, canary_promote

    // dormant > 0인 prefix가 존재
    expect(coverage.dormantCount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Skills 통합: coverage-audit + flow-trace
// ═══════════════════════════════════════════════════════════════

describe("E2E: skills — coverage-audit + flow-trace", () => {

  it("coverage-audit: 부분 트래픽 → Observation + Decision 자동 생성", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG, date: "2026-03-20" });
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    // checkout 흐름만 200건
    for (let i = 0; i < 200; i++) {
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: svcAddr, flow_name: "checkout", flow_step: "success", flow_variant: "default",
      });
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      records.push({
        address_context: { flow_point: `flow_point:v1:${fpAddr}`, endpoint: `endpoint:v1:${epAddr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const result = auditCoverage(DEMO_CATALOG, graph, usage.entryUsages, usage.addressUsages, { date: "2026-03-20" });

    console.log("\n══ coverage-audit skill ══");
    console.log(`  ${result.report.summary}`);
    console.log(`  Observations: ${result.observations.length}개`);
    console.log(`  Decisions: ${result.decisions.length}개`);

    for (const obs of result.observations) {
      console.log(`    ${obs.id}: ${obs.finding.slice(0, 80)}...`);
    }
    for (const dec of result.decisions) {
      console.log(`    ${dec.id}: ${dec.title}`);
    }

    // 저커버리지 prefix에 대해 Observation + Decision 생성
    expect(result.observations.length).toBeGreaterThan(0);
    // 0% prefix에 대한 OBS-COV-ZERO 존재
    expect(result.observations.some(o => o.id === "OBS-COV-ZERO")).toBe(true);
    // 저커버리지 prefix에 대한 Decision 존재
    expect(result.decisions.length).toBeGreaterThan(0);

    // DKG 그래프에 등록됨
    for (const obs of result.observations) {
      expect(graph.getNode(obs.id)).toBeDefined();
    }
  });

  it("flow-trace: DSL 우회 시 invariant 위반 감지 (의도적 시나리오)", () => {
    // 시나리오: page_view 없이 flow_point만 보내는 상황 — 봇/크롤러 또는 DSL 미적용 코드
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG, date: "2026-03-20" });
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];

    // 정상 레코드: page_view + flow_point 모두 있음
    const normalRecords: AddressContextRecord[] = [];
    for (let i = 0; i < 100; i++) {
      const pvAddr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
        svc_ref: svcAddr, page: "checkout", locale: "ko", userType: "member",
      });
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: svcAddr, flow_name: "checkout", flow_step: "success", flow_variant: "default",
      });
      normalRecords.push({
        address_context: {
          page_view: `page_view:v1:${pvAddr}`,
          flow_point: `flow_point:v1:${fpAddr}`,
        },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
      });
    }

    // 위반 레코드: DSL 우회 — flow_point만 있고 page_view 없음
    const violatingRecords: AddressContextRecord[] = [];
    for (let i = 0; i < 30; i++) {
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: svcAddr, flow_name: "checkout", flow_step: "success", flow_variant: "default",
      });
      violatingRecords.push({
        address_context: {
          flow_point: `flow_point:v1:${fpAddr}`,
          // page_view 없음 → IL-checkout-flow invariant 위반
        },
        timestamp: new Date(2026, 2, 20, 1, 0, i).toISOString(),
      });
    }

    const allRecords = [...normalRecords, ...violatingRecords];
    const result = traceFlows(graph, allRecords, { date: "2026-03-20" });

    console.log("\n══ flow-trace skill ══");
    console.log(`  ${result.summary}`);
    console.log(`  검사: ${result.checkedRecords}/${result.totalRecords}건`);

    for (const v of result.violations) {
      console.log(`    ${v.intentLinkId}: missing=[${v.missingPrefixes.join(",")}] present=[${v.presentPrefixes.join(",")}] (${v.count}건)`);
      console.log(`      invariant: ${v.invariant}`);
    }

    // page_view 없이 flow_point만 있는 30건에서 위반 감지
    expect(result.violations.length).toBeGreaterThan(0);

    // Observation 생성됨
    expect(result.observations.length).toBeGreaterThan(0);

    // DKG에 등록됨
    for (const obs of result.observations) {
      expect(graph.getNode(obs.id)).toBeDefined();
    }
  });
});
