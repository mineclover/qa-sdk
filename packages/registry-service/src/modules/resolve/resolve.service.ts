import { Inject, Injectable } from "@nestjs/common";
import { REGISTRY_SERVICE } from "../../registry-core.module.js";
import { RegistryService } from "../../lib/registry-service.js";

@Injectable()
export class ResolveService {
  constructor(
    @Inject(REGISTRY_SERVICE) private readonly registry: RegistryService,
  ) {}

  resolveAllActive() {
    return this.registry.resolveAllActive();
  }

  getActive(prefix: string) {
    return this.registry.getActiveEnriched(prefix);
  }

  resolveManifest() {
    return this.registry.resolveManifest();
  }

  inspectMeta(prefix: string, versionId: string) {
    return this.registry.inspectMeta(prefix, versionId);
  }

  inspectKeys(prefix: string, versionId: string) {
    return this.registry.inspectKeys(prefix, versionId);
  }

  inspectValue(prefix: string, versionId: string, address: number) {
    return this.registry.inspectValue(prefix, versionId, address);
  }
}
