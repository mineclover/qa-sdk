import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { parse, diff, migrationPlan } from "taxonomy-engine";

function extractFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

export function migrationCmd(args: string[]): void {
  const json = args.includes("--json");
  const base = extractFlag(args, "--base") ?? "main";
  const positional = args.filter((a, i) => {
    if (a.startsWith("--")) return false;
    if (i > 0 && args[i - 1] === "--base") return false;
    return true;
  });
  const file = positional[0];
  if (!file) {
    console.error("사용법: qa-sdk tax migration --base <ref> <file> [--json]");
    process.exit(1);
    return;
  }

  let baseText: string | undefined;
  try {
    baseText = execSync(`git show "${base}:${file}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });
  } catch {
    console.error(`git show 실패: ${base}:${file} (base에 파일 없음 — 신규 파일?)`);
    process.exit(1);
    return;
  }

  let currentText: string;
  try {
    currentText = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`파일 읽기 실패: ${file} — ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const baseIR = parse(baseText);
  const currentIR = parse(currentText);
  if ("error" in baseIR) {
    console.error(`base parse 실패: ${baseIR.error.message}`);
    process.exit(1);
    return;
  }
  if ("error" in currentIR) {
    console.error(`current parse 실패: ${currentIR.error.message}`);
    process.exit(1);
    return;
  }

  const diffResult = diff(baseIR.ir, currentIR.ir);
  const plan = migrationPlan(baseIR.ir, currentIR.ir);

  if (json) {
    console.log(
      JSON.stringify(
        {
          base,
          file,
          diff: { same: diffResult.same, breakingLevel: diffResult.breakingLevel, changeCount: diffResult.changes.length },
          plan,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`base=${base}  file=${file}`);
  console.log(
    `diff: ${diffResult.changes.length} changes  breakingLevel=${diffResult.breakingLevel}`,
  );

  if (
    plan.idRenames.length === 0 &&
    plan.addressConflicts.length === 0 &&
    plan.manualReview.length === 0 &&
    plan.decisionImpact.length === 0
  ) {
    console.log("✔ migration 필요 없음");
    return;
  }

  if (plan.idRenames.length > 0) {
    console.log(`\nid renames (${plan.idRenames.length}):`);
    for (const r of plan.idRenames) {
      console.log(`  - axis=${r.axis}  address=${r.address}  ${r.fromId} → ${r.toId}`);
    }
  }

  if (plan.addressConflicts.length > 0) {
    console.log(`\naddress conflicts (${plan.addressConflicts.length}):`);
    for (const c of plan.addressConflicts) {
      console.log(`  - axis=${c.axis}  address=${c.address}  ids=[${c.ids.join(", ")}]`);
    }
  }

  if (plan.manualReview.length > 0) {
    console.log(`\nmanual review (${plan.manualReview.length}):`);
    for (const m of plan.manualReview) {
      console.log(`  - ${m}`);
    }
  }

  if (plan.decisionImpact.length > 0) {
    console.log(`\ndecision impact (${plan.decisionImpact.length}):`);
    for (const d of plan.decisionImpact) {
      const detail = describeDecisionImpact(d);
      console.log(`  - axis=${d.axis}  id=${d.id}  ${d.impact}${detail}  link=${d.decisionLink}`);
    }
  }
}

function describeDecisionImpact(d: {
  impact: "lifecycle-changed" | "address-changed" | "removed";
  fromLifecycle?: string;
  toLifecycle?: string;
  fromAddress?: number;
  toAddress?: number;
}): string {
  switch (d.impact) {
    case "lifecycle-changed":
      return `  (${d.fromLifecycle ?? "∅"} → ${d.toLifecycle ?? "∅"})`;
    case "address-changed":
      return `  (${d.fromAddress} → ${d.toAddress})`;
    case "removed":
      return "";
  }
}
