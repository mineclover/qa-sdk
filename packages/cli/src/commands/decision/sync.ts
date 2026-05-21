import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve, basename } from "node:path";
import { execSync } from "node:child_process";
import { parse as parseYaml } from "taxonomy-engine";
import type { EntryIR, Lifecycle } from "taxonomy-engine";
import {
  computeSyncAction,
  createDecisionSkeletonText,
  parseDecisionFile,
  serializeDecisionFile,
  type ConflictResolution,
  type DecisionFile,
  type SyncAction,
} from "taxonomy-decision-bridge";

const TAX_DIR = "docs/taxonomies";

type SyncArgs = {
  dryRun: boolean;
  json: boolean;
  conflict?: ConflictResolution;
  refFilter?: string;
};

type SyncReport = {
  ref: string;
  taxonomyFile: string;
  action: SyncAction;
  applied: boolean;
  decisionPath?: string;
};

export async function decisionSyncCmd(args: string[]): Promise<void> {
  const parsed = parseSyncArgs(args);
  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return;
  }

  const cwd = process.cwd();
  const reports: SyncReport[] = [];
  const yamlFiles = readdirSync(join(cwd, TAX_DIR))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => join(TAX_DIR, f));

  for (const yamlFile of yamlFiles) {
    const abs = join(cwd, yamlFile);
    const text = readFileSync(abs, "utf8");
    const r = parseYaml(text);
    if ("error" in r) continue;
    for (const [axisName, axis] of r.ir.axes) {
      for (const entry of axis.entries) {
        if (!entry.decisionLink) continue;
        const subject = `tax:${r.ir.taxonomy}:${axisName}.${entry.id}`;
        if (parsed.refFilter && parsed.refFilter !== subject) continue;
        const report = processEntry({
          cwd,
          yamlFile,
          subject,
          entry,
          conflict: parsed.conflict,
        });
        reports.push(report);
        if (!parsed.dryRun && report.applied) {
          applyAndCommit(cwd, report);
        }
      }
    }
  }

  outputReport(reports, parsed);
}

function parseSyncArgs(args: string[]): SyncArgs | { error: string } {
  const opts: SyncArgs = { dryRun: false, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--accept-yaml") opts.conflict = "accept-yaml";
    else if (a === "--accept-decision") opts.conflict = "accept-decision";
    else if (a === "--merge") opts.conflict = "merge";
    else if (!a.startsWith("--")) opts.refFilter = a;
    else return { error: `알 수 없는 옵션: ${a}` };
  }
  return opts;
}

type ProcessOpts = {
  cwd: string;
  yamlFile: string;
  subject: string;
  entry: EntryIR;
  conflict?: ConflictResolution;
};

function processEntry(opts: ProcessOpts): SyncReport {
  const { cwd, yamlFile, subject, entry, conflict } = opts;
  const decisionPath = resolveDecisionPath(cwd, yamlFile, entry.decisionLink!);
  let decisionFile: DecisionFile | undefined;
  if (decisionPath && existsSync(decisionPath)) {
    try {
      decisionFile = parseDecisionFile(readFileSync(decisionPath, "utf8"));
    } catch {
      decisionFile = undefined;
    }
  }

  const action = computeSyncAction(entry, subject, decisionFile, {}, { conflict });
  const applied = action.kind !== "noop" && action.kind !== "conflict";

  return {
    ref: subject,
    taxonomyFile: yamlFile,
    action,
    applied,
    decisionPath: decisionPath ?? undefined,
  };
}

function resolveDecisionPath(
  cwd: string,
  yamlFile: string,
  decisionLink: string,
): string | undefined {
  if (decisionLink.startsWith("http://") || decisionLink.startsWith("https://")) {
    return undefined;
  }
  if (decisionLink.startsWith("decision-flow://")) {
    // Stage 3에서는 markdown SSOT만 지원
    return undefined;
  }
  if (decisionLink.startsWith("tax:")) return undefined;
  const yamlDir = dirname(join(cwd, yamlFile));
  return isAbsolute(decisionLink) ? decisionLink : resolve(yamlDir, decisionLink);
}

function applyAndCommit(cwd: string, report: SyncReport): void {
  const action = report.action;
  if (action.kind === "push-create") {
    createDecisionSkeleton({
      cwd,
      decisionPath: report.decisionPath!,
      subject: action.subject,
      question: action.question,
      lifecycle: action.initialLifecycle,
    });
    commitChanges(cwd, [report.decisionPath!], buildCommitMessage(action, report));
    return;
  }
  if (action.kind === "pull-yaml-lifecycle") {
    updateYamlLifecycle({
      cwd,
      yamlFile: report.taxonomyFile,
      ref: report.ref,
      newLifecycle: action.newLifecycle,
    });
    commitChanges(
      cwd,
      [report.taxonomyFile],
      buildCommitMessage(action, report),
    );
    return;
  }
  if (action.kind === "pull-decision-lifecycle") {
    updateDecisionLifecycle({
      decisionPath: report.decisionPath!,
      newLifecycle: action.newLifecycle,
    });
    commitChanges(cwd, [report.decisionPath!], buildCommitMessage(action, report));
    return;
  }
}

