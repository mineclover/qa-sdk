import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("sim-gateway app", () => {
  const app = createApp();

  it("GET /health → 200 + service=sim-gateway", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; role: string };
    expect(body.service).toBe("sim-gateway");
    expect(body.role).toBe("edge-router");
  });

  it("x-request-id 응답 헤더 부착", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("GET /auth/login → 503 + targetService=sim-auth-api", async () => {
    const res = await app.request("/auth/login");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { targetService: string; error: string };
    expect(body.targetService).toBe("sim-auth-api");
    expect(body.error).toBe("not-implemented");
  });

  it("GET /projects/123 → 503 + targetService=sim-pm-api", async () => {
    const res = await app.request("/projects/123");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { targetService: string };
    expect(body.targetService).toBe("sim-pm-api");
  });

  it("7 placeholder 라우트 모두 503", async () => {
    const paths = [
      "/auth/x",
      "/projects/x",
      "/approvals/x",
      "/notifications/x",
      "/reports/x",
      "/documents/x",
      "/audit/x",
    ];
    for (const p of paths) {
      const res = await app.request(p);
      expect(res.status, p).toBe(503);
    }
  });
});
