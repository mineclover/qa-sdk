#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, validate, TaxonomyRegistry } from "../packages/taxonomy-engine/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAX_DIR = join(__dirname, "..", "docs", "taxonomies");

function main() {
  const files = readdirSync(TAX_DIR).filter((f) => f.endsWith(".yaml"));
  if (files.length === 0) {
    console.error(`taxonomies 없음: ${TAX_DIR}`);
    process.exit(1);
  }

  // 1단계: 모두 parse + registry 등록
  const reg = new TaxonomyRegistry();
  const parsed = [];
  for (const file of files) {
    const text = readFileSync(join(TAX_DIR, file), "utf8");
    const r = parse(text);
    if ("error" in r) {
      console.error(`✖ parse 실패: ${file}`);
      console.error(`  ${r.error.code}: ${r.error.message}`);
      process.exit(1);
    }
    reg.add(r.ir);
    parsed.push({ file, ir: r.ir });
  }

  // 2단계: 모두 validate (registry로 cross-tax 해소)
  let totalErrors = 0;
  let totalWarnings = 0;
  for (const { file, ir } of parsed) {
    const diags = validate(ir, reg);
    const errs = diags.filter((d) => d.severity === "error");
    const warns = diags.filter((d) => d.severity === "warning");
    totalErrors += errs.length;
    totalWarnings += warns.length;
    const tag = errs.length > 0 ? "✖" : warns.length > 0 ? "⚠" : "✔";
    console.log(`${tag} ${file}: ${errs.length} errors, ${warns.length} warnings`);
    for (const d of errs) console.log(`    ERR ${d.code}: ${d.message}`);
    for (const d of warns) console.log(`    WARN ${d.code}: ${d.message}`);
  }

  console.log(`\n총 ${parsed.length} taxonomies, ${totalErrors} errors, ${totalWarnings} warnings`);
  if (totalErrors > 0) process.exit(1);
}

main();
