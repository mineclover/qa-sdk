// @def.boundary registry-system
// @def.doc registry-system

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { SqlIndexMetaStore, SqlPrefixRegistry } from "index-meta";
import type { OperationalOntologyPack } from "operational-ontology/pack";
import { afterEach, describe, expect, it } from "vitest";

import { SqlOntologyRegistryStore } from "../../stores/sql-ontology-registry-store.js";
import { OntologyPackActivationHelper } from "./ontology-activation.helper.js";
import { OntologyRegistryService } from "./ontology-registry.service.js";
import {
  LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE,
  createLocalOntologyActivationRuntime,
  resolveLocalOntologyActivationStorePath,
  type LocalOntologyActivationRuntime,
} from "./local-activation-runtime.js";

const validPack = {
  packId: "authorization-ontology",
  schema: {
    axes: [{ id: "resource_kind", values: ["service", "route"], capacity: 8 }],
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
  },
} satisfies OperationalOntologyPack;

const tempDirs: string[] = [];
const activeRuntimes: LocalOntologyActivationRuntime[] = [];

afterEach(async () => {
  while (activeRuntimes.length > 0) {
    activeRuntimes.pop()!.close();
  }
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("createLocalOntologyActivationRuntime", () => {
  it("constructs the activation helper over SQL-backed registry-service and index-meta stores", async () => {
    const runtime = await createTrackedRuntime();

    expect(runtime.storePath).toBe(LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE);
    expect(runtime.ontologyStore).toBeInstanceOf(SqlOntologyRegistryStore);
    expect(runtime.prefixRegistry).toBeInstanceOf(SqlPrefixRegistry);
    expect(runtime.schemaVersionStore).toBeInstanceOf(SqlIndexMetaStore);
    expect(runtime.registryService).toBeInstanceOf(OntologyRegistryService);
    expect(runtime.activationHelper).toBeInstanceOf(OntologyPackActivationHelper);

    const result = await runtime.activationHelper.activateOntologyPack(validPack, {
      ontologyId: "authz-runtime",
      namespace: "authz",
      owner: "registry-service",
      versionId: "v1",
      timestamp: "2026-04-15T00:00:00.000Z",
    });

    expect(result.status).toBe("succeeded");
    await expect(
      runtime.ontologyStore.getAllocation(
        "authz-runtime:authorization-resource:v1",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v1",
        prefix: "authz_authorization_resource",
        status: "active",
      }),
    );
    await expect(
      runtime.prefixRegistry.getRecord("authz_authorization_resource", "v1"),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_resource",
        versionId: "v1",
        capacity: 8,
      }),
    );
    await expect(
      runtime.schemaVersionStore.getSchemaVersion(
        "authz_authorization_resource",
        "v1",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_resource",
        versionId: "v1",
        capacity: 8,
      }),
    );
  });

  it("uses the provided store path as persistent local SQLite state", async () => {
    const storePath = await createNestedSqlitePath();
    const firstRuntime = await createTrackedRuntime({ storePath });

    await firstRuntime.activationHelper.activateOntologyPack(validPack, {
      ontologyId: "authz-runtime",
      namespace: "authz",
      versionId: "v2",
      timestamp: "2026-04-15T00:00:00.000Z",
    });
    closeRuntime(firstRuntime);

    const reopenedRuntime = await createTrackedRuntime({ storePath });

    expect(reopenedRuntime.storePath).toBe(resolve(storePath));
    await expect(
      reopenedRuntime.ontologyStore.getAllocation(
        "authz-runtime:authorization-resource:v2",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        allocationId: "authz-runtime:authorization-resource:v2",
        status: "active",
      }),
    );
    await expect(
      reopenedRuntime.prefixRegistry.getRecord(
        "authz_authorization_resource",
        "v2",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_resource",
        versionId: "v2",
        capacity: 8,
      }),
    );
    await expect(
      reopenedRuntime.schemaVersionStore.getSchemaVersion(
        "authz_authorization_resource",
        "v2",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        prefix: "authz_authorization_resource",
        versionId: "v2",
        capacity: 8,
      }),
    );
  });

  it("normalizes absent and explicit memory store paths for test runtimes", () => {
    expect(resolveLocalOntologyActivationStorePath()).toBe(
      LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE,
    );
    expect(
      resolveLocalOntologyActivationStorePath(
        LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE,
      ),
    ).toBe(LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE);
    expect(resolveLocalOntologyActivationStorePath("local.sqlite")).toBe(
      resolve("local.sqlite"),
    );
  });
});

async function createTrackedRuntime(
  options?: Parameters<typeof createLocalOntologyActivationRuntime>[0],
): Promise<LocalOntologyActivationRuntime> {
  const runtime = await createLocalOntologyActivationRuntime(options);
  activeRuntimes.push(runtime);
  return runtime;
}

function closeRuntime(runtime: LocalOntologyActivationRuntime): void {
  const index = activeRuntimes.indexOf(runtime);
  if (index >= 0) {
    activeRuntimes.splice(index, 1);
  }
  runtime.close();
}

async function createNestedSqlitePath(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "ontology-local-runtime-"));
  tempDirs.push(tempDir);
  return join(tempDir, "nested", "registry.sqlite");
}
