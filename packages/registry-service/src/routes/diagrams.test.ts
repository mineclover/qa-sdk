/**
 * diagrams 라우트 단위 테스트.
 *
 * DKG graph를 주입하여 다이어그램 API 응답 검증.
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { bootstrapDkg } from "@qa-sdk/spec-core/dkg";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { createDiagramRoutes } from "./diagrams.js";
import type { GraphRegistryPort } from "../types/spec-core-ports.js";

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG }) as GraphRegistryPort;

function buildApp() {
  const app = new Hono();
  app.route("/api/diagrams", createDiagramRoutes({ getGraph: () => graph }));
  return app;
}

describe("diagrams routes", () => {
  const app = buildApp();

  describe("GET /api/diagrams", () => {
    it("카테고리별 다이어그램 목록", async () => {
      const res = await app.request("/api/diagrams");
      expect(res.status).toBe(200);
      const d = await res.json() as Record<string, any[]>;
      expect(d["intent-links"]).toBeTruthy();
      expect(d["intent-links"].length).toBeGreaterThan(0);
      expect(d["dsl"]).toBeTruthy();
      expect(d["domain"]).toBeTruthy();
      expect(d["constraint"]).toBeTruthy();
    });
  });

  describe("GET /api/diagrams/:kind/:id", () => {
    it("IntentLink 다이어그램 생성", async () => {
      const res = await app.request("/api/diagrams/intent-links/IL-checkout-flow");
      expect(res.status).toBe(200);
      const d = await res.json() as any;
      expect(d.kind).toBe("intent-links");
      expect(d.mmd).toContain("sequenceDiagram");
    });

    it("DSL 다이어그램 생성", async () => {
      const list = await (await app.request("/api/diagrams")).json() as Record<string, any[]>;
      const firstDsl = list["dsl"]?.[0];
      if (!firstDsl) return; // DSL이 없으면 스킵
      const res = await app.request(`/api/diagrams/dsl/${encodeURIComponent(firstDsl.id)}`);
      expect(res.status).toBe(200);
      const d = await res.json() as any;
      expect(d.mmd).toContain("sequenceDiagram");
    });

    it("Domain 다이어그램 생성", async () => {
      const res = await app.request("/api/diagrams/domain/shopping-domain");
      expect(res.status).toBe(200);
      const d = await res.json() as any;
      expect(d.mmd).toBeTruthy();
    });

    it("Table ER 다이어그램", async () => {
      const res = await app.request("/api/diagrams/table-er/__all__");
      expect(res.status).toBe(200);
      const d = await res.json() as any;
      expect(d.mmd).toContain("erDiagram");
    });

    it("Transition DAG", async () => {
      const res = await app.request("/api/diagrams/transition-dag/__all__");
      expect(res.status).toBe(200);
      const d = await res.json() as any;
      expect(d.mmd).toBeTruthy();
    });

    it("없는 kind → 400", async () => {
      const res = await app.request("/api/diagrams/nonexistent/test");
      expect(res.status).toBe(400);
    });

    it("없는 IntentLink → 400", async () => {
      const res = await app.request("/api/diagrams/intent-links/IL-nonexistent");
      expect(res.status).toBe(400);
    });
  });
});
