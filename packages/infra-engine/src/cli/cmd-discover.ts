// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";

/** discover 명령 — scripts/discover.ts에 위임 */
export const discoverHandler: CommandHandler = async (ctx) => {
  process.argv = [process.argv[0], "discover.ts", ...ctx.rawArgs];
  await import("../../scripts/discover.js");
};
