// @def.boundary sim-auth-api
// spec §9 Stage 3 — BitmapVersionModule.
//
// 시뮬용 prefix version 관리 module. Service는 process-scoped singleton + controller
// 노출. 외부 module이 service를 import할 일 없으므로 export 두지 않음 (캡슐화).
import { Module } from "@nestjs/common";
import { AdminBitmapVersionController } from "./admin-bitmap-version.controller.js";
import { BitmapVersionService } from "./bitmap-version.service.js";

@Module({
  controllers: [AdminBitmapVersionController],
  providers: [BitmapVersionService],
})
export class BitmapVersionModule {}
