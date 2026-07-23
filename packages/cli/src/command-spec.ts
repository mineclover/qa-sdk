// @def.boundary docs-control-plane
// @def.doc docs-control-plane

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
} from 'cli-command';

export type RestCommandHandler = (rest: string[]) => Promise<void> | void;

export {
  executeCommand,
  generateHelp,
  descriptorsToTree,
  resolveCliTreeCommand,
  collectCommandUsageSpecs,
  formatUsageLines,
  formatUsageSpecs,
  formatHelpSections,
} from 'cli-command';
