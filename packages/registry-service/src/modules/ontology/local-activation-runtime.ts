// @def.boundary registry-system
// @def.doc registry-system

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  SqlIndexMetaStore,
  SqlPrefixRegistry,
  type NodeSqliteDriver,
} from "index-meta";

import { createRegistryDatabaseDriver } from "../../bootstrap/stores.js";
import { SqlOntologyRegistryStore } from "../../stores/sql-ontology-registry-store.js";
import {
  createOntologyIndexMetaSyncAdapter,
  type OntologyIndexMetaSyncAdapter,
} from "./index-meta-sync.adapter.js";
import { OntologyPackActivationHelper } from "./ontology-activation.helper.js";
import { OntologyRegistryService } from "./ontology-registry.service.js";

export const LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE = ":memory:";

export interface LocalOntologyActivationRuntimeOptions {
  readonly storePath?: string;
}

export interface LocalOntologyActivationRuntime {
  readonly storePath: string;
  readonly driver: NodeSqliteDriver;
  readonly ontologyStore: SqlOntologyRegistryStore;
  readonly prefixRegistry: SqlPrefixRegistry;
  readonly schemaVersionStore: SqlIndexMetaStore;
  readonly syncAdapter: OntologyIndexMetaSyncAdapter;
  readonly registryService: OntologyRegistryService;
  readonly activationHelper: OntologyPackActivationHelper;
  close(): void;
}

export function resolveLocalOntologyActivationStorePath(
  storePath?: string,
): string {
  if (!storePath || storePath === LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE) {
    return LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE;
  }
  return resolve(storePath);
}

export async function createLocalOntologyActivationRuntime(
  options: LocalOntologyActivationRuntimeOptions = {},
): Promise<LocalOntologyActivationRuntime> {
  const storePath = resolveLocalOntologyActivationStorePath(options.storePath);
  if (storePath !== LOCAL_ONTOLOGY_ACTIVATION_MEMORY_STORE) {
    await mkdir(dirname(storePath), { recursive: true });
  }

  const driver = await createRegistryDatabaseDriver(storePath);
  const ontologyStore = new SqlOntologyRegistryStore(driver);
  const prefixRegistry = new SqlPrefixRegistry(driver);
  const schemaVersionStore = new SqlIndexMetaStore(driver);
  const syncAdapter = createOntologyIndexMetaSyncAdapter({
    prefixRegistry,
    schemaVersionStore,
  });
  const registryService = new OntologyRegistryService({
    store: ontologyStore,
    syncAdapter,
  });
  const activationHelper = new OntologyPackActivationHelper(registryService);
  let closed = false;

  return {
    storePath,
    driver,
    ontologyStore,
    prefixRegistry,
    schemaVersionStore,
    syncAdapter,
    registryService,
    activationHelper,
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      driver.close();
    },
  };
}
