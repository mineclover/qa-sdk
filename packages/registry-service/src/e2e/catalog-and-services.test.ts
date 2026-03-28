import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../app.module.js";
import { createNestTestApp, wrapNestApp, type CompatApp } from "../test/nest-helpers.js";
import { ApplicationController } from "../modules/services/application.controller.js";
import { ApplicationService } from "../modules/services/application.service.js";
import { ServiceHealthController } from "../modules/services/service-health.controller.js";
import {
  SERVICE_HEALTH_BINDINGS,
  ServiceHealthService,
} from "../modules/services/service-health.service.js";
import {
  SERVICE_CONFIG_STORE,
  SERVICE_ENDPOINT_STORE,
} from "../modules/services/service-topology.service.js";
import type { ConfigStore } from "../stores/config-store.js";

const nestApps: Awaited<ReturnType<typeof createNestTestApp>>[] = [];

async function buildApp() {
  const nestApp = await createNestTestApp({ imports: [AppModule] });
  nestApps.push(nestApp);
  return wrapNestApp(nestApp);
}

function mockConfigStore(services: unknown[]): ConfigStore {
  return {
    get: vi.fn().mockResolvedValue({ data: JSON.stringify(services) }),
    set: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  } as unknown as ConfigStore;
}

function mockBinding(status: number, body: unknown): Fetcher {
  return {
    fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  };
}

function mockBindingError(message: string): Fetcher {
  return {
    fetch: vi.fn().mockRejectedValue(new Error(message)),
  };
}

async function buildServiceHealthApp(deps: {
  configStore: ConfigStore;
  endpointStore?: unknown;
  serviceBindings?: Record<string, Fetcher>;
}) {
  const nestApp = await createNestTestApp({
    controllers: [ServiceHealthController],
    providers: [
      ServiceHealthService,
      { provide: SERVICE_CONFIG_STORE, useValue: deps.configStore },
      { provide: SERVICE_ENDPOINT_STORE, useValue: deps.endpointStore },
      { provide: SERVICE_HEALTH_BINDINGS, useValue: deps.serviceBindings },
    ],
  });
  nestApps.push(nestApp);
  return wrapNestApp(nestApp);
}

const SAMPLE_CATALOG = JSON.stringify({
  id: "demo",
  name: "쇼핑 데모",
  axes: {},
  prefixes: {
    permission: { id: "permission", name: "권한", labels: ["role", "action"], dims: {}, versions: [] },
    service: { id: "service", name: "서비스", labels: ["env"], dims: {}, versions: [] },
  },
});

const SEED_SERVICES = [
  { serviceId: "web", name: "Web", tier: "frontend", ownedPrefixes: ["page_view"], url: "http://localhost:5220" },
  { serviceId: "api", name: "API", tier: "backend", ownedPrefixes: ["endpoint"], gatewayPath: "/v1/api", stripPrefix: true, urls: { dev: "http://localhost:3200", prod: "https://api.prod" } },
  { serviceId: "gate", name: "Gate", tier: "infra", ownedPrefixes: [], gatewayPath: "/gate/", stripPrefix: true },
];

const SERVICES = [
  { serviceId: "ingest-server", name: "Ingest", tier: "infra", url: "https://ingest.test", urls: { prod: "https://ingest.prod" } },
  { serviceId: "gate-service", name: "Gate", tier: "infra", url: "https://gate.test" },
  { serviceId: "registry-service", name: "Registry", tier: "infra", url: "https://registry.test" },
  { serviceId: "local-only", name: "Local", tier: "infra", url: "http://localhost:9090" },
];

async function registerCatalog(app: CompatApp, id: string, name: string, data = SAMPLE_CATALOG) {
  return app.request("/catalogs", {
    method: "POST",
    body: JSON.stringify({ id, name, data }),
  });
}

