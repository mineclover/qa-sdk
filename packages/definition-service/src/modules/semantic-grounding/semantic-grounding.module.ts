// @def.doc definition-service

import { Global, Module } from '@nestjs/common';
import { SemanticGroundingService } from './semantic-grounding.service.js';

@Global()
@Module({
  providers: [SemanticGroundingService],
  exports: [SemanticGroundingService],
})
export class SemanticGroundingModule {}
