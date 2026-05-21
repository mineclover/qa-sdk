import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse, validate } from "taxonomy-engine";
import { loadRegistryDir, extractRegistryDir, filterRegistryArgs, printDiagnostics } from "./shared.js";

export function validateCmd(args: string[]): void {
  const strict = args.includes("--strict");
  const lifecycleStrict = args.includes("--lifecycle-strict");
  const json = args.includes("--json");
  const registryDir = extractRegistryDir(args);
  const filteredArgs = filterRegistryArgs(args);
  const file = filteredArgs.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("파일 경로 필요: qa-sdk tax validate <file> [--registry <dir>] [--lifecycle-strict]");
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

  const reg = registryDir ? loadRegistryDir(registryDir) : undefined;
  // parsed.ir 자체도 reg에 추가해야 self-validate 가능
  if (reg) reg.add(parsed.ir);

  const diags = validate(parsed.ir, reg, {
    strict,
    lifecycleStrict,
    decisionLinkBaseDir: dirname(file),
  });
  printDiagnostics(diags, { json, file });
  const errors = diags.filter((d) => d.severity === "error");
  if (errors.length > 0) process.exit(1);
}
