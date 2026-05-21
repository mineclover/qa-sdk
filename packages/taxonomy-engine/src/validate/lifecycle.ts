import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export type LifecycleValidateOptions = {
  /** lifecycle 누락을 error로 강등. 기본 false (warning). */
  lifecycleStrict?: boolean;
  /** 상대 path decisionLink 해소 기준 디렉토리. 미지정 시 path 검증 skip. */
  decisionLinkBaseDir?: string;
};

export function validateLifecycle(
  ir: TaxonomyIR,
  opts: LifecycleValidateOptions = {},
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const missingSeverity = opts.lifecycleStrict ? "error" : "warning";
  let tbdCount = 0;

  for (const [axisName, axis] of ir.axes) {
    if (axis.lifecycle === undefined) {
      diags.push({
        severity: missingSeverity,
        code: "lifecycle-missing",
        message: `axis "${axisName}"에 lifecycle 없음`,
        ref: `${ir.taxonomy}:${axisName}`,
        hint: "lifecycle: <draft|review|approved|deprecated|archived|tbd> 추가",
      });
    }
    for (const entry of axis.entries) {
      if (entry.lifecycle === undefined) {
        diags.push({
          severity: missingSeverity,
          code: "lifecycle-missing",
          message: `entry "${axisName}.${entry.id}"에 lifecycle 없음`,
          ref: `${ir.taxonomy}:${axisName}.${entry.id}`,
          hint: "lifecycle: <value> 추가",
        });
        continue;
      }
      if (entry.lifecycle === "tbd") {
        tbdCount++;
        if (!entry.placeholderReason && !entry.decisionLink) {
          diags.push({
            severity: "info",
            code: "lifecycle-tbd-orphan",
            message: `tbd entry "${axisName}.${entry.id}"에 placeholderReason 또는 decisionLink 없음`,
            ref: `${ir.taxonomy}:${axisName}.${entry.id}`,
            hint: "placeholderReason 한 줄 또는 decisionLink 추가",
          });
        }
      }
      if (entry.decisionLink) {
        const reason = brokenReason(entry.decisionLink, opts.decisionLinkBaseDir);
        if (reason) {
          diags.push({
            severity: "warning",
            code: "decision-link-broken",
            message: `decisionLink 해소 실패: ${entry.decisionLink} (${reason})`,
            ref: `${ir.taxonomy}:${axisName}.${entry.id}`,
            hint: "파일/URI 확인",
          });
        }
      }
    }
  }

  if (tbdCount > 0) {
    diags.push({
      severity: "info",
      code: "lifecycle-tbd",
      message: `placeholder(tbd) entry ${tbdCount}건`,
      meta: { count: tbdCount },
    });
  }

  return diags;
}

function brokenReason(link: string, baseDir?: string): string | null {
  if (link.startsWith("decision-flow://")) return "Stage 3 미지원";
  if (link.startsWith("http://") || link.startsWith("https://")) return null;
  if (link.startsWith("tax:")) return null;
  // 그 외 path로 처리
  if (!baseDir) return null;
  const abs = isAbsolute(link) ? link : resolve(baseDir, link);
  return existsSync(abs) ? null : "파일 없음";
}
