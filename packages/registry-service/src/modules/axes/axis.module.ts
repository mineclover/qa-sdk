import { Module } from "@nestjs/common";
import type { SqlDriver } from "index-meta";
import { DATABASE } from "../../database.module.js";
import { SqlAxisProfileStore } from "../../stores/sql-axis-profile-store.js";
import { AxisChangeNotifier } from "./axis.change-notifier.js";
import { AxisController } from "./axis.controller.js";
import {
  AXIS_CHANGE_HANDLER,
  AXIS_STORE,
  AxisService,
} from "./axis.service.js";

@Module({
  controllers: [AxisController],
  providers: [
    AxisChangeNotifier,
    {
      provide: AXIS_STORE,
      useFactory: (db: SqlDriver) => new SqlAxisProfileStore(db),
      inject: [DATABASE],
    },
    {
      provide: AXIS_CHANGE_HANDLER,
      useExisting: AxisChangeNotifier,
    },
    AxisService,
  ],
  exports: [AxisService, AXIS_STORE],
})
export class AxisModule {}
