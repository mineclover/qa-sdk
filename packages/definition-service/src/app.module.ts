import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { HealthController } from "./health.controller.js";
import { AxisRegistry } from "./core/axis-registry.js";
import { env } from "./config/env.js";
import { PrefixesModule } from "./modules/prefixes/prefixes.module.js";
import { DocsModule } from "./modules/docs/docs.module.js";
import { IntentsModule } from "./modules/intents/intents.module.js";
import { ConsumptionModule } from "./modules/consumption/consumption.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { GraphModule } from "./modules/graph/graph.module.js";
import { TestsModule } from "./modules/tests/tests.module.js";

export const AXIS_REGISTRY = "AXIS_REGISTRY";

@Module({
  imports: [
    DatabaseModule,
    PrefixesModule,
    DocsModule,
    IntentsModule,
    ConsumptionModule,
    SyncModule,
    GraphModule,
    TestsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: AXIS_REGISTRY,
      useFactory: () => new AxisRegistry(env.REGISTRY_URL, "definition"),
    },
  ],
  exports: [AXIS_REGISTRY],
})
export class AppModule {}
