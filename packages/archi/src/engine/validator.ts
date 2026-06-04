import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, relative, resolve } from "node:path";
import yaml from "js-yaml";

// 검증 결과 타입 정의
export interface CheckResult {
  ok: boolean;
  message: string;
}

export interface RuleResult {
  ruleId: string;
  name: string;
  category: string;
  severity: "error" | "warning" | "info";
  results: CheckResult[];
}

export interface ValidationSummary {
  pass: number;
  fail: number;
  warn: number;
  total: number;
}

export interface ValidationContext {
  govDocs: Array<{
    path: string;
    content: string;
    frontmatter: any;
  }>;
  model: {
    scopes: string[];
    elements: string[];
    relations: Array<{ id: string; source: string; target: string }>;
    views: Array<{ id: string; elements: string[]; relations: string[] }>;
  };
}

// 헬퍼: 파일 탐색
export function findFilesRecursively(dir: string, ext = ".md"): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(d: string) {
    const list = readdirSync(d);
    for (const entry of list) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile() && entry.endsWith(ext) && entry !== ".gitkeep") {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// 안전한 YAML frontmatter 파서
export function parseFrontmatter(content: string): any {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    const res: any = yaml.load(match[1]);
    if (res && res.date instanceof Date) {
      const d = res.date;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      res.date = `${yyyy}-${mm}-${dd}`;
    }
    return res;
  } catch {
    return null;
  }
}

// 모델 파서 (archi-adr.yaml)
export function parseModel(modelYaml: string): ValidationContext["model"] {
  const result: ValidationContext["model"] = {
    scopes: [],
    elements: [],
    relations: [],
    views: [],
  };

  if (!modelYaml) return result;

  try {
    const parsed: any = yaml.load(modelYaml);
    if (!parsed) return result;

    if (Array.isArray(parsed.scopes)) {
      result.scopes = parsed.scopes.map((s: any) => s.id).filter(Boolean);
    }
    if (Array.isArray(parsed.elements)) {
      result.elements = parsed.elements.map((e: any) => e.id).filter(Boolean);
    }
    if (Array.isArray(parsed.relations)) {
      result.relations = parsed.relations
        .map((r: any) => ({
          id: r.id,
          source: r.source,
          target: r.target,
        }))
        .filter((r: any) => r.id && r.source && r.target);
    }
    if (Array.isArray(parsed.views)) {
      result.views = parsed.views
        .map((v: any) => ({
          id: v.id,
          elements: Array.isArray(v.elements) ? v.elements : [],
          relations: Array.isArray(v.relations) ? v.relations : [],
        }))
        .filter((v: any) => v.id);
    }
  } catch (err) {
    console.error("모델 파싱 중 에러 발생:", err);
  }

  return result;
}

// 규칙 메타데이터 정의
export const RULE_META: Record<string, { name: string; category: string; severity: "error" | "warning" | "info" }> = {
  "SR-001": {
    name: "unique-current",
    category: "governance/structure",
    severity: "error",
  },
  "SR-003": {
    name: "session-timeline-registration",
    category: "governance/content",
    severity: "error",
  },
  "SR-004": {
    name: "handoff-next-actions",
    category: "governance/content",
    severity: "error",
  },
  "SR-005": {
    name: "history-index-completeness",
    category: "governance/content",
    severity: "error",
  },
  "SR-006": {
    name: "active-current-alignment",
    category: "governance/lifecycle",
    severity: "warning",
  },
  "SR-010": {
    name: "timeline-append-only",
    category: "governance/content",
    severity: "error",
  },
  "SR-011": {
    name: "scope-reference-valid",
    category: "governance/lifecycle",
    severity: "error",
  },
  "SR-013": {
    name: "relation-source-target-valid",
    category: "model/integrity",
    severity: "error",
  },
  "SR-014": {
    name: "view-element-exists",
    category: "model/integrity",
    severity: "error",
  },
  "SR-015": {
    name: "group-module-child-required",
    category: "governance/structure",
    severity: "error",
  },
  "SR-016": {
    name: "leaf-line-size-limit",
    category: "governance/structure",
    severity: "warning",
  },
  "SR-FRONTMATTER": {
    name: "frontmatter-required-fields",
    category: "governance/structure",
    severity: "error",
  },
};

