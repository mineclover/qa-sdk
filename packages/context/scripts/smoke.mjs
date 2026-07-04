#!/usr/bin/env node
import assert from "node:assert/strict";
import { DEMO_CATALOG } from "demo-snapshot";
import { createCatalogProvider, createQaContext } from "../dist/index.js";

const qa = createQaContext({
  env: "prod",
  region: "asia",
  service: "shopping-web",
  namespace: "shop",
  catalog: DEMO_CATALOG,
  executionMode: "test",
  executionId: "context-smoke",
});

const endpoint = qa.encode("endpoint", {
  resource_type: "api",
  http_method: "POST",
  api_version: "v1",
});
assert.match(endpoint, /^endpoint:v1:\d+$/);

const decoded = qa.decode(endpoint);
assert.equal(decoded.resource_type, "api");
assert.equal(decoded.http_method, "POST");

const tracked = qa.track({
  endpoint: {
    resource_type: "api",
    http_method: "GET",
    api_version: "v1",
  },
});
assert.match(tracked.address_context.endpoint, /^endpoint:v1:\d+$/);
assert.match(tracked.address_context.service, /^service:v1:\d+$/);
assert.equal(qa.executionMode, "test");
assert.equal(qa.executionId, "context-smoke");

const provider = createCatalogProvider({ catalog: DEMO_CATALOG });
assert.equal(provider.source, "local");
assert.equal(provider.latestVersion("endpoint"), "v1");
assert.equal((await provider.getCatalog()).id, DEMO_CATALOG.id);

console.log("context smoke passed");
