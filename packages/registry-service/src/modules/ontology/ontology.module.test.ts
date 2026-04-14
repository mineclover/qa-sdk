import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { OperationalOntologySchema } from "operational-ontology/schema";
import { DatabaseModule } from "../../database.module.js";
import type { OntologyRegistryStore } from "../../stores/ontology-registry-store.js";
import { createNestTestApp, request } from "../../test/nest-helpers.js";
import { OntologyPackActivationHelper } from "./ontology-activation.helper.js";
import { OntologyRegistryService } from "./ontology-registry.service.js";
import { ONTOLOGY_REGISTRY_STORE, OntologyModule } from "./ontology.module.js";

const schema = {
  axes: [
    { id: "resource_kind", values: ["service", "route"], capacity: 8 },
  ],
  taxonomies: [
    {
      id: "authorization-resource",
      appliesTo: ["node"],
      axisIds: ["resource_kind"],
      identityAxisIds: ["resource_kind"],
      space: "authorization",
    },
  ],
  relationCategories: [],
} satisfies OperationalOntologySchema;

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe("OntologyModule (Nest)", () => {
  it("provides the ontology registry service through the ontology store token without routes", async () => {
    const app = await createNestTestApp({
      imports: [DatabaseModule, OntologyModule],
    });
    apps.push(app);

    const service = app.get(OntologyRegistryService);
    const activationHelper = app.get(OntologyPackActivationHelper);
    const ontologyStore = app.get<OntologyRegistryStore>(ONTOLOGY_REGISTRY_STORE);

    expect(activationHelper).toBeInstanceOf(OntologyPackActivationHelper);

    await service.reserveAddressSpace(schema, {
      ontologyId: "authz-runtime",
      namespace: "authz",
      owner: "registry-service",
      versionId: "v1",
      now: "2026-04-14T00:00:00.000Z",
    });

    await expect(
      ontologyStore.getAllocation("authz-runtime:authorization-resource:v1"),
    ).resolves.toEqual(
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v1",
        prefix: "authz_authorization_resource",
        status: "reserved",
      }),
    );

    const response = await request(app, "GET", "/ontology");
    expect(response.statusCode).toBe(404);
  });
});
