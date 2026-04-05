import type { CommandHandler } from "cli-command";

/** export 명령 — scripts/export.ts에 위임 */
export const exportHandler: CommandHandler = async (ctx) => {
  // --out 플래그 처리
  if (ctx.options.out) {
    process.env.INFRA_EXPORT_OUT = ctx.options.out as string;
  }
  process.argv = [process.argv[0], "export.ts", ...ctx.rawArgs];
  await import("../../scripts/export.js");
};
