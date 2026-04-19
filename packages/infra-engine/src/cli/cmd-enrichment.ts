// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";

/** enrichment start -- enrichment 서버 시작 */
export const enrichmentStartHandler: CommandHandler = async (_ctx) => {
  const { startServer } = await import("../auth/enrichment-server.js");
  startServer();
};

/** enrichment setup -- Zitadel Action + metadata 설정 */
export const enrichmentSetupHandler: CommandHandler = async (_ctx) => {
  // setup-zitadel-action.ts를 동적 import로 실행
  await import("../../scripts/setup-zitadel-action.js");
};
