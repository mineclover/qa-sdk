// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable } from "@nestjs/common";
import { REGISTRY_SERVICE } from "../../registry-core.module.js";
import { RegistryService } from "../../lib/registry-service.js";
import { analyze, simulate } from "../../lib/draft-workspace.js";
import { simulateSchema } from "../../schemas/workspace.js";

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(REGISTRY_SERVICE) private readonly registry: RegistryService,
  ) {}

  listDrafts() {
    return this.registry.getAllDrafts();
  }

  simulate(input: unknown) {
    const body = simulateSchema.parse(input);
    return simulate(
      this.registry.prefixRegistry,
      this.registry.ownerStore,
      this.registry.versionStore,
      body.changes,
    );
  }

  analyze() {
    return analyze(
      this.registry.prefixRegistry,
      this.registry.versionStore,
      this.registry.ownerStore,
      (prefix, versionId) => this.registry.isLocked(prefix, versionId),
    );
  }

  lockAll() {
    return this.registry.lockAll();
  }

  releaseAll() {
    return this.registry.releaseAll();
  }
}
