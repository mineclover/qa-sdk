// @def.boundary registry-system
// @def.doc registry-system

import { Injectable } from '@nestjs/common';
import type { Logger } from 'pino';
import { env } from '../../config/env.js';
import { createLogger } from '../../lib/logger.js';
import { createPostActivationHook } from '../../lib/post-activation-hook.js';
import type { PostActivationHookPort } from '../../lib/registry-service.js';
import type { StoreModulePort } from '../../types/spec-core-ports.js';

export interface BuildPostActivationHookOptions {
  enabled?: boolean;
  dkgPath?: string;
  logger?: Logger;
  loadStoreModule?: () => Promise<StoreModulePort>;
}

export async function buildPostActivationHookPort(
  options: BuildPostActivationHookOptions = {},
): Promise<PostActivationHookPort | undefined> {
  const enabled = options.enabled ?? env.POST_ACTIVATION_HOOK_ENABLED;
  if (!enabled) return undefined;

  try {
    const storeModule = await (
      options.loadStoreModule ??
      (async () => import('@qa-sdk/spec-core/store') as unknown as StoreModulePort)
    )();

    const dkgPath = options.dkgPath ?? env.POST_ACTIVATION_DKG_PATH;
    const dkgStore = dkgPath ? new storeModule.DkgSqliteStore(dkgPath) : undefined;

    const hook = createPostActivationHook({
      dkgStore,
      logger: options.logger,
    });

    options.logger?.info('post-activation hook enabled');
    return hook;
  } catch (error) {
    options.logger?.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to initialize post-activation hook — hook disabled',
    );
    return undefined;
  }
}

@Injectable()
export class PostActivationHookService {
  private readonly logger = createLogger('registry-service');

  createPort() {
    return buildPostActivationHookPort({ logger: this.logger });
  }
}
