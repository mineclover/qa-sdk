import { Module } from "@nestjs/common";
import { ActivationGateService } from "./activation-gate.service.js";
import { PostActivationHookService } from "./post-activation-hook.service.js";
import { VersionController } from "./version.controller.js";
import {
  ACTIVATION_GATE,
  POST_ACTIVATION_HOOK,
  VersionService,
} from "./version.service.js";

@Module({
  controllers: [VersionController],
  providers: [
    ActivationGateService,
    PostActivationHookService,
    {
      provide: ACTIVATION_GATE,
      useFactory: (service: ActivationGateService) => service.createPort(),
      inject: [ActivationGateService],
    },
    {
      provide: POST_ACTIVATION_HOOK,
      useFactory: (service: PostActivationHookService) => service.createPort(),
      inject: [PostActivationHookService],
    },
    VersionService,
  ],
  exports: [VersionService],
})
export class VersionModule {}
