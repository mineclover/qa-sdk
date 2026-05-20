import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse, TaxonomyRegistry } from "taxonomy-engine";
import type { Diagnostic } from "taxonomy-engine";

export function loadRegistryDir(dir: string): TaxonomyRegistry {
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

export function extractRegistryDir(args: string[]): string | undefined {
  const idx = args.indexOf("--registry");
  return idx >= 0 ? args[idx + 1] : undefined;
}

export function filterRegistryArgs(args: string[]): string[] {
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

export function printDiagnostics(
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
