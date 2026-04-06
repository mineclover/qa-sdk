import type { CliCommandNode, CommandUsageSpec, CommandDetailSpec, CommandHelpSectionSpec } from "./types.js";

/**
 * 트리에서 자동으로 help 텍스트를 생성한다.
 */
export function generateHelp(rootName: string, tree: readonly CliCommandNode[], node?: CliCommandNode): string {
  const lines: string[] = [];

  if (node) {
    // 특정 노드의 help
    lines.push(`${rootName} ${node.segment}${node.description ? ` — ${node.description}` : ""}`);
    if (node.usage) {
      lines.push("\n사용:");
      pushUsage(lines, "  ", node.usage, node.continuation);
    }

    if (node.args?.length) {
      lines.push("\n인자:");
      for (const a of node.args) {
        const req = a.required ? " (필수)" : "";
        lines.push(`  <${a.name}>${req}${a.description ? `  ${a.description}` : ""}`);
      }
    }

    if (node.options?.length) {
      lines.push("\n옵션:");
      for (const o of node.options) {
        const short = o.short ? `, ${o.short}` : "";
        const hint = o.valueHint ? ` ${o.valueHint}` : o.type === "string" ? " <value>" : "";
        const def = o.default !== undefined ? ` (기본: ${o.default})` : "";
        const choices = o.choices ? ` [${o.choices.join("|")}]` : "";
        lines.push(`  ${o.flag}${short}${hint}${choices}${def}  ${o.description ?? ""}`);
      }
    }

    if (node.children?.length) {
      lines.push("\n서브커맨드:");
      for (const c of node.children) {
        lines.push(`  ${c.segment.padEnd(20)} ${c.description ?? c.usage ?? ""}`);
      }
    }
  } else {
    // 전체 트리 help
    lines.push(`${rootName}\n`);
    lines.push("사용:");
    for (const c of tree) {
      printTree(lines, rootName, c, 0);
    }
  }

  return lines.join("\n");
}

function printTree(lines: string[], prefix: string, node: CliCommandNode, depth: number): void {
  const indent = "  ".repeat(depth + 1);
  const desc = node.description ?? "";
  const hasHandler = !!(node.handler || node.handlerKey || node.usage);

  if (hasHandler) {
    if (node.usage) {
      pushUsage(lines, indent, node.usage, node.continuation);
    } else {
      lines.push(`${indent}${prefix} ${node.segment}  ${desc}`);
    }
  } else if (node.children?.length) {
    lines.push(`${indent}${node.segment}:`);
  }

  for (const child of node.children ?? []) {
    printTree(lines, `${prefix} ${node.segment}`, child, depth + 1);
  }
}

function pushUsage(
  lines: string[],
  indent: string,
  usage: string,
  continuation?: readonly string[],
): void {
  lines.push(`${indent}${usage}`);
  for (const line of continuation ?? []) {
    lines.push(`${indent}  ${line}`);
  }
}

// ── 기존 호환 함수 ──

/** @deprecated generateHelp 사용 권장 */
export function collectCommandUsageSpecs(
  rootSegments: readonly string[],
  nodes: readonly CliCommandNode[],
): CommandUsageSpec[] {
  const specs: CommandUsageSpec[] = [];
  function visit(prefix: readonly string[], node: CliCommandNode): void {
    const path = [...prefix, node.segment];
    if (node.usage) {
      specs.push({ name: path.join(" "), usage: node.usage, continuation: node.continuation });
    }
    for (const child of node.children ?? []) visit(path, child);
  }
  for (const node of nodes) visit(rootSegments, node);
  return specs;
}

/** @deprecated */
export function formatUsageLines(lines: readonly string[]): string {
  return lines.map((line) => `  ${line}`).join("\n");
}

/** @deprecated */
export function formatUsageSpecs(specs: readonly CommandUsageSpec[]): string {
  return specs
    .map((spec) => {
      const base = `  ${spec.usage}`;
      const cont = (spec.continuation ?? []).map((l) => `    ${l}`).join("\n");
      return cont ? `${base}\n${cont}` : base;
    })
    .join("\n");
}

/** @deprecated */
export function formatCommandDetailBlocks(specs: readonly CommandDetailSpec[]): string {
  return specs
    .map((spec) => {
      const optLines = spec.options
        .map((o) => {
          const flag = o.valueHint ? `${o.flag} ${o.valueHint}` : o.flag;
          return `    ${flag.padEnd(22)} ${o.description}`;
        })
        .join("\n");
      return `  ${spec.command}\n${optLines}`;
    })
    .join("\n\n");
}

/** @deprecated */
export function formatHelpSections(sections: readonly CommandHelpSectionSpec[]): string {
  return sections
    .map((s) => `${s.title}:\n${s.lines.map((l) => `  ${l}`).join("\n")}`)
    .join("\n\n");
}
