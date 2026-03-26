import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module.js";
import { HealthController } from "./health.controller.js";
import { PrefixesModule } from "./modules/prefixes/prefixes.module.js";
import { DocsModule } from "./modules/docs/docs.module.js";
import { IntentsModule } from "./modules/intents/intents.module.js";
import { ConsumptionModule } from "./modules/consumption/consumption.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { GraphModule } from "./modules/graph/graph.module.js";
import { TestsModule } from "./modules/tests/tests.module.js";

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
})
export class AppModule {}
