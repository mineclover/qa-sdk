export type CommandUsageSpec<TName extends string = string> = {
  name: TName;
  usage: string;
};

export type CommandDetailOptionSpec = {
  flag: string;
  valueHint?: string;
  description: string;
};

export type CommandDetailSpec = {
  command: string;
  options: readonly CommandDetailOptionSpec[];
};

export type CommandHelpSectionSpec = {
  title: string;
  lines: readonly string[];
};

export function formatUsageLines(lines: readonly string[]): string {
  return lines.map((line) => `  ${line}`).join("\n");
}

export function formatCommandDetailBlocks(specs: readonly CommandDetailSpec[]): string {
  return specs
    .map((spec) => {
      const optionLines = spec.options
        .map((option) => {
          const flag = option.valueHint ? `${option.flag} ${option.valueHint}` : option.flag;
          return `    ${flag.padEnd(22)} ${option.description}`;
        })
        .join("\n");
      return `  ${spec.command}\n${optionLines}`;
    })
    .join("\n\n");
}

export function formatHelpSections(sections: readonly CommandHelpSectionSpec[]): string {
  return sections
    .map((section) => `${section.title}:\n${section.lines.map((line) => `  ${line}`).join("\n")}`)
    .join("\n\n");
}
