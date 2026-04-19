// @def.boundary registry-system
// @def.doc registry-system

import { afterEach, describe, expect, it } from "vitest";
import { RuntimeModule } from "../runtime.module.js";
import { createNestTestApp, wrapNestApp } from "../test/nest-helpers.js";

const nestApps: Awaited<ReturnType<typeof createNestTestApp>>[] = [];

async function buildApp() {
  const nestApp = await createNestTestApp({ imports: [RuntimeModule] });
  nestApps.push(nestApp);
  return wrapNestApp(nestApp);
}

afterEach(async () => {
  while (nestApps.length > 0) {
    await nestApps.pop()!.close();
  }
});

describe("Runtime Startup Smoke", () => {
  it("health, prefixes, catalogs, versions, services, endpoints, event-schemas respond after startup", async () => {
    const app = await buildApp();

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/prefixes")).status).toBe(200);
    expect((await app.request("/catalogs")).status).toBe(200);
    expect((await app.request("/api/services")).status).toBe(200);
    expect((await app.request("/api/endpoints")).status).toBe(200);
    expect((await app.request("/api/event-schemas?catalog=demo")).status).toBe(200);

    const registerResponse = await app.request("/prefixes", {
      method: "POST",
      body: JSON.stringify({
        prefix: "runtime_smoke",
        owner: "smoke",
        kind: "leaf",
        numberType: "number",
      }),
    });
    expect(registerResponse.status).toBe(201);

    const createDraftResponse = await app.request("/prefixes/runtime_smoke/versions", {
      method: "POST",
      body: JSON.stringify({
        versionId: "v1",
        baseVersionId: null,
        capacity: 8,
      }),
    });
    expect(createDraftResponse.status).toBe(201);
    expect((await app.request("/prefixes/runtime_smoke/versions")).status).toBe(200);
  });
});
