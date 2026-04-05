// 타입
export type {
  CliCommandNode,
  CommandHandler,
  CommandContext,
  ArgDef,
  OptionDef,
  ResolvedCommand,
  CommandUsageSpec,
  CommandDetailOptionSpec,
  CommandDetailSpec,
  CommandHelpSectionSpec,
} from "./types.js";

// 신규 API
export { resolveCommand } from "./resolve.js";
export { executeCommand, type ExecuteOptions } from "./execute.js";
export { parseCommandArgs } from "./parse.js";
export { generateHelp } from "./help.js";
export { composeTree } from "./compose.js";

// 기존 호환 API (@deprecated)
export { resolveCliTreeCommand } from "./resolve.js";
export {
  collectCommandUsageSpecs,
  formatUsageLines,
  formatUsageSpecs,
  formatCommandDetailBlocks,
  formatHelpSections,
} from "./help.js";
