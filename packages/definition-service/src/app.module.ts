// @def.boundary definition-service-system
// @def.doc definition-service

import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { MercuriusDriver, type MercuriusDriverConfig } from "@nestjs/mercurius";
import { DatabaseModule } from "./database.module.js";
import { HealthController } from "./health.controller.js";
import { AxisRegistry } from "./core/axis-registry.js";
import { AXIS_REGISTRY } from "./core/tokens.js";
import { env } from "./config/env.js";
import { PrefixesModule } from "./modules/prefixes/prefixes.module.js";
import { DocsModule } from "./modules/docs/docs.module.js";
import { IntentsModule } from "./modules/intents/intents.module.js";
import { ConsumptionModule } from "./modules/consumption/consumption.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { GraphModule } from "./modules/graph/graph.module.js";
import { TestsModule } from "./modules/tests/tests.module.js";
import { DefinitionGraphQLModule } from "./modules/graphql/graphql.module.js";
import { SearchModule } from "./modules/search/search.module.js";
import { SemanticGroundingModule } from "./modules/semantic-grounding/semantic-grounding.module.js";

@Module({
  imports: [
    DatabaseModule,
    SemanticGroundingModule,
    SearchModule,
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: true,
      graphiql: true,
      path: "/graphql",
    }),
    PrefixesModule,
    DocsModule,
    IntentsModule,
    ConsumptionModule,
    SyncModule,
    GraphModule,
    TestsModule,
    DefinitionGraphQLModule,
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
