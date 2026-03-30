/**
 * review 서브커맨드 — 파일 리뷰 완료 기록/조회.
 *
 * qa-sdk review mark <glob|file...> --reviewer <name> [--model <ai>] [--notes <text>] [--commit <sha>]
 * qa-sdk review status [--service <scope>] [--stale] [--unreviewed]
 * qa-sdk review dashboard
 * qa-sdk review log <file>
 * qa-sdk review request [<glob|file...>] --reviewer <name> --purpose <text> [--model <ai>] [--service <scope>]
 *   [--dkg-target <nodeId>] [--decision-id <id>]
 *   [--decision-type <type> --title <text> --rationale <text>]
 * qa-sdk review requests [--service <scope>] [--limit <n>]
 * qa-sdk review show-request <id> [--json]
 * qa-sdk review bridge-request <id> --target <nodeId> [--decision-id <id>]
 * qa-sdk review bridge-request <id> --target <nodeId> --decision-type <type> --title <text> --rationale <text>
 */

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { execaSync } from "execa";
import {
  ReviewLedger,
  SqliteReviewStore,
} from "review-ledger";
import { getQaSdkDir } from "../lib/qa-dir.js";
import { bridgeFeedbackRequestToDkg } from "../lib/review-feedback-dkg.js";
import { resolveRelatedDocsForFiles } from "../lib/review-feedback-docs.js";

const QA_DIR = getQaSdkDir();
const DB_PATH = join(QA_DIR, "review-ledger.sqlite");

function ensureDir(): void {
  if (!existsSync(QA_DIR)) mkdirSync(QA_DIR, { recursive: true });
}

function createLedger(cwd: string): ReviewLedger {
  ensureDir();
  const store = new SqliteReviewStore(DB_PATH);
  return new ReviewLedger(store, cwd);
}

/** glob 패턴을 파일 목록으로 확장 */
function expandGlobs(cwd: string, patterns: string[]): string[] {
  const files = new Set<string>();
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      // git ls-files로 glob 매칭
      try {
        const { stdout } = execaSync("git", ["ls-files", "--", pattern], { cwd });
        for (const line of stdout.split("\n")) {
          const trimmed = line.trim();
          if (trimmed) files.add(trimmed);
        }
      } catch {
        console.error(`glob 확장 실패: ${pattern}`);
      }
    } else {
      files.add(pattern);
    }
  }
  return [...files];
}

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

/** 비 플래그 인자만 추출 (파일 경로/패턴) */
function positionalArgs(args: string[]): string[] {
  const result: string[] = [];
  const flags = new Set([
    "--reviewer",
    "--model",
    "--notes",
    "--commit",
    "--service",
    "--purpose",
    "--limit",
    "--dkg-target",
    "--target",
    "--decision-id",
    "--decision-type",
    "--title",
    "--rationale",
  ]);
  let skip = false;
  for (const arg of args) {
    if (skip) { skip = false; continue; }
    if (flags.has(arg)) { skip = true; continue; }
    if (arg.startsWith("--")) continue;
    result.push(arg);
  }
  return result;
}

// ── Commands ──────────────────────────────────────────

export function reviewMark(args: string[]): void {
  const cwd = process.cwd();
  const reviewer = parseFlag(args, "--reviewer");
  if (!reviewer) {
    console.error("--reviewer 필수");
    process.exit(1);
  }

  const aiModel = parseFlag(args, "--model");
  const notes = parseFlag(args, "--notes");
  const commit = parseFlag(args, "--commit");
  const patterns = positionalArgs(args);

  if (patterns.length === 0) {
    console.error("파일 경로 또는 glob 패턴을 지정하세요");
    process.exit(1);
  }

  const filePaths = expandGlobs(cwd, patterns);
  if (filePaths.length === 0) {
    console.error("매칭되는 파일이 없습니다");
    process.exit(1);
  }

  const ledger = createLedger(cwd);
  try {
    const result = ledger.mark({
      filePaths,
      reviewer,
      aiModel,
      commit,
      notes,
    });

    console.log(
      `리뷰 기록 완료: ${result.marked}건 기록, ${result.skipped}건 건너뜀 (커밋: ${result.commit.slice(0, 7)})`,
    );
  } finally {
    ledger.close();
  }
}

export function reviewStatus(args: string[]): void {
  const cwd = process.cwd();
  const scope = parseFlag(args, "--service");
  const stale = hasFlag(args, "--stale");
  const unreviewed = hasFlag(args, "--unreviewed");

  const ledger = createLedger(cwd);
  try {
    const statuses = ledger.statusAll({ scope, stale, unreviewed });

    if (statuses.length === 0) {
      console.log("표시할 파일이 없습니다");
      return;
    }

    // 상태별 카운트
    const counts = { reviewed: 0, stale: 0, unreviewed: 0 };
    for (const s of statuses) counts[s.status]++;

    console.log(
      `총 ${statuses.length}건 — reviewed: ${counts.reviewed}, stale: ${counts.stale}, unreviewed: ${counts.unreviewed}`,
    );
    console.log("");

    // stale/unreviewed만 표시 (전체 출력 시 너무 많을 수 있음)
    const needsAttention = statuses.filter(
      (s) => s.status === "stale" || s.status === "unreviewed",
    );

    if (needsAttention.length > 0) {
      const maxShow = 30;
      const shown = needsAttention.slice(0, maxShow);
      for (const s of shown) {
        const tag = s.status === "stale" ? "[stale]" : "[unreviewed]";
        const info = s.lastEntry
          ? `reviewed: ${s.lastEntry.reviewedCommit.slice(0, 7)} (${s.lastEntry.reviewer})`
          : "";
        console.log(`  ${tag} ${s.filePath}  ${info}`);
      }
      if (needsAttention.length > maxShow) {
        console.log(`  ... 외 ${needsAttention.length - maxShow}건`);
      }
    }
  } finally {
    ledger.close();
  }
}

