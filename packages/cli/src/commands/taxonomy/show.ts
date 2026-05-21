import { readFileSync } from "node:fs";
import { parse, show, TaxonomyRegistry } from "taxonomy-engine";
import type { RefResult } from "taxonomy-engine";
import { loadRegistryDir, extractRegistryDir, filterRegistryArgs } from "./shared.js";

function runShowOnRegistry(reg: TaxonomyRegistry, ref: string, json: boolean): void {
  let result: RefResult | undefined;
  try {
    result = show(ref, reg);
  } catch (e) {
    console.error(`ref 형식 오류: ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  if (!result) {
    console.error(`해소 실패: ${ref}`);
    process.exit(1);
    return;
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printShowResult(result);
}

export function showCmd(args: string[]): void {
  const json = args.includes("--json");
  const registryDir = extractRegistryDir(args);
  const filteredArgs = filterRegistryArgs(args);
  const positional = filteredArgs.filter((a) => !a.startsWith("--"));

  // registryDir 있으면 file 없어도 OK (registry로 충분)
  if (registryDir) {
    if (positional.length < 1) {
      console.error("사용법: qa-sdk tax show <ref> --registry <dir>");
      process.exit(1);
      return;
    }
    const ref = positional[0];
    const reg = loadRegistryDir(registryDir);
    runShowOnRegistry(reg, ref, json);
    return;
  }

  // 기존: file + ref
  if (positional.length < 2) {
    console.error("사용법: qa-sdk tax show <file> <ref> [--json]  또는  qa-sdk tax show <ref> --registry <dir>");
    process.exit(1);
    return;
  }
  const [file, ref] = positional;

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`파일 읽기 실패: ${file} — ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const parsed = parse(text);
  if ("error" in parsed) {
    console.error(`parse 실패: ${parsed.error.message}`);
    process.exit(1);
    return;
  }

  const reg = new TaxonomyRegistry();
  reg.add(parsed.ir);
  runShowOnRegistry(reg, ref, json);
}

function printShowResult(result: RefResult): void {
  console.log(`kind: ${result.kind}`);
  switch (result.kind) {
    case "entry": {
      const entry = result.entry as {
        id: string;
        address: number;
        label?: string;
        lifecycle?: string;
        placeholderReason?: string;
        decisionLink?: string;
      };
      console.log(`id:        ${entry.id}`);
      console.log(`address:   ${entry.address}`);
      if (entry.label) console.log(`label:     ${entry.label}`);
      if (entry.lifecycle) console.log(`lifecycle: ${entry.lifecycle}`);
      if (entry.placeholderReason) console.log(`reason:    ${entry.placeholderReason}`);
      if (entry.decisionLink) console.log(`decision:  ${entry.decisionLink}`);
      break;
    }
    case "axis": {
      const axis = result.axis as {
        name: string;
        entries?: Array<{ id: string; address: number }>;
        capacity: number;
        lifecycle?: string;
      };
      console.log(`name:      ${axis.name}`);
      if (axis.entries) {
        console.log(`entries:   ${axis.entries.length} (${axis.entries.map((e) => e.id).join(", ")})`);
      }
      console.log(`capacity:  ${axis.capacity}`);
      if (axis.lifecycle) console.log(`lifecycle: ${axis.lifecycle}`);
      break;
    }
    case "coordinate": {
      const coord = result.coord as Record<string, string>;
      const addresses = result.addresses as number[];
      console.log(`coord:     ${JSON.stringify(coord)}`);
      console.log(`addresses: [${addresses.join(", ")}]`);
      break;
    }
    case "taxonomy": {
      const ir = result.ir as { taxonomy: string; version: number; axes?: Map<string, unknown> };
      console.log(`name:    ${ir.taxonomy}`);
      console.log(`version: ${ir.version}`);
      if (ir.axes) {
        console.log(`axes:    ${ir.axes.size}`);
      }
      break;
    }
    default:
      console.log(JSON.stringify(result, null, 2));
  }
}
