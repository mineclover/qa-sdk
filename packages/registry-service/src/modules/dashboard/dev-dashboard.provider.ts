// @def.boundary registry-system
// @def.doc registry-system

import type { Logger } from "pino";
import { env } from "../../config/env.js";
import type { DevDkgProvider } from "../../lib/dev-dkg-provider.js";

export async function buildDevDashboardProvider(options: {
  logger: Logger;
  enabled?: boolean;
  dkgPath?: string;
}) : Promise<DevDkgProvider | undefined> {
  const enabled = options.enabled ?? env.DEV_DASHBOARD_ENABLED;
  if (!enabled) return undefined;

  try {
    const { createDevDkgProvider } = await import("../../lib/dev-dkg-provider.js");
    const provider = await createDevDkgProvider({
      dkgSqlitePath: options.dkgPath ?? env.DEV_DASHBOARD_DKG_PATH,
      logger: options.logger,
    });
    options.logger.info("dev dashboard enabled at /dev/");
    return provider;
  } catch (error) {
    options.logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to initialize dev dashboard — disabled",
    );
    return undefined;
  }
}
