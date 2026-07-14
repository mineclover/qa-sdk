// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable } from '@nestjs/common';
import { REGISTRY_SERVICE } from '../../registry-core.module.js';
import { RegistryService } from '../../lib/registry-service.js';

@Injectable()
export class DagService {
  constructor(@Inject(REGISTRY_SERVICE) private readonly registry: RegistryService) {}

  getDeps(prefix: string, versionId: string) {
    return this.registry.getDeps(prefix, versionId);
  }

  getTransitiveDeps(prefix: string, versionId: string) {
    return this.registry.getTransitiveDeps(prefix, versionId);
  }

  getReverseRefs(prefix: string, versionId: string) {
    return this.registry.getReverseRefs(prefix, versionId);
  }

  getGraph() {
    return this.registry.getDagGraph();
  }
}
