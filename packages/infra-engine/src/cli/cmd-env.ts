// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const infraEngineCwd = dirname(fileURLToPath(import.meta.url)).replace(/\/src\/cli$/, '');

/** env up — 로컬 인프라 환경 시작 */
export const envUpHandler: CommandHandler = async (_ctx) => {
  const { envUp } = await import('../commands/env-manager.js');
  await envUp(infraEngineCwd);
};

/** env down — 로컬 인프라 환경 종료 */
export const envDownHandler: CommandHandler = async (_ctx) => {
  const { envDown } = await import('../commands/env-manager.js');
  await envDown(infraEngineCwd);
};

/** env status — 환경 상태 */
export const envStatusHandler: CommandHandler = async (_ctx) => {
  const { envStatus } = await import('../commands/env-manager.js');
  await envStatus();
};

/** env reset — 환경 초기화 */
export const envResetHandler: CommandHandler = async (_ctx) => {
  const { envReset } = await import('../commands/env-manager.js');
  await envReset(infraEngineCwd);
};
