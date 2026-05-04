// @def.boundary sim-scenarios

import { afterEach, describe, expect, it } from "vitest";
import { wireSimHandles, unwireSimHandles } from "./index.js";

const HANDLE_KEYS = [
  "__simAuditFetcher",
  "__simWaitForCycles",
  "__simCatalogStore",
  "__simFaultInjector",
  "__simComposeHandle",
  "__simBurstLoad",
  "__simBffRead",
  "__simOutboxClient",
  "__simBitmapMetrics",
  "__simBitmapVersionMutator",
  "__simBitmapVersionCheck",
  "__simGatewayStickyConsistency",
  "__simHandle",
  "__simGatewayFetch",
] as const;

describe("wireSimHandles", () => {
  afterEach(() => {
    unwireSimHandles();
  });

  it("14 handle을 globalThis에 binding한다 (시나리오 1~17 전체)", () => {
    wireSimHandles({
      auditRecorderUrl: "http://audit",
      controllerUrl: "http://ctrl",
      gatewayUrl: "http://gw",
      authApiUrl: "http://auth",
      approvalApiUrl: "http://approval",
      bffReadUrl: "http://bff/v1",
    });
    const g = globalThis as unknown as Record<string, unknown>;
    for (const k of HANDLE_KEYS) {
      expect(g[k]).toBeDefined();
    }
  });

  it("__simAuditFetcher가 AuditFetcher interface 구현체", () => {
    wireSimHandles({
      auditRecorderUrl: "http://audit",
      controllerUrl: "http://ctrl",
      gatewayUrl: "http://gw",
      authApiUrl: "http://auth",
      approvalApiUrl: "http://approval",
      bffReadUrl: "http://bff/v1",
    });
    const g = globalThis as unknown as {
      __simAuditFetcher?: {
        queryDecisions: unknown;
        queryFirstDecision: unknown;
        countAlerts: unknown;
      };
    };
    expect(typeof g.__simAuditFetcher?.queryDecisions).toBe("function");
    expect(typeof g.__simAuditFetcher?.queryFirstDecision).toBe("function");
    expect(typeof g.__simAuditFetcher?.countAlerts).toBe("function");
  });

  it("__simFaultInjector가 6개 fault category를 모두 노출", () => {
    wireSimHandles({
      auditRecorderUrl: "http://audit",
      controllerUrl: "http://ctrl",
      gatewayUrl: "http://gw",
      authApiUrl: "http://auth",
      approvalApiUrl: "http://approval",
      bffReadUrl: "http://bff/v1",
    });
    const g = globalThis as unknown as {
      __simFaultInjector?: Record<string, unknown>;
    };
    const expected = [
      "schemaBreak",
      "auditAnomaly",
      "dbPool",
      "replicationLag",
      "perfWarn",
      "pubsubInvalidate",
    ];
    for (const k of expected) {
      expect(g.__simFaultInjector?.[k]).toBeDefined();
    }
  });

  it("unwireSimHandles 후 모든 handle 제거", () => {
    wireSimHandles({
      auditRecorderUrl: "http://audit",
      controllerUrl: "http://ctrl",
      gatewayUrl: "http://gw",
      authApiUrl: "http://auth",
      approvalApiUrl: "http://approval",
      bffReadUrl: "http://bff/v1",
    });
    unwireSimHandles();
    const g = globalThis as unknown as Record<string, unknown>;
    for (const k of HANDLE_KEYS) {
      expect(g[k]).toBeUndefined();
    }
  });

  it("__simHandle — fixtures.alice + authApp.address shim 노출", () => {
    wireSimHandles({
      auditRecorderUrl: "http://audit",
      controllerUrl: "http://ctrl",
      gatewayUrl: "http://gw",
      authApiUrl: "http://auth:4400",
      approvalApiUrl: "http://approval",
      bffReadUrl: "http://bff/v1",
    });
    const g = globalThis as unknown as {
      __simHandle?: {
        fixtures: { alice: { email: string; password: string; id: string } };
        authApp: { getHttpServer: () => { address: () => { port: number } | null } };
      };
    };
    expect(g.__simHandle?.fixtures.alice.email).toBe("alice@example.com");
    expect(g.__simHandle?.authApp.getHttpServer().address()).toEqual({ port: 4400 });
  });

  it("__simGatewayFetch — 함수로 노출", () => {
    wireSimHandles({
      auditRecorderUrl: "http://audit",
      controllerUrl: "http://ctrl",
      gatewayUrl: "http://gw",
      authApiUrl: "http://auth",
      approvalApiUrl: "http://approval",
      bffReadUrl: "http://bff/v1",
    });
    const g = globalThis as unknown as {
      __simGatewayFetch?: (req: Request) => Promise<Response>;
    };
    expect(typeof g.__simGatewayFetch).toBe("function");
  });

  it("재호출 멱등 — 동일 URL로 두 번 호출해도 binding 상태 유지", () => {
    const args = {
      auditRecorderUrl: "http://audit",
      controllerUrl: "http://ctrl",
      gatewayUrl: "http://gw",
      authApiUrl: "http://auth",
      approvalApiUrl: "http://approval",
      bffReadUrl: "http://bff/v1",
    };
    wireSimHandles(args);
    wireSimHandles(args);
    const g = globalThis as unknown as Record<string, unknown>;
    for (const k of HANDLE_KEYS) {
      expect(g[k]).toBeDefined();
    }
  });
});
