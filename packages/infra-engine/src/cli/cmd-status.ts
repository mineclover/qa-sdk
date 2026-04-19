// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";

/** status 명령 — export status에 위임 */
export const statusHandler: CommandHandler = async (ctx) => {
  process.argv = [process.argv[0], "export.ts", "status", ...ctx.rawArgs];
  await import("../../scripts/export.js");
};
