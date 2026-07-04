import assert from "node:assert/strict";
import app from "../src/index.ts";

async function requestJson(path: string, init?: RequestInit, expectedStatus = 200) {
  const response = await app.request(path, init);
  assert.equal(response.status, expectedStatus, `${path} status`);
  return response.json() as Promise<Record<string, unknown>>;
}

const health = await requestJson("/health");
assert.deepEqual(health, { ok: true, service: "platform-demo-api" });

const apiHealth = await requestJson("/api/health");
assert.deepEqual(apiHealth, { ok: true, service: "platform-demo-api" });

const overview = await requestJson("/api/dashboard/overview");
assert.equal(overview.lastBootstrap, "platform-demo-api");
assert.ok((overview.nodes as { axis: number }).axis > 0);

const dashboardSchema = await requestJson("/api/dashboard/schema");
assert.ok(Array.isArray(dashboardSchema.axes));
assert.ok(Array.isArray(dashboardSchema.prefixes));
assert.ok(Array.isArray(dashboardSchema.consumers));

const refresh = await requestJson("/api/dashboard/refresh", { method: "POST" });
assert.deepEqual(refresh, { collected: false, changes: [] });

const prefixMeta = await requestJson("/api/prefix-meta");
const dims = prefixMeta.dims as Array<{ id: string }>;
const indices = prefixMeta.indices as Array<{ id: string }>;
assert.ok(dims.some((dim) => dim.id === "env"));
assert.ok(indices.some((index) => index.id === "service"));
assert.ok(indices.some((index) => index.id === "permission"));

const serviceCells = await requestJson("/api/service/cells?xDim=env&yDim=region");
assert.equal(serviceCells.xDim, "env");
assert.equal(serviceCells.yDim, "region");
assert.equal((serviceCells.xLabels as unknown[]).length, 5);
assert.equal((serviceCells.yLabels as unknown[]).length, 2);
assert.equal((serviceCells.cells as unknown[]).length, 10);

const invalidServiceCells = await requestJson(
  "/api/service/cells?xDim=env&yDim=env",
  undefined,
  400,
);
assert.equal(invalidServiceCells.error, "xDim and yDim must be different");

const serviceDecoded = await requestJson("/api/service/decode/0");
assert.equal(typeof serviceDecoded.env, "string");
assert.equal(typeof serviceDecoded.region, "string");
assert.equal(typeof serviceDecoded.svc_name, "string");
assert.equal(typeof serviceDecoded.namespace, "string");

const permissionCells = await requestJson("/api/permission/cells?ver=v4");
assert.equal(permissionCells.ver, "v4");
assert.equal(permissionCells.prefix, "permission:v4");
assert.ok((permissionCells.roleLabels as Array<{ id: string }>).some((role) => role.id === "auditor"));
assert.ok((permissionCells.cells as unknown[]).length > 0);

const permissionDecoded = await requestJson("/api/permission/decode/0?ver=v4");
assert.equal(permissionDecoded.address, "permission:v4:0");
assert.equal(typeof permissionDecoded.role, "string");
assert.equal(typeof permissionDecoded.perm_svc, "number");

const eventCells = await requestJson("/api/event/cells?ver=v4&initiator=web");
assert.equal(eventCells.ver, "v4");
assert.equal(eventCells.prefix, "event:v4");
assert.equal(eventCells.initiator, "web");
assert.ok((eventCells.eventLabels as Array<{ id: string }>).some((event) => event.id === "payment.refunded"));
assert.ok((eventCells.cells as unknown[]).length > 0);

const invalidEventCells = await requestJson(
  "/api/event/cells?ver=v4&initiator=cli",
  undefined,
  400,
);
assert.equal(invalidEventCells.error, "Invalid initiator");

const eventDecoded = await requestJson("/api/event/decode/0?ver=v4");
assert.equal(eventDecoded.address, "event:v4:0");
assert.equal(typeof eventDecoded.event_name, "string");
assert.equal(typeof eventDecoded.initiator, "string");

console.log("platform demo api read routes smoke passed");
