import { Inject, Injectable } from "@nestjs/common";
import { REGISTRY_SERVICE } from "../../registry-core.module.js";
import { RegistryService } from "../../lib/registry-service.js";
import { createLogger } from "../../lib/logger.js";
import type { RegisterPrefixInput } from "../../schemas/prefix.js";
import type { PrefixProfilePatch } from "../../stores/prefix-owner-store.js";

const logger = createLogger("registry-service");

@Injectable()
export class PrefixService {
  constructor(
    @Inject(REGISTRY_SERVICE) private readonly registryService: RegistryService,
  ) {}

  register(input: RegisterPrefixInput) {
    return this.registryService.registerPrefix(input);
  }

  list() {
    return this.registryService.listPrefixes();
  }

  get(prefix: string) {
    return this.registryService.getPrefix(prefix);
  }

  listVersions(prefix: string) {
    return this.registryService.listVersions(prefix);
  }

  patch(prefix: string, patch: PrefixProfilePatch) {
    return this.registryService.patchPrefix(prefix, patch);
  }

  async deletePrefix(prefix: string) {
    await this.registryService.deletePrefix(prefix);
    logger.info({ prefix }, "prefix deleted; definition-service lifecycle log recorded");
  }

  remove(prefix: string) {
    return this.deletePrefix(prefix);
  }
}
