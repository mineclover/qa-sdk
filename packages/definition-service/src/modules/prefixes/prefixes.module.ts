import { Module } from "@nestjs/common";
import { PrefixesController } from "./prefixes.controller.js";
import { PrefixesService } from "./prefixes.service.js";

@Module({
  controllers: [PrefixesController],
  providers: [PrefixesService],
  exports: [PrefixesService],
})
export class PrefixesModule {}
