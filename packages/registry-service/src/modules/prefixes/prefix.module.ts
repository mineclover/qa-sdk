// @def.boundary registry-system
// @def.doc registry-system

import { Module } from '@nestjs/common';
import { PrefixController } from './prefix.controller.js';
import { PrefixService } from './prefix.service.js';

@Module({
  controllers: [PrefixController],
  providers: [PrefixService],
  exports: [PrefixService],
})
export class PrefixModule {}
