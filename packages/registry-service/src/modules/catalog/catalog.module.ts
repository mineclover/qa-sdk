import { Module } from "@nestjs/common";
import type { SqlDriver } from "index-meta";
import { DATABASE } from "../../database.module.js";
import { SqlCatalogStore } from "../../stores/sql-catalog-store.js";
import { SqlConfigStore } from "../../stores/sql-config-store.js";
import { CatalogChangeNotifier } from "./catalog.change-notifier.js";
import { DecodeMapController } from "./decode-map.controller.js";
import { DecodeMapService } from "./decode-map.service.js";
import { CatalogController } from "./catalog.controller.js";
import {
  CATALOG_CHANGE_HANDLER,
  CATALOG_STORE,
  CONFIG_STORE,
  CatalogService,
} from "./catalog.service.js";

@Module({
  controllers: [CatalogController, DecodeMapController],
  providers: [
    CatalogChangeNotifier,
    {
      provide: CATALOG_STORE,
      useFactory: (db: SqlDriver) => new SqlCatalogStore(db),
      inject: [DATABASE],
    },
    {
      provide: CONFIG_STORE,
      useFactory: (db: SqlDriver) => new SqlConfigStore(db),
      inject: [DATABASE],
    },
    {
      provide: CATALOG_CHANGE_HANDLER,
      useExisting: CatalogChangeNotifier,
    },
    CatalogService,
    DecodeMapService,
  ],
  exports: [CatalogService, DecodeMapService, CATALOG_STORE, CONFIG_STORE],
})
export class CatalogModule {}
