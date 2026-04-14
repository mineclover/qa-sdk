import { Module } from "@nestjs/common";
import type { SqlDriver } from "index-meta";
import { DATABASE } from "../../database.module.js";
import { SqlOntologyRegistryStore } from "../../stores/sql-ontology-registry-store.js";
import type { OntologyRegistryStore } from "../../stores/ontology-registry-store.js";
import { OntologyRegistryService } from "./ontology-registry.service.js";

export const ONTOLOGY_REGISTRY_STORE = "ONTOLOGY_REGISTRY_STORE";

@Module({
  providers: [
    {
      provide: ONTOLOGY_REGISTRY_STORE,
      useFactory: (db: SqlDriver): OntologyRegistryStore =>
        new SqlOntologyRegistryStore(db),
      inject: [DATABASE],
    },
    {
      provide: OntologyRegistryService,
      useFactory: (ontologyStore: OntologyRegistryStore) =>
        new OntologyRegistryService({ store: ontologyStore }),
      inject: [ONTOLOGY_REGISTRY_STORE],
    },
  ],
  exports: [OntologyRegistryService, ONTOLOGY_REGISTRY_STORE],
})
export class OntologyModule {}
