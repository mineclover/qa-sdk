import { Module } from "@nestjs/common";
import { SqlIndexMetaStore, SqlPrefixRegistry, type SqlDriver } from "index-meta";
import { DATABASE } from "../../database.module.js";
import { SqlOntologyRegistryStore } from "../../stores/sql-ontology-registry-store.js";
import type { OntologyRegistryStore } from "../../stores/ontology-registry-store.js";
import {
  createOntologyIndexMetaSyncAdapter,
  type OntologyIndexMetaSyncAdapter,
} from "./index-meta-sync.adapter.js";
import { OntologyRegistryService } from "./ontology-registry.service.js";

export const ONTOLOGY_REGISTRY_STORE = "ONTOLOGY_REGISTRY_STORE";
export const ONTOLOGY_INDEX_META_SYNC_ADAPTER =
  "ONTOLOGY_INDEX_META_SYNC_ADAPTER";

@Module({
  providers: [
    {
      provide: ONTOLOGY_REGISTRY_STORE,
      useFactory: (db: SqlDriver): OntologyRegistryStore =>
        new SqlOntologyRegistryStore(db),
      inject: [DATABASE],
    },
    {
      provide: ONTOLOGY_INDEX_META_SYNC_ADAPTER,
      useFactory: (db: SqlDriver): OntologyIndexMetaSyncAdapter =>
        createOntologyIndexMetaSyncAdapter({
          prefixRegistry: new SqlPrefixRegistry(db),
          schemaVersionStore: new SqlIndexMetaStore(db),
        }),
      inject: [DATABASE],
    },
    {
      provide: OntologyRegistryService,
      useFactory: (
        ontologyStore: OntologyRegistryStore,
        syncAdapter: OntologyIndexMetaSyncAdapter,
      ) => new OntologyRegistryService({ store: ontologyStore, syncAdapter }),
      inject: [ONTOLOGY_REGISTRY_STORE, ONTOLOGY_INDEX_META_SYNC_ADAPTER],
    },
  ],
  exports: [
    OntologyRegistryService,
    ONTOLOGY_REGISTRY_STORE,
    ONTOLOGY_INDEX_META_SYNC_ADAPTER,
  ],
})
export class OntologyModule {}
