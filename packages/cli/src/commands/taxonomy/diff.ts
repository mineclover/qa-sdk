import { readFileSync } from "node:fs";
import { parse, validate, diff } from "taxonomy-engine";
import type { Diagnostic, DiffEntry } from "taxonomy-engine";
import { loadRegistryDir, extractRegistryDir, filterRegistryArgs } from "./shared.js";

export function formatChange(c: DiffEntry): string {
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

export function formatRule(rule: Record<string, string>): string {
  return Object.entries(rule)
    .sort(([ka], [kb]) => ka.localeCompare(kb))
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export function diffCmd(args: string[]): void {
  const json = args.includes("--json");
  const registryDir = extractRegistryDir(args);
  const filteredArgs = filterRegistryArgs(args);
  const positional = filteredArgs.filter((a) => !a.startsWith("--"));
  if (positional.length < 2) {
    console.error("사용법: qa-sdk tax diff <a.yaml> <b.yaml> [--registry <dir>] [--json]");
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

  // registry가 있으면 validate 진단 정보 함께 수집
  let validateInfo: { a: Diagnostic[]; b: Diagnostic[] } | undefined;
  if (registryDir) {
    const reg = loadRegistryDir(registryDir);
    reg.add(ra.ir);
    reg.add(rb.ir);
    validateInfo = {
      a: validate(ra.ir, reg),
      b: validate(rb.ir, reg),
    };
  }

  if (json) {
    console.log(JSON.stringify({ ...result, validate: validateInfo }, null, 2));
    return;
  }

  if (result.same) {
    console.log("✔ 두 yaml 동일");
  } else {
    console.log(`${result.changes.length} 변경 발견:\n`);
    for (const c of result.changes) {
      console.log(`  ${formatChange(c)}`);
    }
  }

  // --registry 검증 진단 정보 출력
  if (validateInfo) {
    const aErrs = validateInfo.a.filter((d) => d.severity === "error").length;
    const bErrs = validateInfo.b.filter((d) => d.severity === "error").length;
    const aWarns = validateInfo.a.filter((d) => d.severity === "warning").length;
    const bWarns = validateInfo.b.filter((d) => d.severity === "warning").length;
    if (aErrs > 0 || bErrs > 0) {
      console.log(`\n[--registry 검증] a errors=${aErrs} warnings=${aWarns}, b errors=${bErrs} warnings=${bWarns}`);
    } else {
      console.log(`\n[--registry 검증] a warnings=${aWarns}, b warnings=${bWarns} (errors=0)`);
    }
  }
}
