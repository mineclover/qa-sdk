import { readFileSync } from "node:fs";
import { parse, validate } from "taxonomy-engine";
import type { Diagnostic } from "taxonomy-engine";

export async function cliTaxonomy(rest: string[]): Promise<void> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "validate":
      return validateCmd(args);
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
  console.log(`qa-sdk tax — 텍소노미 yaml 검증

사용법:
  qa-sdk tax validate <file> [--strict] [--json]
  qa-sdk tax help
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