export function reviewDashboard(_args: string[]): void {
  const cwd = process.cwd();
  const ledger = createLedger(cwd);
  try {
    const coverages = ledger.dashboard();

    if (coverages.length === 0) {
      console.log("리뷰 기록이 없습니다. 'qa-sdk review mark'로 시작하세요.");
      return;
    }

    // 테이블 헤더
    const header = padRow("Service", "Reviewed", "Stale", "Unreviewed", "Coverage");
    const sep = "─".repeat(header.length);

    console.log("");
    console.log(header);
    console.log(sep);

    let totalR = 0, totalS = 0, totalU = 0, totalT = 0;

    for (const c of coverages) {
      console.log(
        padRow(
          c.serviceScope,
          String(c.reviewed),
          String(c.stale),
          String(c.unreviewed),
          `${c.coveragePercent}%`,
        ),
      );
      totalR += c.reviewed;
      totalS += c.stale;
      totalU += c.unreviewed;
      totalT += c.total;
    }

    console.log(sep);
    const totalPct = totalT > 0 ? Math.round((totalR / totalT) * 1000) / 10 : 0;
    console.log(padRow("Total", String(totalR), String(totalS), String(totalU), `${totalPct}%`));
    console.log("");
  } finally {
    ledger.close();
  }
}

export function reviewLog(args: string[]): void {
  const file = args[0];
  if (!file) {
    console.error("파일 경로를 지정하세요");
    process.exit(1);
  }

  const cwd = process.cwd();
  const ledger = createLedger(cwd);
  try {
    const entries = ledger.history(file);

    if (entries.length === 0) {
      console.log(`${file}에 대한 리뷰 기록이 없습니다`);
      return;
    }

    console.log(`${file} 리뷰 이력 (${entries.length}건):\n`);
    for (const e of entries) {
      const model = e.aiModel ? ` [${e.aiModel}]` : "";
      const note = e.notes ? ` — ${e.notes}` : "";
      console.log(
        `  ${e.reviewedAt.slice(0, 16)}  ${e.reviewedCommit.slice(0, 7)}  ${e.reviewer}${model}${note}`,
      );
    }
  } finally {
    ledger.close();
  }
}

export async function reviewRequest(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const reviewer = parseFlag(args, "--reviewer");
  const purpose = parseFlag(args, "--purpose");
  const targetModel = parseFlag(args, "--model");
  const notes = parseFlag(args, "--notes");
  const scope = parseFlag(args, "--service");
  const dkgTarget = parseFlag(args, "--dkg-target");
  const json = hasFlag(args, "--json");
  const patterns = positionalArgs(args);

  if (!reviewer) {
    console.error("--reviewer 필수");
    process.exit(1);
  }
  if (!purpose) {
    console.error("--purpose 필수");
    process.exit(1);
  }
  if (!scope && patterns.length === 0) {
    console.error("파일 경로/glob 또는 --service 중 하나는 지정해야 합니다");
    process.exit(1);
  }

  const filePaths = patterns.length > 0 ? expandGlobs(cwd, patterns) : undefined;
  if (patterns.length > 0 && (!filePaths || filePaths.length === 0)) {
    console.error("매칭되는 파일이 없습니다");
    process.exit(1);
  }

  const ledger = createLedger(cwd);
  try {
    const relatedDocsByFile = filePaths
      ? await resolveRelatedDocsForFiles(cwd, filePaths)
      : {};

    const request = ledger.createFeedbackRequest({
      requestedBy: reviewer,
      purpose,
      targetModel: targetModel,
      serviceScope: scope,
      notes,
      filePaths,
      relatedDocsByFile,
    });

    const decisionId = parseFlag(args, "--decision-id");
    const decisionType = parseFlag(args, "--decision-type");
    const title = parseFlag(args, "--title");
    const rationale = parseFlag(args, "--rationale");

    const bridgeResult = dkgTarget
      ? bridgeFeedbackRequestToDkg(request, {
          targetId: dkgTarget,
          ...(decisionId ? { decisionId } : {}),
          ...(decisionType || title || rationale
            ? {
                decision: {
                  type: decisionType as NonNullable<Parameters<typeof bridgeFeedbackRequestToDkg>[1]["decision"]>["type"],
                  title: title ?? request.purpose,
                  rationale: rationale ?? request.prompt,
                },
              }
            : {}),
        })
      : null;

    if (json) {
      console.log(JSON.stringify({
        request,
        ...(bridgeResult ? { bridge: bridgeResult } : {}),
      }, null, 2));
      return;
    }

    console.log(`피드백 요청 생성: ${request.id}`);
    console.log(`  purpose: ${request.purpose}`);
    if (request.serviceScope) {
      console.log(`  scope: ${request.serviceScope}`);
    }
    console.log(
      `  evidence: total=${request.evidenceBundle.total}, stale=${request.evidenceBundle.stale}, unreviewed=${request.evidenceBundle.unreviewed}`,
    );
    if (bridgeResult) {
      console.log(`  dkg observation: ${bridgeResult.observationId}`);
      if (bridgeResult.decisionId) {
        console.log(`  dkg decision:    ${bridgeResult.decisionId}`);
      }
    }
    console.log("");
    console.log(request.prompt);
  } finally {
    ledger.close();
  }
}

