#!/usr/bin/env node
/**
 * axes 안의 각 axis 객체에 `lifecycle: approved` 부여.
 *
 * 대상: `description:` 또는 `description: |` 다음 라인. 이미 lifecycle 있는 axis는 skip.
 * description 없는 axis는 axis 키 다음 라인.
 *
 * 실행: node scripts/tax-add-axis-lifecycle.mjs <file>...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function addAxisLifecycle(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  const out = [];
  let inAxes = false;
  let axesIndent = -1;
  let currentAxisStartIdx = -1; // out index
  let currentAxisIndent = -1;
  let currentAxisHasLifecycle = false;
  let changed = 0;

  const flush = () => {
    if (currentAxisStartIdx >= 0 && !currentAxisHasLifecycle) {
      // 부재 시 description: 다음(또는 axis 키 바로 다음) 줄에 lifecycle 삽입
      // currentAxisStartIdx + 1부터 axis 내부. description 검색.
      const childIndent = " ".repeat(currentAxisIndent + 2);
      let insertAt = currentAxisStartIdx + 1;
      // description: 또는 description: | block 확인
      const descLine = out[insertAt];
      if (descLine && /^\s+description:/.test(descLine)) {
        // multi-line block (`description: |`)인지 확인 — 그러면 indent 작은 라인까지 skip
        if (/^\s+description:\s*\|/.test(descLine)) {
          let j = insertAt + 1;
          while (j < out.length) {
            const l = out[j];
            if (l.trim() === "" || indentOf(l) > currentAxisIndent + 2) {
              j++;
              continue;
            }
            break;
          }
          insertAt = j;
        } else {
          insertAt = insertAt + 1;
        }
      }
      out.splice(insertAt, 0, `${childIndent}lifecycle: approved`);
      changed++;
    }
    currentAxisStartIdx = -1;
    currentAxisIndent = -1;
    currentAxisHasLifecycle = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^axes:\s*$/.test(line)) {
      inAxes = true;
      out.push(line);
      continue;
    }

    if (inAxes) {
      // axes 종료
      if (/^[a-zA-Z]/.test(line)) {
        flush();
        inAxes = false;
        out.push(line);
        continue;
      }

      const axisMatch = line.match(/^(\s+)([a-zA-Z][a-zA-Z0-9_-]*):\s*$/);
      if (axisMatch) {
        const indent = axisMatch[1].length;
        if (axesIndent === -1) axesIndent = indent;
        if (indent === axesIndent) {
          flush();
          out.push(line);
          currentAxisStartIdx = out.length - 1;
          currentAxisIndent = indent;
          currentAxisHasLifecycle = false;
          continue;
        }
      }

      // axis 내부 라인 — lifecycle 검사
      if (
        currentAxisStartIdx >= 0 &&
        /^\s+lifecycle:/.test(line) &&
        indentOf(line) === currentAxisIndent + 2
      ) {
        currentAxisHasLifecycle = true;
      }
    }

    out.push(line);
  }

  // 파일 끝까지 진행했으면 마지막 axis flush
  if (inAxes) flush();

  if (changed > 0) {
    writeFileSync(filePath, out.join("\n"));
    console.log(`✔ ${basename(filePath)}: ${changed} axes`);
  } else {
    console.log(`  ${basename(filePath)}: 변경 없음`);
  }
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("사용법: node scripts/tax-add-axis-lifecycle.mjs <file>...");
  process.exit(1);
}
for (const f of files) addAxisLifecycle(f);
