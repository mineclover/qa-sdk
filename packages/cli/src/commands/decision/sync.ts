import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, basename, relative } from "node:path";
import { execSync } from "node:child_process";
import { parse as parseYaml } from "taxonomy-engine";
import type { EntryIR, Lifecycle } from "taxonomy-engine";
import {
  computeSyncAction,
  createDecisionSkeletonText,
  parseDecisionFile,
  resolveDecisionLink,
  serializeDecisionFile,
  type ConflictResolution,
  type DecisionFile,
  type DecisionEvidence,
  type SyncAction,
} from "taxonomy-decision-bridge";

const TAX_DIR = "docs/taxonomies";
const DECISIONS_DIR = "docs/decisions";

type SyncArgs = {
  dryRun: boolean;
  json: boolean;
  noCommit: boolean;
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
          applyAndCommit(cwd, report, parsed);
        }
      }
    }
  }

  outputReport(reports, parsed);
}

function parseSyncArgs(args: string[]): SyncArgs | { error: string } {
  const opts: SyncArgs = { dryRun: false, json: false, noCommit: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--no-commit") opts.noCommit = true;
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

  // 부채 #2: state 추적 — git/mtime 기반 변경 감지.
  // 양쪽 파일의 working tree 상태(unstaged 변경)와 마지막 commit 시각을 비교해서
  // yamlChanged / decisionChanged를 산출. 변경 정보를 모르면 호출자가 단순 비교로 폴백.
  const state = detectChangeState({
    cwd,
    yamlFile,
    decisionPath,
    decisionFile,
  });

  const action = computeSyncAction(entry, subject, decisionFile, state, {
    conflict,
  });
  const applied =
    action.kind !== "noop" && action.kind !== "conflict";

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
  const resolved = resolveDecisionLink({
    link: decisionLink,
    yamlAbsDir: dirname(join(cwd, yamlFile)),
    decisionsDir: join(cwd, DECISIONS_DIR),
  });
  if (resolved.kind === "external" || resolved.kind === "unsupported") {
    return undefined;
  }
  return resolved.absPath;
}

/**
 * yaml/decision 파일의 변경 상태를 git+fs로 추정 (부채 #2).
 *
 * 휴리스틱:
 * 1. 둘 다 같은 commit에서 마지막으로 변경됐고, working tree에 unstaged 변경 없음 → 둘 다 unchanged.
 * 2. unstaged 변경이 있는 쪽은 changed=true.
 * 3. unstaged 변경 없으면 마지막 commit 시각(--format=%at)이 늦은 쪽만 changed=true.
 *    같은 commit이면 둘 다 unchanged.
 *
 * previousDecision은 markers 비교용 — git HEAD에 마지막 커밋된 버전을 파싱 시도.
 * 파싱 실패하거나 git 정보 없으면 undefined (markers 비교 비활성).
 *
 * fail-open: git 호출 실패 시 빈 state 반환 (호출자가 단순 lifecycle 비교로 폴백).
 */
function detectChangeState(opts: {
  cwd: string;
  yamlFile: string;
  decisionPath: string | undefined;
  decisionFile: DecisionFile | undefined;
}): { yamlChanged?: boolean; decisionChanged?: boolean; previousDecision?: DecisionFile } {
  const { cwd, yamlFile, decisionPath } = opts;
  if (!decisionPath || !opts.decisionFile) {
    return {};
  }
  try {
    const yamlRel = yamlFile;
    const decisionRel = relative(cwd, decisionPath);
    const yamlUnstaged = hasUnstagedChanges(cwd, yamlRel);
    const decisionUnstaged = hasUnstagedChanges(cwd, decisionRel);

    let yamlChanged = yamlUnstaged;
    let decisionChanged = decisionUnstaged;

    if (!yamlUnstaged && !decisionUnstaged) {
      // 마지막 commit 시각 비교 — 늦게 변경된 쪽만 changed
      const yamlTs = lastCommitTimestamp(cwd, yamlRel);
      const decisionTs = lastCommitTimestamp(cwd, decisionRel);
      if (yamlTs !== undefined && decisionTs !== undefined) {
        if (yamlTs > decisionTs) yamlChanged = true;
        else if (decisionTs > yamlTs) decisionChanged = true;
      }
    }

    const previousDecision = readPreviousDecision(cwd, decisionRel);

    return { yamlChanged, decisionChanged, previousDecision };
  } catch {
    return {};
  }
}

function hasUnstagedChanges(cwd: string, relPath: string): boolean {
  try {
    const out = execSync(`git status --porcelain -- "${relPath}"`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function lastCommitTimestamp(cwd: string, relPath: string): number | undefined {
  try {
    const out = execSync(`git log -1 --format=%at -- "${relPath}"`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!out) return undefined;
    const n = Number(out);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

/**
 * git HEAD에 마지막으로 커밋된 decision 파일 버전을 파싱.
 * markers 비교(부채 #8)에 사용. 실패 시 undefined.
 */
function readPreviousDecision(
  cwd: string,
  relPath: string,
): DecisionFile | undefined {
  try {
    const text = execSync(`git show HEAD:"${relPath}"`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseDecisionFile(text);
  } catch {
    return undefined;
  }
}

function applyAndCommit(cwd: string, report: SyncReport, opts: SyncArgs): void {
  const action = report.action;
  if (action.kind === "push-create") {
    createDecisionSkeleton({
      cwd,
      decisionPath: report.decisionPath!,
      subject: action.subject,
      question: action.question,
      lifecycle: action.initialLifecycle,
    });
    if (!opts.noCommit) {
      commitChanges(cwd, [report.decisionPath!], buildCommitMessage(action, report));
    }
    return;
  }
  if (action.kind === "pull-yaml-lifecycle") {
    updateYamlLifecycle({
      cwd,
      yamlFile: report.taxonomyFile,
      ref: report.ref,
      newLifecycle: action.newLifecycle,
    });
    if (!opts.noCommit) {
      commitChanges(
        cwd,
        [report.taxonomyFile],
        buildCommitMessage(action, report),
      );
    }
    return;
  }
  if (action.kind === "pull-decision-lifecycle") {
    updateDecisionLifecycle({
      decisionPath: report.decisionPath!,
      newLifecycle: action.newLifecycle,
    });
    if (!opts.noCommit) {
      commitChanges(cwd, [report.decisionPath!], buildCommitMessage(action, report));
    }
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
    // multi-line 메시지 지원 — -F로 stdin 전달
    execSync(`git commit -F -`, {
      cwd,
      input: message,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    console.error(`commit 실패: ${(e as Error).message}`);
  }
}

/**
 * commit 메시지 생성 (부채 #8).
 *
 * spec:
 * ```
 * sync(taxonomy): <ref> lifecycle <from> → <to>
 *
 *   Evidence:
 *     - precedent: TAXONOMY.md §Cue (weight 0.8)
 *     - data: lesson-builder PoC (weight 0.6)
 * ```
 * evidence 0건이면 본문 생략.
 */
function buildCommitMessage(action: SyncAction, report: SyncReport): string {
  switch (action.kind) {
    case "push-create":
      return `chore(decision): create skeleton for ${report.ref}`;
    case "pull-yaml-lifecycle": {
      const header = `sync(taxonomy): ${report.ref} lifecycle → ${action.newLifecycle}`;
      const body = renderEvidenceBlock(action.evidence);
      return body ? `${header}\n\n${body}` : header;
    }
    case "pull-decision-lifecycle":
      return `sync(decision): ${report.ref} lifecycle → ${action.newLifecycle}`;
    default:
      return `sync: ${report.ref}`;
  }
}

function renderEvidenceBlock(evidence: DecisionEvidence[]): string {
  if (evidence.length === 0) return "";
  const lines = ["  Evidence:"];
  for (const e of evidence) {
    lines.push(`    - ${e.kind}: ${e.text} (weight ${e.weight})`);
  }
  return lines.join("\n");
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
    if (r.action.kind === "noop" && r.action.reason === "markers-only") {
      console.log(
        `       decision markers 변경 감지 (lifecycle 동일) — commit은 사용자 몫`,
      );
    }
  }
  const applied = reports.filter((r) => r.applied).length;
  const conflicts = reports.filter((r) => r.action.kind === "conflict").length;
  const noop = reports.filter((r) => r.action.kind === "noop").length;
  const markersOnly = reports.filter(
    (r) => r.action.kind === "noop" && r.action.reason === "markers-only",
  ).length;
  const noCommitNote = opts.noCommit ? ", commit 생략 (--no-commit)" : "";
  const dryNote = opts.dryRun ? " (dry-run, 미적용)" : "";
  const markersNote = markersOnly > 0 ? `, ${markersOnly}건 markers-only` : "";
  console.log(
    `\n총 ${reports.length}건 — ${applied}건 적용${dryNote}${noCommitNote}, ${conflicts}건 충돌, ${noop}건 변경 없음${markersNote}`,
  );
  if (conflicts > 0) process.exit(1);
}

function describeAction(r: SyncReport): string {
  switch (r.action.kind) {
    case "push-create": return "+";
    case "pull-yaml-lifecycle": return "←";
    case "pull-decision-lifecycle": return "→";
    case "conflict": return "!";
    case "noop":
      if (r.action.reason === "markers-only") return "≈";
      return "✔";
  }
}
