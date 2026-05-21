#!/usr/bin/env node
/**
 * 도그푸딩 yaml entry 라인에 `lifecycle: approved` 일괄 부여 (Stage 1 마이그레이션).
 *
 * 대상 라인: `^\s*- \{ ... }` (한 줄 entry 객체) 중 `lifecycle:` 없는 라인.
 * 그 외 라인(rules, axis 키, multi-line block 등)은 손대지 않음.
 *
 * axis-level lifecycle, lesson-builder의 미정(tbd) entry 처리는 별도(수동).
 *
 * 실행: node scripts/tax-add-lifecycle.mjs <file>...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

function addLifecycleToFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  let changed = 0;
  const out = lines.map((line) => {
    // 한 줄 entry 객체 패턴: `- { ... }`
    const m = line.match(/^(\s*-\s*\{[^}]*?)\s*\}\s*$/);
    if (!m) return line;
    const inner = m[1];
    if (inner.includes("lifecycle:")) return line;
    if (!inner.includes("id:")) return line;
    changed++;
    return `${inner}, lifecycle: approved }`;
  });
  if (changed > 0) {
    writeFileSync(filePath, out.join("\n"));
    console.log(`✔ ${basename(filePath)}: ${changed} entries`);
  } else {
    console.log(`  ${basename(filePath)}: 변경 없음`);
  }
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("사용법: node scripts/tax-add-lifecycle.mjs <file>...");
  process.exit(1);
}
for (const f of files) addLifecycleToFile(f);
