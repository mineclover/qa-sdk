// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";
import { assertNoTraversal } from "../lib/validation.js";

/** export 명령 — scripts/export.ts에 위임 */
export const exportHandler: CommandHandler = async (ctx) => {
  // --out 플래그 처리
  if (ctx.options.out) {
    const outPath = ctx.options.out as string;
    assertNoTraversal(outPath);
    process.env.INFRA_EXPORT_OUT = outPath;
  }
  process.argv = [process.argv[0], "export.ts", ...ctx.rawArgs];
  await import("../../scripts/export.js");
};
