import { Module } from "@nestjs/common";
import { getServiceDevUrl } from "@qa-sdk/core";
import { DefinitionModule } from "@qa-sdk/definition-client/nestjs";
import { DatabaseModule } from "./database.module.js";
import { RegistryCoreModule } from "./registry-core.module.js";
import { HealthController } from "./health.controller.js";
import { AxisModule } from "./modules/axes/axis.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { DagModule } from "./modules/dag/dag.module.js";
import { DashboardModule } from "./modules/dashboard/dashboard.module.js";
import { EventModule } from "./modules/events/event.module.js";
import { MetricsModule } from "./modules/metrics/metrics.module.js";
import { OntologyModule } from "./modules/ontology/ontology.module.js";
import { PrefixModule } from "./modules/prefixes/prefix.module.js";
import { ResolveModule } from "./modules/resolve/resolve.module.js";
import { SchemaModule } from "./modules/schema/schema.module.js";
import { ServiceModule } from "./modules/services/service.module.js";
import { VersionModule } from "./modules/versions/version.module.js";
import { WorkspaceModule } from "./modules/workspace/workspace.module.js";
import { ManifestModule } from "./modules/manifests/manifest.module.js";

const definitionServiceBaseUrl = getServiceDevUrl("definition-service") ?? "http://localhost:3700";

@Module({
  imports: [
    DefinitionModule.forRoot({ baseUrl: definitionServiceBaseUrl }),
    DatabaseModule,
    RegistryCoreModule,
    DashboardModule,
    PrefixModule,
    CatalogModule,
    AxisModule,
    VersionModule,
    WorkspaceModule,
    ManifestModule,
    DagModule,
    ResolveModule,
    SchemaModule,
    MetricsModule,
    OntologyModule,
    ServiceModule,
    EventModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
