import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { parse, diff } from "taxonomy-engine";
import type { DiffEntry } from "taxonomy-engine";
import { formatChange } from "./diff.js";

export function gitDiffCmd(args: string[]): void {
  const json = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  const baseRef = positional[0] ?? "main";

  let changedFiles: string[];
  try {
    const out = execSync(
      `git diff --name-only "${baseRef}" -- 'docs/taxonomies/*.yaml'`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], cwd: process.cwd() },
    ).trim();
    changedFiles = out ? out.split("\n").filter(Boolean) : [];
  } catch (e) {
    console.error(`git diff 실패 (base=${baseRef}): ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  if (changedFiles.length === 0) {
    if (json) {
      console.log(JSON.stringify({ base: baseRef, changes: [] }, null, 2));
    } else {
      console.log(`✔ ${baseRef} 대비 docs/taxonomies/*.yaml 변경 없음`);
    }
    return;
  }

  const allChanges: Array<{
    file: string;
    status: "added" | "removed" | "modified" | "unchanged" | "parse-error";
    changes?: unknown[];
  }> = [];

  for (const file of changedFiles) {
    let baseText: string | undefined;
    try {
      baseText = execSync(`git show "${baseRef}:${file}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
      });
    } catch {
      // base에 없음 = 신규 파일
      baseText = undefined;
    }

    let currentText: string | undefined;
    try {
      currentText = readFileSync(file, "utf8");
    } catch {
      // working tree에 없음 = 삭제됨
      currentText = undefined;
    }

    if (!baseText && currentText) {
      allChanges.push({ file, status: "added" });
      continue;
    }
    if (baseText && !currentText) {
      allChanges.push({ file, status: "removed" });
      continue;
    }
    if (!baseText && !currentText) continue;

    const baseIR = parse(baseText!);
    const currentIR = parse(currentText!);
    if ("error" in baseIR || "error" in currentIR) {
      allChanges.push({
        file,
        status: "parse-error",
        changes: [{ message: "양쪽 또는 한쪽 parse 실패" }],
      });
      continue;
    }
    const result = diff(baseIR.ir, currentIR.ir);
    allChanges.push({
      file,
      status: result.same ? "unchanged" : "modified",
      changes: result.same ? undefined : result.changes,
    });
  }

  if (json) {
    console.log(JSON.stringify({ base: baseRef, changes: allChanges }, null, 2));
    return;
  }

  console.log(`${baseRef} 대비 ${changedFiles.length} taxonomies 변경:\n`);
  for (const c of allChanges) {
    if (c.status === "added") {
      console.log(`+ ${c.file} (신규)`);
    } else if (c.status === "removed") {
      console.log(`- ${c.file} (삭제됨)`);
    } else if (c.status === "modified" && c.changes) {
      console.log(`~ ${c.file} (${c.changes.length} 변경):`);
      for (const change of c.changes) {
        console.log(`    ${formatChange(change as DiffEntry)}`);
      }
    } else if (c.status === "parse-error") {
      console.log(`! ${c.file} (parse 실패)`);
    } else {
      console.log(`✔ ${c.file} (unchanged after re-parse)`);
    }
  }
}
