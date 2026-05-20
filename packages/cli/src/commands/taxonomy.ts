import { readFileSync } from "node:fs";
import { parse, validate, show, TaxonomyRegistry } from "taxonomy-engine";
import type { Diagnostic, RefResult } from "taxonomy-engine";

export async function cliTaxonomy(rest: string[]): Promise<void> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "validate":
      return validateCmd(args);
    case "show":
      return showCmd(args);
    case "help":
    case undefined:
      printHelp();
      return;
    default:
      console.error(`알 수 없는 tax 명령: ${sub}`);
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`qa-sdk tax — 텍소노미 yaml 검증/조회

사용법:
  qa-sdk tax validate <file> [--strict] [--json]
  qa-sdk tax show <file> <ref> [--json]
  qa-sdk tax help

ref 형식 (3-tier):
  taxonomy:axis.entry              dotted
  taxonomy#/axes/<axis>/entries/<entry>   JSON pointer
  taxonomy::axis#address           address-based
`);
}

function validateCmd(args: string[]): void {
  const strict = args.includes("--strict");
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("파일 경로 필요: qa-sdk tax validate <file>");
    process.exit(1);
    return;
  }

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
    printDiagnostics([parsed.error], { json, file });
    process.exit(1);
    return;
  }

  const diags = validate(parsed.ir, undefined, { strict });
  printDiagnostics(diags, { json, file });
  const errors = diags.filter((d) => d.severity === "error");
  if (errors.length > 0) process.exit(1);
}

function showCmd(args: string[]): void {
  const json = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length < 2) {
    console.error("사용법: qa-sdk tax show <file> <ref>");
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

function printShowResult(result: RefResult): void {
  console.log(`kind: ${result.kind}`);
  switch (result.kind) {
    case "entry": {
      const entry = result.entry as { id: string; address: number; label?: string };
      console.log(`id:      ${entry.id}`);
      console.log(`address: ${entry.address}`);
      if (entry.label) console.log(`label:   ${entry.label}`);
      break;
    }
    case "axis": {
      const axis = result.axis as { name: string; entries?: Array<{ id: string; address: number }>; capacity: number };
      console.log(`name:     ${axis.name}`);
      if (axis.entries) {
        console.log(`entries:  ${axis.entries.length} (${axis.entries.map((e) => e.id).join(", ")})`);
      }
      console.log(`capacity: ${axis.capacity}`);
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

function printDiagnostics(
  diags: Diagnostic[],
  opts: { json: boolean; file?: string },
): void {
  if (opts.json) {
    console.log(JSON.stringify(diags, null, 2));
    return;
  }

  if (diags.length === 0) {
    console.log("✔ 검증 통과 (errors=0, warnings=0)");
    return;
  }

  const errs = diags.filter((d) => d.severity === "error").length;
  const warns = diags.filter((d) => d.severity === "warning").length;
  console.log(`${errs > 0 ? "✖" : "⚠"} ${errs} errors, ${warns} warnings`);
  console.log("");
  for (const d of diags) {
    const tag = d.severity === "error" ? "ERR " : d.severity === "warning" ? "WARN" : "INFO";
    console.log(`  ${tag} ${d.code}`);
    if (d.ref) console.log(`       ${d.ref}`);
    console.log(`       ${d.message}`);
    if (d.hint) console.log(`       hint: ${d.hint}`);
    console.log("");
  }
}
