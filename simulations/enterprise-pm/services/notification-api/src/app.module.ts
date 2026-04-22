// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { NotificationDbModule } from "./notification/notification-db.module.js";
import { NotificationModule } from "./notification/notification/notification.module.js";
import { SubscriptionModule } from "./notification/subscription/subscription.module.js";

@Module({
  imports: [
    HealthModule,
    NotificationDbModule.forRoot(),
    NotificationModule,
    SubscriptionModule,
  ],
})
export class AppModule {}
