import { describe, expect, it } from "vitest";

import { DOMAIN_TEMPLATE_CATALOG, listTemplateCatalogs } from "./catalog.js";

describe("template catalog", () => {
  it("describes the domain scaffold as teachable architecture grammar", () => {
    expect(listTemplateCatalogs()).toContain(DOMAIN_TEMPLATE_CATALOG);
    expect(DOMAIN_TEMPLATE_CATALOG.artifacts.map((artifact) => artifact.id)).toEqual([
      "domain-identity",
      "domain-types",
      "domain-exception",
      "domain-entity",
      "domain-entity-test",
      "domain-index",
      "application-use-case",
      "application-command",
      "repository-port",
      "outbox-port",
      "transaction-port",
      "logger-port",
      "read-model-port",
      "drizzle-repository",
      "drizzle-schema",
      "outbox-adapter",
      "transaction-adapter",
      "unit-of-work-store",
      "logger-adapter",
      "read-model-adapter",
      "controller",
      "bff",
      "bff-controller",
      "openapi-fragment",
      "governance-metadata",
      "nest-module",
    ]);
    expect(DOMAIN_TEMPLATE_CATALOG.artifacts.find((artifact) => artifact.id === "domain-identity")?.topology).toBe("entry");
    expect(DOMAIN_TEMPLATE_CATALOG.artifacts.find((artifact) => artifact.id === "drizzle-schema")?.topology).toBe("component");
    expect(DOMAIN_TEMPLATE_CATALOG.artifacts.find((artifact) => artifact.id === "outbox-port")?.topology).toBe("interface");
    expect(DOMAIN_TEMPLATE_CATALOG.artifacts.find((artifact) => artifact.id === "application-use-case")?.topology).toBe("system");
    expect(DOMAIN_TEMPLATE_CATALOG.artifacts.find((artifact) => artifact.id === "nest-module")?.topology).toBe("layout");
    expect(DOMAIN_TEMPLATE_CATALOG.rules.map((rule) => rule.id)).toEqual([
      "domain-is-pure",
      "application-uses-ports",
      "presentation-calls-application",
      "module-binds-port",
      "metadata-ships-with-domain-slice",
      "transaction-and-logging-are-ports",
      "bff-does-not-expose-domain-entity",
    ]);
  });
});
