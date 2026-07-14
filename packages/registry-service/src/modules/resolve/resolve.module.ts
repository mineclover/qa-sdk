// @def.boundary registry-system
// @def.doc registry-system

import { Module } from '@nestjs/common';
import { ManifestModule } from '../manifests/manifest.module.js';
import { ServiceModule } from '../services/service.module.js';
import { ResolveController } from './resolve.controller.js';
import { ResolveService } from './resolve.service.js';

@Module({
  imports: [ManifestModule, ServiceModule],
  controllers: [ResolveController],
  providers: [ResolveService],
  exports: [ResolveService],
})
export class ResolveModule {}
