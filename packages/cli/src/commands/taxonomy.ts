import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse, validate, show, codegen, CodegenValidationError, TaxonomyRegistry, diff } from "taxonomy-engine";
import type { Diagnostic, RefResult, DiffEntry } from "taxonomy-engine";

export async function cliTaxonomy(rest: string[]): Promise<void> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "validate":
      return validateCmd(args);
    case "show":
      return showCmd(args);
    case "codegen":
      return codegenCmd(args);
    case "diff":
      return diffCmd(args);
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
  console.log(`qa-sdk tax — 텍소노미 yaml 검증/조회/생성

사용법:
  qa-sdk tax validate <file> [--registry <dir>] [--strict] [--json]
  qa-sdk tax show <file> <ref> [--json]
  qa-sdk tax show <ref> --registry <dir> [--json]
  qa-sdk tax codegen <file> --out <dir> [--skip-validate] [--json]
  qa-sdk tax diff <a> <b> [--json]
  qa-sdk tax help

--registry <dir>: 디렉토리의 모든 .yaml을 TaxonomyRegistry에 로드.
  cross-taxonomy import 검증 및 registry-wide ref 조회에 활용.

ref 형식 (3-tier):
  taxonomy:axis.entry              dotted
  taxonomy#/axes/<axis>/entries/<entry>   JSON pointer
  taxonomy::axis#address           address-based
`);
}

function loadRegistryDir(dir: string): TaxonomyRegistry {
  const reg = new TaxonomyRegistry();
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (e) {
    console.error(`--registry 디렉토리 읽기 실패: ${dir} — ${(e as Error).message}`);
    process.exit(1);
    return reg;
  }
  for (const name of entries) {
    if (!name.endsWith(".yaml")) continue;
    const path = join(dir, name);
    try {
      const text = readFileSync(path, "utf8");
      const r = parse(text);
      if ("ir" in r) reg.add(r.ir);
      else {
        console.error(`--registry: ${name} parse 실패 (skip): ${r.error.message}`);
      }
    } catch (e) {
      console.error(`--registry: ${name} 읽기 실패 (skip): ${(e as Error).message}`);
    }
  }
  return reg;
}

function extractRegistryDir(args: string[]): string | undefined {
  const idx = args.indexOf("--registry");
  return idx >= 0 ? args[idx + 1] : undefined;
}

function filterRegistryArgs(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--registry") {
      i++; // skip value
      continue;
    }
    result.push(args[i]);
  }
  return result;
}

function validateCmd(args: string[]): void {
  const strict = args.includes("--strict");
  const json = args.includes("--json");
  const registryDir = extractRegistryDir(args);
  const filteredArgs = filterRegistryArgs(args);
  const file = filteredArgs.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("파일 경로 필요: qa-sdk tax validate <file> [--registry <dir>]");
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

  const diags = validate(parsed.ir, reg, { strict });
  printDiagnostics(diags, { json, file });
  const errors = diags.filter((d) => d.severity === "error");
  if (errors.length > 0) process.exit(1);
}

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

function showCmd(args: string[]): void {
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

function codegenCmd(args: string[]): void {
  const json = args.includes("--json");
  const skipValidate = args.includes("--skip-validate");
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : undefined;
  const positional = args.filter((a, i) => {
    if (a.startsWith("--")) return false;
    if (i > 0 && args[i - 1] === "--out") return false;
    return true;
  });
  const file = positional[0];

  if (!file) {
    console.error("사용법: qa-sdk tax codegen <file> --out <dir> [--skip-validate] [--json]");
    process.exit(1);
    return;
  }
  if (!outDir) {
    console.error("--out <dir> 필수");
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
    console.error(`parse 실패: ${parsed.error.message}`);
    process.exit(1);
    return;
  }

  let result;
  try {
    result = codegen(parsed.ir, { skipValidate });
  } catch (e) {
    if (e instanceof CodegenValidationError) {
      console.error(`codegen 거부: ${e.diagnostics.length} errors`);
      for (const d of e.diagnostics) {
        console.error(`  ERR ${d.code}: ${d.message}`);
      }
      console.error("--skip-validate로 우회 가능");
      process.exit(1);
      return;
    }
    throw e;
  }

  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const [name, content] of Object.entries(result.files)) {
    const path = join(outDir, name);
    writeFileSync(path, content);
    written.push(path);
  }

  if (json) {
    console.log(JSON.stringify({ contentHash: result.contentHash, files: written }, null, 2));
    return;
  }

  console.log(`✔ codegen 완료 (contentHash: ${result.contentHash})`);
  for (const path of written) {
    console.log(`  ${path}`);
  }
}

function diffCmd(args: string[]): void {
  const json = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length < 2) {
    console.error("사용법: qa-sdk tax diff <a.yaml> <b.yaml> [--json]");
    process.exit(1);
    return;
  }
  const [fileA, fileB] = positional;

  let textA: string, textB: string;
  try {
    textA = readFileSync(fileA, "utf8");
    textB = readFileSync(fileB, "utf8");
  } catch (e) {
    console.error(`파일 읽기 실패: ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const ra = parse(textA);
  const rb = parse(textB);
  if ("error" in ra) {
    console.error(`a parse 실패: ${ra.error.message}`);
    process.exit(1);
    return;
  }
  if ("error" in rb) {
    console.error(`b parse 실패: ${rb.error.message}`);
    process.exit(1);
    return;
  }

  const result = diff(ra.ir, rb.ir);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.same) {
    console.log("✔ 두 yaml 동일");
    return;
  }
  console.log(`${result.changes.length} 변경 발견:\n`);
  for (const c of result.changes) {
    console.log(`  ${formatChange(c)}`);
  }
}

function formatChange(c: DiffEntry): string {
  switch (c.kind) {
    case "axis-added": return `+ axis ${c.axis}`;
    case "axis-removed": return `- axis ${c.axis}`;
    case "entry-added": return `+ ${c.axis}.${c.id} (address=${c.address})`;
    case "entry-removed": return `- ${c.axis}.${c.id} (address=${c.address})`;
    case "entry-address-changed": return `~ ${c.axis}.${c.id} address ${c.from} → ${c.to}`;
    case "entry-label-changed": return `~ ${c.axis}.${c.id} label "${c.from ?? ""}" → "${c.to ?? ""}"`;
    case "capacity-changed": return `~ ${c.axis} capacity ${c.from} → ${c.to}`;
    case "relation-added": return `+ relation ${c.name}`;
    case "relation-removed": return `- relation ${c.name}`;
    case "relation-rules-count-changed": return `~ relation ${c.name} rules ${c.from} → ${c.to}`;
    case "relation-rule-added": return `+ ${c.relation} rule { ${formatRule(c.rule)} }`;
    case "relation-rule-removed": return `- ${c.relation} rule { ${formatRule(c.rule)} }`;
    case "constraint-added": return `+ constraint ${c.id}`;
    case "constraint-removed": return `- constraint ${c.id}`;
  }
}

function formatRule(rule: Record<string, string>): string {
  return Object.entries(rule)
    .sort(([ka], [kb]) => ka.localeCompare(kb))
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
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
