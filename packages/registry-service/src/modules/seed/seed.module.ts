import { Module } from "@nestjs/common";
import { AxisModule } from "../axes/axis.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { EventModule } from "../events/event.module.js";
import { ServiceModule } from "../services/service.module.js";
import { SeedService } from "./seed.service.js";

@Module({
  imports: [CatalogModule, AxisModule, ServiceModule, EventModule],
  providers: [SeedService],
})
export class SeedModule {}
