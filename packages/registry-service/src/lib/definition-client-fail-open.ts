// @def.boundary registry-system
// @def.doc registry-system

import { createLogger } from "./logger.js";

const logger = createLogger("registry-service");

export interface DefinitionClientCallOptions {
  /** 서버 시작 시 외부 호출에는 5초 timeout 적용 (CLAUDE.md 규칙) */
  timeoutMs?: number;
}

export async function runDefinitionClientCall<T>(
  action: string,
  run: () => Promise<T>,
  options?: DefinitionClientCallOptions,
): Promise<T | undefined> {
  try {
    if (options?.timeoutMs) {
      return await Promise.race([
        run(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`definition-service ${action} timed out after ${options.timeoutMs}ms`)), options.timeoutMs),
        ),
      ]);
    }
    return await run();
  } catch (error) {
    logger.warn({ action, err: error }, "definition-service call skipped");
    return undefined;
  }
}
