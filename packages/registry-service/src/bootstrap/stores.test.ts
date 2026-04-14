import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryOntologyRegistryStore } from "../stores/in-memory-ontology-registry-store.js";
import { SqlOntologyRegistryStore } from "../stores/sql-ontology-registry-store.js";
import { createRegistryStores } from "./stores.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("createRegistryStores", () => {
  it("returns an ontology store for :memory: stores", async () => {
    const stores = await createRegistryStores(":memory:");

    expect(stores.ontologyStore).toBeInstanceOf(InMemoryOntologyRegistryStore);
    expect(await stores.ontologyStore.listNamespaces()).toEqual([]);
  });

  it("returns an ontology store for SQL-backed stores", async () => {
    const stores = await createRegistryStores(await createSqlitePath());

    expect(stores.ontologyStore).toBeInstanceOf(SqlOntologyRegistryStore);
    expect(await stores.ontologyStore.listNamespaces()).toEqual([]);
  });
});

async function createSqlitePath(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "registry-stores-"));
  tempDirs.push(tempDir);
  return join(tempDir, "registry.sqlite");
}
