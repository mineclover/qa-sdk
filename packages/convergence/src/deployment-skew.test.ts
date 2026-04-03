import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, encodePrefixByValue } from "demo-snapshot";
import { aggregateUsageData, analyzeDeploymentSkew, type AddressContextRecord } from "@qa-sdk/convergence";

describe("배포 스큐 감지 — 집계 기반", () => {

  it("단일 version → 스큐 없음", () => {
    const svcRef = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values[0];
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 100; i++) {
      const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v4", {
        perm_svc: svcRef, role: "admin",
      });
      records.push({
        address_context: { permission: `permission:v4:${addr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        session_id: "auth-service",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const skews = analyzeDeploymentSkew(usage.versionUsages);

    const permSkew = skews.find(s => s.prefix === "permission")!;
    expect(permSkew.hasSkew).toBe(false);
    expect(permSkew.severity).toBe("ok");
  });

  it("다중 서비스 × 다중 version → 스큐 감지 (critical)", () => {
    const records: AddressContextRecord[] = [];
    const svcRefV1 = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values[0];

    // auth-service: permission v4 사용
    for (let i = 0; i < 200; i++) {
      const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v4", {
        perm_svc: svcRefV1, role: "admin",
      });
      records.push({
        address_context: { permission: `permission:v4:${addr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        session_id: "auth-service",
      });
    }

    // payment-service: permission v3에 머물러 있음!
    for (let i = 0; i < 150; i++) {
      const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v3", {
        perm_svc: svcRefV1, role: "admin",
      });
      records.push({
        address_context: { permission: `permission:v3:${addr}` },
        timestamp: new Date(2026, 2, 20, 1, 0, i).toISOString(),
        session_id: "payment-service",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const skews = analyzeDeploymentSkew(usage.versionUsages);

    console.log("\n══ 배포 스큐 감지 ══");
    for (const s of skews) {
      const icon = s.severity === "ok" ? "✅" : s.severity === "warning" ? "⚠" : "🔴";
      console.log(`  ${icon} ${s.summary}`);
      if (s.staleConsumers.length > 0) {
        for (const sc of s.staleConsumers) {
          console.log(`    → ${sc.session}: ${sc.version} (${sc.count}건)`);
        }
      }
      for (const v of s.activeVersions) {
        console.log(`    ${v.version}: ${v.count}건 [${v.sessions.join(", ")}]`);
      }
    }

    const permSkew = skews.find(s => s.prefix === "permission")!;
    expect(permSkew.hasSkew).toBe(true);
    expect(permSkew.severity).toBe("critical");
    expect(permSkew.staleConsumers.length).toBe(1);
    expect(permSkew.staleConsumers[0].session).toBe("payment-service");
    expect(permSkew.staleConsumers[0].version).toBe("v3");
  });

  it("같은 session이 양쪽 version 사용 → warning (전환 중)", () => {
    const records: AddressContextRecord[] = [];
    const svcRef = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values[0];

    // gateway-service: v3과 v4를 섞어서 사용 (마이그레이션 진행 중)
    for (let i = 0; i < 100; i++) {
      const ver = i < 30 ? "v3" : "v4"; // 처음 30건은 v3, 나머지 v4
      const addr = encodePrefixByValue(DEMO_CATALOG, "permission", ver, {
        perm_svc: svcRef, role: "admin",
      });
      records.push({
        address_context: { permission: `permission:${ver}:${addr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        session_id: "gateway-service",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const skews = analyzeDeploymentSkew(usage.versionUsages);

    const permSkew = skews.find(s => s.prefix === "permission")!;
    expect(permSkew.hasSkew).toBe(true);
    // gateway-service가 양쪽 다 사용 → staleConsumers에 안 들어감 → warning
    expect(permSkew.severity).toBe("warning");
    expect(permSkew.staleConsumers.length).toBe(0);

    console.log("\n══ 전환 중 감지 ══");
    console.log(`  ${permSkew.summary}`);
  });

  it("versionUsages에 session 정보가 포함된다", () => {
    const records: AddressContextRecord[] = [];
    const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];

    for (let i = 0; i < 50; i++) {
      const addr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcRef, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      records.push({
        address_context: { endpoint: `endpoint:v1:${addr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        session_id: i < 25 ? "api-gateway" : "web-server",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const epVersion = usage.versionUsages.find(v => v.prefix === "endpoint");
    expect(epVersion).toBeDefined();
    expect(epVersion!.sessions).toContain("api-gateway");
    expect(epVersion!.sessions).toContain("web-server");
    expect(epVersion!.count).toBe(50);
  });
});
