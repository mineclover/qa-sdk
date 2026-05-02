// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { InMemoryScenarioSpecStore } from "@qa-sdk/store";
import { createErrorHandler } from "../middleware/error-handler.js";
import { createScenarioRoutes } from "./scenario.js";

function buildApp() {
  const scenarioSpecStore = new InMemoryScenarioSpecStore();
  const app = new Hono();
  app.onError(createErrorHandler(pino({ level: "silent" })));
  app.route("/", createScenarioRoutes({ scenarioSpecStore }));
  return { app, scenarioSpecStore };
}

const VALID_SPEC = {
  scenario_id: "checkout-flow",
  version: "1.0.0",
  domain: "checkout",
  steps: [{ id: "s1", event_key: "page_view", required: true, kind: "sequence" }],
};

describe("POST /v1/scenarios", () => {
  it("returns 201 and accepted=true for a valid spec", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_SPEC),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.scenario_id).toBe("checkout-flow");
  });

  it("returns 400 for schema validation failure (missing required fields)", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_id: "bad-spec" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required top-level fields", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_id: "sc-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("upserts an existing spec on repeat POST", async () => {
    const { app, scenarioSpecStore } = buildApp();
    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_SPEC),
    });
    const updated = { ...VALID_SPEC, version: "2.0.0" };
    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const stored = await scenarioSpecStore.findById("checkout-flow");
    expect(stored?.version).toBe("2.0.0");
  });
});

describe("GET /v1/scenarios", () => {
  it("returns empty items when no scenarios registered", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/scenarios");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("returns all registered scenarios", async () => {
    const { app } = buildApp();
    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_SPEC),
    });

    const res = await app.request("/v1/scenarios");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].scenario_id).toBe("checkout-flow");
  });

  it("returns 400 for limit=0", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/scenarios?limit=0");
    expect(res.status).toBe(400);
  });

  it("filters by domain when domain query param is provided", async () => {
    const { app } = buildApp();
    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_SPEC),
    });
    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...VALID_SPEC, scenario_id: "login-flow", domain: "login" }),
    });

    const res = await app.request("/v1/scenarios?domain=checkout");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].domain).toBe("checkout");
  });
});

describe("GET /v1/scenarios/:scenarioId", () => {
  it("returns 404 for unknown scenario", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/scenarios/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 200 with the scenario spec", async () => {
    const { app } = buildApp();
    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_SPEC),
    });

    const res = await app.request("/v1/scenarios/checkout-flow");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scenario_id).toBe("checkout-flow");
  });
});

describe("DELETE /v1/scenarios/:scenarioId", () => {
  it("returns 404 when scenario does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/scenarios/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("returns 200 with deleted=true and removes the scenario", async () => {
    const { app, scenarioSpecStore } = buildApp();
    await app.request("/v1/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_SPEC),
    });

    const res = await app.request("/v1/scenarios/checkout-flow", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.scenario_id).toBe("checkout-flow");
    expect(await scenarioSpecStore.findById("checkout-flow")).toBeNull();
  });
});
