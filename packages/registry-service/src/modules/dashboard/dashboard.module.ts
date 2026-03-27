import { Global, Module } from "@nestjs/common";
import { createLogger } from "../../lib/logger.js";
import { DEV_DKG_PROVIDER } from "../catalog/catalog.change-notifier.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { buildDevDashboardProvider } from "./dev-dashboard.provider.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";
import { DevDashboardGateway } from "./dev-dashboard.gateway.js";
import { DiagramController } from "./diagram.controller.js";
import { DiagramService } from "./diagram.service.js";

const logger = createLogger("registry-service");

@Global()
@Module({
  imports: [CatalogModule],
  controllers: [DiagramController, DashboardController],
  providers: [
    {
      provide: DEV_DKG_PROVIDER,
      useFactory: async () => buildDevDashboardProvider({ logger }),
    },
    {
      provide: DashboardService,
      useFactory: (provider: unknown, catalogService: CatalogService) => DashboardService.fromDeps({
        provider: provider as import("../../lib/dev-dkg-provider.js").DevDkgProvider | undefined,
        listCatalogs: async () => (await catalogService.list()).map((catalog) => ({
          id: catalog.id,
          name: catalog.name,
        })),
      }),
      inject: [DEV_DKG_PROVIDER, CatalogService],
    },
    {
      provide: DiagramService,
      useFactory: (provider: unknown) => DiagramService.fromDeps({
        provider: provider as import("../../lib/dev-dkg-provider.js").DevDkgProvider | undefined,
      }),
      inject: [DEV_DKG_PROVIDER],
    },
    DevDashboardGateway,
  ],
  exports: [DEV_DKG_PROVIDER, DashboardService, DiagramService],
})
export class DashboardModule {}
