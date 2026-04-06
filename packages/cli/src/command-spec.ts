export type {
  CliCommandNode,
  CommandDescriptor,
  CommandHandler,
  CommandContext,
  ArgDef,
  OptionDef,
  ResolvedCommand,
  CommandUsageSpec,
  CommandDetailOptionSpec,
  CommandDetailSpec,
  CommandHelpSectionSpec,
} from "cli-command";

export type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export {
  resolveCommand,
  executeCommand,
  parseCommandArgs,
  generateHelp,
  composeTree,
  descriptorsToTree,
  resolveCliTreeCommand,
  collectCommandUsageSpecs,
  formatUsageLines,
  formatUsageSpecs,
  formatCommandDetailBlocks,
  formatHelpSections,
} from "cli-command";