// 12대 검증기 구현 목록
export const VALIDATORS: Record<string, (ctx: ValidationContext, docsRoot: string) => CheckResult[]> = {
  "SR-001"(_, docsRoot) {
    const areas = ["roadmap", "prd", "progress", "handoff"];
    const results: CheckResult[] = [];
    const govRoot = join(docsRoot, "docs", "governance");

    for (const area of areas) {
      const dir = join(govRoot, area);
      if (!existsSync(dir)) {
        results.push({ ok: false, message: `${area}/: 디렉토리가 존재하지 않습니다.` });
        continue;
      }
      const currents = readdirSync(dir).filter((f) => f === "current.md");
      if (currents.length === 0) {
        results.push({ ok: false, message: `${area}/: current.md가 존재하지 않습니다.` });
      } else if (currents.length > 1) {
        results.push({ ok: false, message: `${area}/: current.md가 ${currents.length}개 존재합니다.` });
      } else {
        results.push({ ok: true, message: `${area}/current.md: 정상` });
      }
    }
    return results;
  },

  "SR-003"(ctx, docsRoot) {
    const results: CheckResult[] = [];
    const timelinePath = join(docsRoot, "docs", "governance", "timeline.md");
    if (!existsSync(timelinePath)) {
      return [{ ok: false, message: "timeline.md 파일이 존재하지 않습니다." }];
    }

    const timelineContent = readFileSync(timelinePath, "utf-8");
    let hasSessions = false;

    for (const doc of ctx.govDocs) {
      if (doc.frontmatter?.type !== "SessionHistoryDocument") continue;
      hasSessions = true;
      const id = doc.frontmatter.id;
      if (!id) {
        results.push({ ok: false, message: `${relative(docsRoot, doc.path)}: frontmatter에 id가 누락되었습니다.` });
        continue;
      }

      const isRegistered = timelineContent.includes(id);
      results.push({
        ok: isRegistered,
        message: `${id}: timeline에 ${isRegistered ? "등록됨" : "미등록"}`
      });
    }

    if (!hasSessions) {
      results.push({ ok: true, message: "등록된 세션 문서가 없습니다 (Skip)." });
    }

    return results;
  },

  "SR-004"(ctx, docsRoot) {
    const results: CheckResult[] = [];
    for (const doc of ctx.govDocs) {
      if (doc.frontmatter?.type !== "HandoffDocument") continue;
      const hasSection = doc.content.includes("## Next Recommended Actions");
      results.push({
        ok: hasSection,
        message: `${relative(docsRoot, doc.path)}: ${hasSection ? "Next Recommended Actions 섹션 존재" : "## Next Recommended Actions 섹션 누락"}`
      });
    }
    return results;
  },

  "SR-005"(ctx, docsRoot) {
    const results: CheckResult[] = [];
    for (const doc of ctx.govDocs) {
      if (doc.frontmatter?.type !== "HistoryIndexDocument") continue;
      const hasKeys = doc.content.includes("### Key Decisions");
      const hasFiles = doc.content.includes("### Important Files");

      if (!hasKeys) {
        results.push({ ok: false, message: `${relative(docsRoot, doc.path)}: ### Key Decisions 섹션 누락` });
      }
      if (!hasFiles) {
        results.push({ ok: false, message: `${relative(docsRoot, doc.path)}: ### Important Files 섹션 누락` });
      }
      if (hasKeys && hasFiles) {
        results.push({ ok: true, message: `${relative(docsRoot, doc.path)}: 필수 섹션 모두 존재` });
      }
    }
    return results;
  },

  "SR-006"(ctx, docsRoot) {
    const results: CheckResult[] = [];
    for (const doc of ctx.govDocs) {
      if (!doc.frontmatter) continue;
      const state = doc.frontmatter.lifecycle?.state;
      if (state !== "active") continue;

      const filename = basename(doc.path);
      const isCurrent = filename === "current.md";
      const isTimelineOrIndex = filename === "timeline.md" || filename === "history-index.md";

      if (isCurrent || isTimelineOrIndex) {
        results.push({
          ok: true,
          message: `${relative(docsRoot, doc.path)}: active 상태이며 current/timeline 위치 정상`
        });
      } else {
        results.push({
          ok: false,
          message: `${relative(docsRoot, doc.path)}: active 상태이지만 current.md 또는 특수 문서가 아님 (과거 스냅샷은 resolved/archived 상태여야 함)`
        });
      }
    }
    return results;
  },

  "SR-010"(_, docsRoot) {
    const timelinePath = join(docsRoot, "docs", "governance", "timeline.md");
    if (!existsSync(timelinePath)) {
      return [{ ok: false, message: "timeline.md 파일이 존재하지 않습니다." }];
    }

    const content = readFileSync(timelinePath, "utf-8");
    const matches = [...content.matchAll(/^## (\d{4}-\d{2}-\d{2})/gm)];
    const dates = matches.map((m) => m[1]);

    if (dates.length === 0) {
      return [{ ok: true, message: "timeline.md: 등록된 이벤트 날짜가 없습니다." }];
    }

    const sorted = [...dates].sort();
    const isChronological = dates.every((d, idx) => d === sorted[idx]);

    return [{
      ok: isChronological,
      message: isChronological
        ? `timeline.md: ${dates.length}개 날짜 시간순 정렬 준수`
        : `timeline.md: 시간순 위반 — 감지된 순서: [${dates.join(", ")}]`
    }];
  },

  "SR-011"(ctx, docsRoot) {
    const results: CheckResult[] = [];
    const validScopes = new Set(ctx.model.scopes);

    for (const doc of ctx.govDocs) {
      if (!doc.frontmatter?.scope) continue;
      const scope = doc.frontmatter.scope;
      const isValid = validScopes.has(scope);
      results.push({
        ok: isValid,
        message: `${relative(docsRoot, doc.path)}: scope='${scope}'는 모델에 ${isValid ? "존재함 (유효)" : "존재하지 않음 (오류)"}`
      });
    }
    return results;
  },

  "SR-013"(ctx) {
    const results: CheckResult[] = [];
    const elements = new Set(ctx.model.elements);

    if (ctx.model.relations.length === 0) {
      return [{ ok: true, message: "모델에 정의된 Relation이 없습니다." }];
    }

    for (const rel of ctx.model.relations) {
      const isSrcValid = elements.has(rel.source);
      const isTgtValid = elements.has(rel.target);

      if (!isSrcValid) {
        results.push({ ok: false, message: `Relation '${rel.id}': source='${rel.source}'가 존재하지 않는 Element입니다.` });
      }
      if (!isTgtValid) {
        results.push({ ok: false, message: `Relation '${rel.id}': target='${rel.target}'가 존재하지 않는 Element입니다.` });
      }
      if (isSrcValid && isTgtValid) {
        results.push({ ok: true, message: `Relation '${rel.id}': 양단 Element 존재함 (유효)` });
      }
    }
    return results;
  },

  "SR-014"(ctx) {
    const results: CheckResult[] = [];
    const elements = new Set(ctx.model.elements);
    const relations = new Set(ctx.model.relations.map((r) => r.id));

    if (ctx.model.views.length === 0) {
      return [{ ok: true, message: "모델에 정의된 View가 없습니다." }];
    }

    for (const view of ctx.model.views) {
      let isViewOk = true;
      for (const el of view.elements) {
        if (!elements.has(el)) {
          isViewOk = false;
          results.push({ ok: false, message: `View '${view.id}': element='${el}'가 존재하지 않는 Element입니다.` });
        }
      }
      for (const rel of view.relations) {
        if (!relations.has(rel)) {
          isViewOk = false;
          results.push({ ok: false, message: `View '${view.id}': relation='${rel}'가 존재하지 않는 Relation입니다.` });
        }
      }
      if (isViewOk) {
        results.push({
          ok: true,
          message: `View '${view.id}': 참조 중인 ${view.elements.length}개 Element 및 ${view.relations.length}개 Relation 모두 존재함 (유효)`
        });
      }
    }
    return results;
  },

  // SR-015: DefLevel 검증 (group/module 레벨 문서는 links 내에 contains 자식 참조가 1개 이상 필수)
  "SR-015"(ctx, docsRoot) {
    const results: CheckResult[] = [];
    let hasGroupOrModule = false;

    for (const doc of ctx.govDocs) {
      const def = doc.frontmatter?.def || doc.frontmatter;
      const level = def?.level;
      if (level !== "group" && level !== "module") continue;
      hasGroupOrModule = true;

      const links = doc.frontmatter?.links || def?.links || [];
      const hasContains = Array.isArray(links) && links.some((l: any) => l.type === "contains" && l.target);

      results.push({
        ok: hasContains,
        message: `${relative(docsRoot, doc.path)}: [level=${level}] 자식을 포함하는 'contains' 링크가 ${hasContains ? "존재함 (정상)" : "존재하지 않음 (누락 오류)"}`
      });
    }

    if (!hasGroupOrModule) {
      results.push({ ok: true, message: "group 또는 module 수준의 분할 문서가 없습니다 (Skip)." });
    }

    return results;
  },

  // SR-016: leaf/단독 문서의 150줄 제한 검증 (내용 분할 정합성 권고)
  "SR-016"(ctx, docsRoot) {
    const results: CheckResult[] = [];

    for (const doc of ctx.govDocs) {
      const def = doc.frontmatter?.def || doc.frontmatter;
      const level = def?.level || "leaf";
      if (level !== "leaf") continue;

      const lines = doc.content.split("\n").length;
      const isUnderLimit = lines <= 150;

      results.push({
        ok: isUnderLimit,
        message: `${relative(docsRoot, doc.path)}: 종단(leaf) 문서의 총 라인 수가 ${lines}줄로 ${isUnderLimit ? "기준치(150줄 이하) 충족" : "기준치(150줄 초과) 초과로 분할 권장 (Warning)"}`
      });
    }
    return results;
  },

  "SR-FRONTMATTER"(ctx, docsRoot) {
    const results: CheckResult[] = [];
    const required = ["id", "type", "title", "date", "lifecycle"];

    for (const doc of ctx.govDocs) {
      if (!doc.frontmatter) {
        results.push({
          ok: false,
          message: `${relative(docsRoot, doc.path)}: frontmatter(---) 영역이 존재하지 않거나 무효합니다.`
        });
        continue;
      }

      const missing = required.filter((k) => !doc.frontmatter[k]);
      if (missing.length > 0) {
        results.push({
          ok: false,
          message: `${relative(docsRoot, doc.path)}: frontmatter 필수 필드 누락 — [${missing.join(", ")}]`
        });
      } else {
        results.push({
          ok: true,
          message: `${relative(docsRoot, doc.path)}: 기본 필수 필드 존재함 (유효)`
        });
      }
    }
    return results;
  }
};

// 메인 검증 수행 함수
export function validateArchitecture(docsRoot: string): {
  summary: ValidationSummary;
  details: RuleResult[];
} {
  const govRoot = join(docsRoot, "docs", "governance");
  const modelPath = join(docsRoot, "model", "archi-adr.yaml");

  const govFiles = findFilesRecursively(govRoot, ".md");
  const govDocs = govFiles.map((file) => {
    const content = readFileSync(file, "utf-8");
    return {
      path: file,
      content,
      frontmatter: parseFrontmatter(content),
    };
  });

  const modelContent = existsSync(modelPath) ? readFileSync(modelPath, "utf-8") : "";
  const model = parseModel(modelContent);

  const ctx: ValidationContext = { govDocs, model };

  const details: RuleResult[] = [];
  const summary: ValidationSummary = { pass: 0, fail: 0, warn: 0, total: 0 };

  for (const ruleId of Object.keys(VALIDATORS)) {
    const meta = RULE_META[ruleId] || { name: ruleId, category: "unknown", severity: "error" as const };
    const results = VALIDATORS[ruleId](ctx, docsRoot);

    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    summary.total += results.length;
    summary.pass += passed;

    if (meta.severity === "error") {
      summary.fail += failed;
    } else if (meta.severity === "warning") {
      summary.warn += failed;
    }

    details.push({
      ruleId,
      name: meta.name,
      category: meta.category,
      severity: meta.severity,
      results,
    });
  }

  return { summary, details };
}
