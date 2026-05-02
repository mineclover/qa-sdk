import { describe, it, expect, vi } from "vitest";
import { createEnhancedDiscoveryClient } from "../../src/discovery/enhanced-client.js";
import type { DiscoveryClient, ServiceInfo } from "../../src/discovery/client.js";
import type { DefinitionAdapter, ServiceDocsInfo, ServiceTestInfo } from "../../src/adapters/definition.js";

function createMockBaseClient(services: ServiceInfo[]): DiscoveryClient {
  return {
    resolve: vi.fn(async (serviceId) => services.find((s) => s.serviceId === serviceId) ?? null),
    resolveAll: vi.fn(async () => Object.fromEntries(services.map((s) => [s.serviceId, s.url]))),
    listServices: vi.fn(async () => services),
    generateConnectCode: vi.fn(async () => "// code"),
    generateConnectCodeAll: vi.fn(async () => "// codes"),
  };
}

function createMockDefinitionAdapter(overrides?: Partial<DefinitionAdapter>): DefinitionAdapter {
  return {
    getServiceDocs: vi.fn(async (serviceId) => ({
      serviceId,
      totalDocs: 5,
      byLifecycle: { implemented: 3, approved: 2 },
      byLayer: { domain: 2, operation: 3 },
      docs: [
        { docId: "d1", title: "Test Doc", lifecycle: "implemented", layer: "domain", scope: "core" },
      ],
    })),
    getServiceTestHealth: vi.fn(async (serviceId) => ({
      serviceId,
      totalTests: 10,
      passRate: 90,
      healthy: "pass" as const,
    })),
    getPrefixInfo: vi.fn(async (prefixId) => ({
      prefixId,
      name: prefixId,
      category: "observation",
      labels: [],
      description: "",
    })),
    getOwnedPrefixDetails: vi.fn(async (prefixIds) =>
      prefixIds.map((id) => ({
        prefixId: id,
        name: id,
        category: "observation",
        labels: [],
        description: "",
      })),
    ),
    ...overrides,
  };
}

const TEST_SERVICE: ServiceInfo = {
  serviceId: "ingest-server",
  name: "이벤트 수집",
  url: "http://localhost:3200",
  tier: "infra",
  team: "platform",
  ownedPrefixes: ["pipeline_point", "ingest_record"],
  consumedPrefixes: [],
};

describe("EnhancedDiscoveryClient", () => {
  it("resolveEnhanced: registry + definition 데이터 통합", async () => {
    const base = createMockBaseClient([TEST_SERVICE]);
    const def = createMockDefinitionAdapter();
    const enhanced = createEnhancedDiscoveryClient(base, def);

    const result = await enhanced.resolveEnhanced("ingest-server", "dev");

    expect(result).not.toBeNull();
    expect(result!.serviceId).toBe("ingest-server");
    expect(result!.url).toBe("http://localhost:3200");

    // definition 데이터 확인
    expect(result!.docs).toBeDefined();
    expect(result!.docs!.totalDocs).toBe(5);
    expect(result!.testHealth).toBeDefined();
    expect(result!.testHealth!.passRate).toBe(90);
    expect(result!.ownedPrefixDetails).toBeDefined();
    expect(result!.ownedPrefixDetails).toHaveLength(2);
  });

  it("resolveEnhanced: 서비스 없으면 null", async () => {
    const base = createMockBaseClient([]);
    const def = createMockDefinitionAdapter();
    const enhanced = createEnhancedDiscoveryClient(base, def);

    const result = await enhanced.resolveEnhanced("nonexistent");
    expect(result).toBeNull();
  });

  it("resolveEnhanced: definition 실패해도 기본 정보 반환 (fail-open)", async () => {
    const base = createMockBaseClient([TEST_SERVICE]);
    const def = createMockDefinitionAdapter({
      getServiceDocs: vi.fn(async () => { throw new Error("definition down"); }),
      getServiceTestHealth: vi.fn(async () => { throw new Error("definition down"); }),
      getOwnedPrefixDetails: vi.fn(async () => { throw new Error("definition down"); }),
    });
    const enhanced = createEnhancedDiscoveryClient(base, def);

    const result = await enhanced.resolveEnhanced("ingest-server", "dev");

    expect(result).not.toBeNull();
    expect(result!.serviceId).toBe("ingest-server");
    expect(result!.url).toBe("http://localhost:3200");
    // definition 데이터는 undefined (fail-open)
    expect(result!.docs).toBeUndefined();
    expect(result!.testHealth).toBeUndefined();
    expect(result!.ownedPrefixDetails).toBeUndefined();
  });

  it("resolveEnhanced: ownedPrefixes 없으면 prefix 조회 건너뜀", async () => {
    const svcNoPrefixes = { ...TEST_SERVICE, ownedPrefixes: [] };
    const base = createMockBaseClient([svcNoPrefixes]);
    const def = createMockDefinitionAdapter();
    const enhanced = createEnhancedDiscoveryClient(base, def);

    const result = await enhanced.resolveEnhanced("ingest-server");
    expect(result!.ownedPrefixDetails).toBeUndefined();
    expect(def.getOwnedPrefixDetails).not.toHaveBeenCalled();
  });

  it("기본 DiscoveryClient 메서드 위임", async () => {
    const base = createMockBaseClient([TEST_SERVICE]);
    const def = createMockDefinitionAdapter();
    const enhanced = createEnhancedDiscoveryClient(base, def);

    // 기본 메서드 동작 확인
    const resolved = await enhanced.resolve("ingest-server");
    expect(resolved).toEqual(TEST_SERVICE);

    const all = await enhanced.resolveAll("dev");
    expect(all).toEqual({ "ingest-server": "http://localhost:3200" });

    const list = await enhanced.listServices();
    expect(list).toEqual([TEST_SERVICE]);
  });

  it("getServiceDocs: definition adapter에 위임", async () => {
    const base = createMockBaseClient([TEST_SERVICE]);
    const def = createMockDefinitionAdapter();
    const enhanced = createEnhancedDiscoveryClient(base, def);

    const docs = await enhanced.getServiceDocs("ingest-server");
    expect(docs.serviceId).toBe("ingest-server");
    expect(docs.totalDocs).toBe(5);
    expect(def.getServiceDocs).toHaveBeenCalledWith("ingest-server");
  });

  it("getServiceTestHealth: definition adapter에 위임", async () => {
    const base = createMockBaseClient([TEST_SERVICE]);
    const def = createMockDefinitionAdapter();
    const enhanced = createEnhancedDiscoveryClient(base, def);

    const health = await enhanced.getServiceTestHealth("ingest-server");
    expect(health.serviceId).toBe("ingest-server");
    expect(health.healthy).toBe("pass");
    expect(def.getServiceTestHealth).toHaveBeenCalledWith("ingest-server");
  });
});
