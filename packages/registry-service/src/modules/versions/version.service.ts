// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from "@nestjs/common";
import { DefinitionClient } from "@qa-sdk/definition-client";
import type { PrefixRegistry, VersionLifecycleStore } from "index-meta";
import {
  PREFIX_REGISTRY,
  VERSION_STORE,
  OWNER_STORE,
  LOCK_STORE,
} from "../../registry-core.module.js";
import { runDefinitionClientCall } from "../../lib/definition-client-fail-open.js";
import { RegistryService, type PostActivationHookPort } from "../../lib/registry-service.js";
import { createLogger } from "../../lib/logger.js";
import type { PatchDraftInput, CreateDraftInput } from "../../schemas/version.js";
import type { DraftLockStore } from "../../stores/draft-lock-store.js";
import type { PrefixOwnerStore } from "../../stores/prefix-owner-store.js";
import type { ActivationGatePort } from "../../lib/activation-gate-adapter.js";
import type { ExtendedVersionStatus } from "../../types/index.js";

export const ACTIVATION_GATE = "ACTIVATION_GATE";
export const POST_ACTIVATION_HOOK = "POST_ACTIVATION_HOOK";

const logger = createLogger("registry-service");

/**
 * VersionService는 공유 store를 inject받되, activationGate/postActivationHook이 필요하므로
 * 자체 RegistryService 인스턴스를 생성한다. store는 RegistryCoreModule의 싱글턴을 사용.
 */
@Injectable()
export class VersionService {
  private readonly registryService: RegistryService;

  constructor(
    @Inject(PREFIX_REGISTRY) prefixRegistry: PrefixRegistry,
    @Inject(VERSION_STORE) versionStore: VersionLifecycleStore,
    @Inject(OWNER_STORE) ownerStore: PrefixOwnerStore,
    @Inject(LOCK_STORE) lockStore: DraftLockStore,
    @Optional() @Inject(ACTIVATION_GATE) activationGate?: ActivationGatePort,
    @Optional() @Inject(POST_ACTIVATION_HOOK) postActivationHook?: PostActivationHookPort,
    @Optional() @Inject(DefinitionClient) private readonly definitionClient?: DefinitionClient,
  ) {
    this.registryService = new RegistryService({
      prefixRegistry,
      versionStore,
      ownerStore,
      lockStore,
      ...(activationGate ? { activationGate } : {}),
      ...(postActivationHook ? { postActivationHook } : {}),
    });
  }

  createDraft(prefix: string, input: CreateDraftInput) {
    return this.registryService.createDraft({ prefix, ...input });
  }

  listVersions(prefix: string, status?: ExtendedVersionStatus) {
    return this.registryService.listVersions(prefix, status);
  }

  getVersion(prefix: string, versionId: string) {
    return this.registryService.getVersion(prefix, versionId);
  }

  patchDraft(prefix: string, versionId: string, patch: PatchDraftInput) {
    return this.registryService.patchDraft(prefix, versionId, patch);
  }

  lockDraft(prefix: string, versionId: string) {
    return this.registryService.lockDraft(prefix, versionId);
  }

  unlockDraft(prefix: string, versionId: string) {
    return this.registryService.unlockDraft(prefix, versionId);
  }

  release(prefix: string, versionId: string) {
    return this.registryService.release(prefix, versionId);
  }

  async activate(prefix: string, versionId: string) {
    const result = await this.registryService.activate(prefix, versionId);
    const version = await this.registryService.getVersion(prefix, versionId);

    const recorded = await runDefinitionClientCall(
      `recordConsumption(${prefix}/${versionId})`,
      async () => this.definitionClient?.recordConsumption(prefix, {
        prefixVersion: versionId,
        totalSpace: version.capacity,
        observedAddresses: 0,
        dimStats: {},
      }),
    );

    if (recorded) {
      logger.info({
        prefix,
        versionId,
        totalSpace: version.capacity,
        consumptionRate: recorded.consumptionRate,
      }, "definition-service consumption snapshot recorded");
    }

    return result;
  }

  deprecate(prefix: string, versionId: string) {
    return this.registryService.deprecate(prefix, versionId);
  }
}