export function reviewRequests(args: string[]): void {
  const cwd = process.cwd();
  const scope = parseFlag(args, "--service");
  const limit = Number.parseInt(parseFlag(args, "--limit") ?? "20", 10);
  const json = hasFlag(args, "--json");

  const ledger = createLedger(cwd);
  try {
    const requests = ledger.listFeedbackRequests({
      scope,
      limit: Number.isFinite(limit) ? limit : 20,
    });

    if (json) {
      console.log(JSON.stringify(requests, null, 2));
      return;
    }

    if (requests.length === 0) {
      console.log("피드백 요청이 없습니다");
      return;
    }

    for (const request of requests) {
      const model = request.targetModel ? ` [${request.targetModel}]` : "";
      const scopeLabel = request.serviceScope ? ` ${request.serviceScope}` : "";
      console.log(
        `${request.id}  ${request.createdAt.slice(0, 16)}${scopeLabel}${model}  ${request.purpose}`,
      );
    }
  } finally {
    ledger.close();
  }
}

export function reviewShowRequest(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.error("request id를 지정하세요");
    process.exit(1);
  }

  const cwd = process.cwd();
  const json = hasFlag(args, "--json");
  const ledger = createLedger(cwd);
  try {
    const request = ledger.getFeedbackRequest(id);

    if (!request) {
      console.error(`피드백 요청을 찾을 수 없습니다: ${id}`);
      process.exit(1);
    }

    if (json) {
      console.log(JSON.stringify(request, null, 2));
      return;
    }

    console.log(`${request.id} (${request.status})`);
    console.log(`purpose: ${request.purpose}`);
    console.log(`requestedBy: ${request.requestedBy}`);
    if (request.serviceScope) {
      console.log(`scope: ${request.serviceScope}`);
    }
    console.log(
      `evidence: total=${request.evidenceBundle.total}, reviewed=${request.evidenceBundle.reviewed}, stale=${request.evidenceBundle.stale}, unreviewed=${request.evidenceBundle.unreviewed}`,
    );
    console.log("");
    console.log(request.prompt);
  } finally {
    ledger.close();
  }
}

export function reviewBridgeRequest(args: string[]): void {
  const requestId = args[0];
  if (!requestId) {
    console.error("request id를 지정하세요");
    process.exit(1);
  }

  const targetId = parseFlag(args, "--target");
  if (!targetId) {
    console.error("--target 필수");
    process.exit(1);
  }

  const decisionId = parseFlag(args, "--decision-id");
  const decisionType = parseFlag(args, "--decision-type");
  const title = parseFlag(args, "--title");
  const rationale = parseFlag(args, "--rationale");

  const ledger = createLedger(process.cwd());
  try {
    const request = ledger.getFeedbackRequest(requestId);
    if (!request) {
      console.error(`피드백 요청을 찾을 수 없습니다: ${requestId}`);
      process.exit(1);
    }

    const result = bridgeFeedbackRequestToDkg(request, {
      targetId,
      ...(decisionId ? { decisionId } : {}),
      ...(decisionType || title || rationale
        ? {
            decision: {
              type: decisionType as NonNullable<Parameters<typeof bridgeFeedbackRequestToDkg>[1]["decision"]>["type"],
              title: title ?? request.purpose,
              rationale: rationale ?? request.prompt,
            },
          }
        : {}),
    });

    console.log(`피드백 요청 DKG 연결 완료: ${requestId}`);
    console.log(`  observation: ${result.observationId}`);
    console.log(`  target:      ${result.targetId}`);
    if (result.decisionId) {
      console.log(`  decision:    ${result.decisionId}`);
      console.log(`  mode:        ${result.createdDecision ? "created" : "linked"}`);
    } else {
      console.log("  mode:        observation-only");
    }
  } finally {
    ledger.close();
  }
}

// ── helpers ───────────────────────────────────────────

function padRow(
  svc: string,
  reviewed: string,
  stale: string,
  unreviewed: string,
  coverage: string,
): string {
  return [
    svc.padEnd(25),
    reviewed.padStart(8),
    stale.padStart(8),
    unreviewed.padStart(12),
    coverage.padStart(10),
  ].join("  ");
}