function createDecisionSkeleton(opts: {
  cwd: string;
  decisionPath: string;
  subject: string;
  question: string;
  lifecycle: Lifecycle;
}): void {
  mkdirSync(dirname(opts.decisionPath), { recursive: true });
  const text = createDecisionSkeletonText({
    id: basename(opts.decisionPath, ".md"),
    subject: opts.subject,
    question: opts.question,
    lifecycle: opts.lifecycle,
  });
  writeFileSync(opts.decisionPath, text);
}

function updateYamlLifecycle(opts: {
  cwd: string;
  yamlFile: string;
  ref: string;
  newLifecycle: Lifecycle;
}): void {
  // ref: tax:<slug>:<axis>.<entry>
  const m = opts.ref.match(/^tax:([^:]+):([^.]+)\.(.+)$/);
  if (!m) throw new Error(`잘못된 ref 형식: ${opts.ref}`);
  const [, , axis, entryId] = m;
  const abs = join(opts.cwd, opts.yamlFile);
  const text = readFileSync(abs, "utf8");

  // entry 한 줄 찾기 (`- { id: <entryId>, ... lifecycle: <X> ... }`)
  const lines = text.split("\n");
  let updated = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(`id: ${entryId}`)) continue;
    if (!line.includes("lifecycle:")) continue;
    lines[i] = line.replace(/lifecycle:\s*\w+/, `lifecycle: ${opts.newLifecycle}`);
    updated = true;
    break;
  }
  if (!updated) {
    throw new Error(
      `yaml 갱신 실패 — axis=${axis} entry=${entryId} lifecycle 라인 못 찾음`,
    );
  }
  writeFileSync(abs, lines.join("\n"));
}

function updateDecisionLifecycle(opts: {
  decisionPath: string;
  newLifecycle: Lifecycle;
}): void {
  const text = readFileSync(opts.decisionPath, "utf8");
  const file = parseDecisionFile(text);
  file.meta.lifecycle = opts.newLifecycle;
  file.meta.updated = new Date().toISOString();
  writeFileSync(opts.decisionPath, serializeDecisionFile(file));
}

function commitChanges(cwd: string, files: string[], message: string): void {
  try {
    execSync(`git add ${files.map((f) => `"${f}"`).join(" ")}`, { cwd });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    console.error(`commit 실패: ${(e as Error).message}`);
  }
}

function buildCommitMessage(action: SyncAction, report: SyncReport): string {
  switch (action.kind) {
    case "push-create":
      return `chore(decision): create skeleton for ${report.ref}`;
    case "pull-yaml-lifecycle":
      return `sync(taxonomy): ${report.ref} lifecycle → ${action.newLifecycle}`;
    case "pull-decision-lifecycle":
      return `sync(decision): ${report.ref} lifecycle → ${action.newLifecycle}`;
    default:
      return `sync: ${report.ref}`;
  }
}

function outputReport(reports: SyncReport[], opts: SyncArgs): void {
  if (opts.json) {
    console.log(JSON.stringify({ dryRun: opts.dryRun, reports }, null, 2));
    return;
  }
  if (reports.length === 0) {
    console.log("✔ 동기화 대상 없음 (decisionLink를 가진 entry 없음)");
    return;
  }
  for (const r of reports) {
    const tag = describeAction(r);
    console.log(`${tag}  ${r.ref}`);
    if (r.action.kind === "conflict") {
      console.log(
        `       yaml=${r.action.yaml.lifecycle}  decision=${r.action.decision.lifecycle}  evidence=${r.action.decision.evidenceCount}`,
      );
      console.log(`       옵션: --accept-yaml | --accept-decision | --merge`);
    }
  }
  const applied = reports.filter((r) => r.applied).length;
  const conflicts = reports.filter((r) => r.action.kind === "conflict").length;
  const noop = reports.filter((r) => r.action.kind === "noop").length;
  console.log(
    `\n총 ${reports.length}건 — ${applied}건 적용${opts.dryRun ? " (dry-run, 미적용)" : ""}, ${conflicts}건 충돌, ${noop}건 변경 없음`,
  );
  if (conflicts > 0) process.exit(1);
}

function describeAction(r: SyncReport): string {
  switch (r.action.kind) {
    case "push-create": return "+";
    case "pull-yaml-lifecycle": return "←";
    case "pull-decision-lifecycle": return "→";
    case "conflict": return "!";
    case "noop": return "✔";
  }
}