async function replaceServices(app: CompatApp, services = SEED_SERVICES) {
  return app.request("/api/services", {
    method: "PATCH",
    body: JSON.stringify({ services }),
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (nestApps.length > 0) {
    await nestApps.pop()!.close();
  }
});

describe("Catalog Routes (Nest)", () => {
  let app: CompatApp;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("POST /catalogs → 201 등록", async () => {
    const res = await registerCatalog(app, "demo", "쇼핑 데모");
    expect(res.status).toBe(201);
    const body = await res.json<any>();
    expect(body.id).toBe("demo");
    expect(body.name).toBe("쇼핑 데모");
  });

  it("POST /catalogs 중복 → 409", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    expect((await registerCatalog(app, "demo", "쇼핑 데모 v2")).status).toBe(409);
  });

  it("POST /catalogs 필수 필드 누락 → 400", async () => {
    const res = await app.request("/catalogs", {
      method: "POST",
      body: JSON.stringify({ id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /catalogs → 목록 조회", async () => {
    await registerCatalog(app, "a", "A");
    await registerCatalog(app, "b", "B");
    const res = await app.request("/catalogs");
    expect(res.status).toBe(200);
    const list = await res.json<any[]>();
    expect(list).toHaveLength(2);
    expect(list[0]).toHaveProperty("updatedAt");
    expect(list[0]).not.toHaveProperty("data");
  });

  it("GET /catalogs/:id → 단건 조회", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await app.request("/catalogs/demo");
    expect(res.status).toBe(200);
    expect((await res.json<any>()).data).toBe(SAMPLE_CATALOG);
  });

  it("GET /catalogs/:id 없는 ID → 404", async () => {
    expect((await app.request("/catalogs/nope")).status).toBe(404);
  });

  it("PUT /catalogs/:id → 업데이트", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await app.request("/catalogs/demo", {
      method: "PUT",
      body: JSON.stringify({ name: "쇼핑 데모 v2" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).name).toBe("쇼핑 데모 v2");
  });

  it("PUT /catalogs/:id 없는 ID → 404", async () => {
    const res = await app.request("/catalogs/nope", {
      method: "PUT",
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /catalogs/:id → 삭제", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    expect((await app.request("/catalogs/demo", { method: "DELETE" })).status).toBe(200);
    expect((await app.request("/catalogs/demo")).status).toBe(404);
  });

  it("DELETE /catalogs/:id 없는 ID → 404", async () => {
    expect((await app.request("/catalogs/nope", { method: "DELETE" })).status).toBe(404);
  });

  it("GET /catalogs/:id/prefixes → prefix 목록", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await app.request("/catalogs/demo/prefixes");
    expect(res.status).toBe(200);
    const prefixes = await res.json<any[]>();
    expect(prefixes).toHaveLength(2);
    expect(prefixes[0]).toHaveProperty("id");
    expect(prefixes[0]).toHaveProperty("name");
    expect(prefixes[0]).toHaveProperty("dims");
  });

  it("GET /catalogs/:id/prefixes 없는 카탈로그 → 404", async () => {
    expect((await app.request("/catalogs/nope/prefixes")).status).toBe(404);
  });

  it("CRUD 라운드트립", async () => {
    await registerCatalog(app, "test", "테스트");
    let res = await app.request("/catalogs/test");
    expect(res.status).toBe(200);

    await app.request("/catalogs/test", {
      method: "PUT",
      body: JSON.stringify({ name: "테스트 v2", data: "{\"id\":\"test\",\"name\":\"v2\",\"axes\":{},\"prefixes\":{}}" }),
    });
    res = await app.request("/catalogs/test");
    expect((await res.json<any>()).name).toBe("테스트 v2");

    await app.request("/catalogs/test", { method: "DELETE" });
    expect((await app.request("/catalogs/test")).status).toBe(404);
  });
});

describe("services routes (Nest)", () => {
  let app: CompatApp;

  beforeEach(async () => {
    app = await buildApp();
    await replaceServices(app);
  });

  it("전체 서비스 목록 반환", async () => {
    const res = await app.request("/api/services");
    const data = await res.json<any[]>();
    expect(data).toHaveLength(3);
    expect(data.map((service) => service.serviceId)).toEqual(["web", "api", "gate"]);
  });

  it("빈 목록도 정상 반환", async () => {
    const emptyApp = await buildApp();
    expect(await (await emptyApp.request("/api/services")).json<any[]>()).toEqual([]);
  });

  it("단건 조회", async () => {
    const res = await app.request("/api/services/api");
    const data = await res.json<any>();
    expect(data.serviceId).toBe("api");
    expect(data.gatewayPath).toBe("/v1/api");
  });

  it("없는 서비스 → 404", async () => {
    expect((await app.request("/api/services/nonexistent")).status).toBe(404);
  });

  it("prefix → 서비스 맵 반환", async () => {
    const data = await (await app.request("/api/services/svc-owners")).json<Record<string, string>>();
    expect(data["page_view"]).toBe("web");
    expect(data["endpoint"]).toBe("api");
  });

  it("gatewayPath가 있는 서비스만 반환", async () => {
    const data = await (await app.request("/api/services/gateway?env=dev")).json<any>();
    expect(data.routes).toHaveLength(2);
    expect(data.env).toBe("dev");
  });

  it("strip 플래그 포함", async () => {
    const data = await (await app.request("/api/services/gateway?env=dev")).json<any>();
    expect(data.routes.find((route: any) => route.serviceId === "api").strip).toBe(true);
  });

  it("env=prod일 때 urls.prod 사용", async () => {
    const data = await (await app.request("/api/services/gateway?env=prod")).json<any>();
    expect(data.routes.find((route: any) => route.serviceId === "api").url).toBe("https://api.prod");
  });

  it("신규 서비스 추가", async () => {
    const res = await app.request("/api/services", {
      method: "POST",
      body: JSON.stringify({ serviceId: "new-svc", name: "New", ownedPrefixes: [] }),
    });
    const data = await res.json<any>();
    expect(data.ok).toBe(true);
    expect(data.action).toBe("created");
    expect(await (await app.request("/api/services")).json<any[]>()).toHaveLength(4);
  });

  it("기존 서비스 업데이트", async () => {
    const res = await app.request("/api/services", {
      method: "POST",
      body: JSON.stringify({ serviceId: "web", name: "Web Updated", ownedPrefixes: ["page_view", "tracking"] }),
    });
    expect((await res.json<any>()).action).toBe("updated");
  });

  it("서비스 삭제", async () => {
    const res = await app.request("/api/services/gate", { method: "DELETE" });
    expect((await res.json<any>()).ok).toBe(true);
    expect(await (await app.request("/api/services")).json<any[]>()).toHaveLength(2);
  });
});

describe("service-health routes (Nest)", () => {
  it("Service Binding 사용 시 직접 호출", async () => {
    const bindings: Record<string, Fetcher> = {
      "ingest-server": mockBinding(200, { ok: true }),
      "gate-service": mockBinding(200, { status: "ok" }),
    };
    const app = await buildServiceHealthApp({
      configStore: mockConfigStore(SERVICES),
      serviceBindings: bindings,
    });

    const res = await app.request("/api/health/services?env=dev");
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.services.find((service: any) => service.serviceId === "ingest-server").status).toBe("up");
    expect((bindings["ingest-server"].fetch as any)).toHaveBeenCalled();
  });

  it("registry-service는 self-check (항상 up)", async () => {
    const app = await buildServiceHealthApp({ configStore: mockConfigStore(SERVICES) });
    const data = await (await app.request("/api/health/services?env=dev")).json<any>();
    const registry = data.services.find((service: any) => service.serviceId === "registry-service");
    expect(registry.status).toBe("up");
    expect(registry.latencyMs).toBe(0);
  });

  it("localhost URL은 필터링됨", async () => {
    const app = await buildServiceHealthApp({ configStore: mockConfigStore(SERVICES) });
    const data = await (await app.request("/api/health/services?env=dev")).json<any>();
    expect(data.services.find((service: any) => service.serviceId === "local-only")).toBeUndefined();
  });

  it("binding 에러 시 down 상태 반환", async () => {
    const bindings: Record<string, Fetcher> = {
      "gate-service": mockBindingError("Connection refused"),
    };
    const app = await buildServiceHealthApp({
      configStore: mockConfigStore(SERVICES),
      serviceBindings: bindings,
    });
    const data = await (await app.request("/api/health/services?env=dev")).json<any>();
    const gate = data.services.find((service: any) => service.serviceId === "gate-service");
    expect(gate.status).toBe("down");
    expect(gate.error).toContain("Connection refused");
  });

  it("전체 healthy/degraded/unhealthy 판정", async () => {
    const allUp: Record<string, Fetcher> = {
      "ingest-server": mockBinding(200, { ok: true }),
      "gate-service": mockBinding(200, { ok: true }),
    };
    const app = await buildServiceHealthApp({
      configStore: mockConfigStore(SERVICES),
      serviceBindings: allUp,
    });
    const data = await (await app.request("/api/health/services?env=dev")).json<any>();
    expect(data.status).toBe("healthy");
    expect(data.up).toBeGreaterThan(0);
    expect(data.down).toBe(0);
  });

  it("env=prod일 때 urls.prod 사용", async () => {
    const bindings: Record<string, Fetcher> = {
      "ingest-server": mockBinding(200, { ok: true }),
      "gate-service": mockBinding(200, { ok: true }),
    };
    const app = await buildServiceHealthApp({
      configStore: mockConfigStore(SERVICES),
      serviceBindings: bindings,
    });
    const data = await (await app.request("/api/health/services?env=prod")).json<any>();
    expect(data.services.find((service: any) => service.serviceId === "ingest-server").url).toBe("https://ingest.prod");
  });
});
