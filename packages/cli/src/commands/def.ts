/**
 * qa-sdk def — definition-catalog 문서 관리 CLI.
 *
 * 문서 스캔, 탑다운 조립, 바텀업 역추적, 컨텍스트 조회,
 * 품질 감사, 정합성 검증, 통계를 제공한다.
 *
 * Usage:
 *   qa-sdk def scan                  — docs/ 스캔 → 문서/링크 수 출력
 *   qa-sdk def topdown <그룹ID>      — 그룹 멤버 purpose 조립
 *   qa-sdk def bottomup <문서ID>     — 변경 시 영향 범위
 *   qa-sdk def context <문서ID>      — 작업 전 컨텍스트
 *   qa-sdk def audit                 — 품질 리포트
 *   qa-sdk def validate              — 깨진 링크/순환 검증
 *   qa-sdk def stats                 — scope/depth/lifecycle 분포
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import {
  scanAndBuild,
  extractFrontmatter,
  topdown,
  bottomup,
  context,
  validateGraph,
  computeEffectiveConcerns,
  extractByLevel,
  type ScanResult,
} from "definition-catalog";

// ── 유틸 ──────────────────────────────────────────────

function getRootDir(): string {
  return process.cwd();
}

async function scan(): Promise<ScanResult> {
  const root = getRootDir();
  return scanAndBuild(root, [join(root, "docs")]);
}

async function loadBodies(result: ScanResult, root: string): Promise<Map<string, string>> {
  const bodies = new Map<string, string>();
  for (const entry of result.registry.all()) {
    if (!entry.ref) continue;
    try {
      const content = await readFile(join(root, entry.ref), "utf-8");
      const fm = extractFrontmatter(content);
      if (fm) bodies.set(entry.id, fm.body);
    } catch { /* skip */ }
  }
  return bodies;
}

// ── 커맨드 ────────────────────────────────────────────

export async function cliDefScan(): Promise<void> {
  const result = await scan();
  console.log(`스캔 완료: ${result.registered}건 등록, ${result.linked}건 링크`);
  if (result.errors.length > 0) {
    console.log(`\n파싱 에러 ${result.errors.length}건:`);
    result.errors.slice(0, 5).forEach(e => console.log(`  ${e.file}: ${e.error}`));
    if (result.errors.length > 5) console.log(`  ... 외 ${result.errors.length - 5}건`);
  }
  if (result.linkErrors.length > 0) {
    console.log(`\n링크 에러 ${result.linkErrors.length}건:`);
    result.linkErrors.slice(0, 5).forEach(e => console.log(`  ${e.source} → ${e.target}: ${e.error}`));
  }
}

export async function cliDefTopdown(groupId: string, level: "purpose" | "overview" = "purpose"): Promise<void> {
  const root = getRootDir();
  const text = await topdown(root, groupId, level);
  console.log(text);
}

export async function cliDefBottomup(docId: string): Promise<void> {
  const root = getRootDir();
  const text = await bottomup(root, docId);
  console.log(text);
}

export async function cliDefContext(docId: string): Promise<void> {
  const root = getRootDir();
  const text = await context(root, docId);
  console.log(text);
}

export async function cliDefAudit(): Promise<void> {
  const result = await scan();
  const root = getRootDir();
  const bodies = await loadBodies(result, root);
  const reg = result.registry;

  let total = 0, withPurpose = 0, withLinks = 0, withTags = 0;
  let shortPurpose = 0, noOverviewGroup = 0;
  const issues: string[] = [];

  for (const entry of reg.all()) {
    if (entry.lifecycle === "deprecated") continue;
    total++;

    const body = bodies.get(entry.id);
    if (body) {
      const p = extractByLevel(body, "purpose");
      if (p.text.length > 0) withPurpose++;
      else issues.push(`[high] ${entry.id}: ^purpose 없음`);

      if (p.text.length > 0 && p.text.length < 30) {
        shortPurpose++;
        issues.push(`[medium] ${entry.id}: purpose 짧음 (${p.text.length}자)`);
      }
    }

    const outgoing = reg.getLinks(entry.id, "outgoing");
    const isGroup = outgoing.some(l => l.linkType === "contains");
    if (outgoing.some(l => l.linkType !== "contains")) withLinks++;
    else if (!isGroup) issues.push(`[medium] ${entry.id}: links 없음`);

    if (entry.tags && entry.tags.length > 0) withTags++;

    if (isGroup && body && !body.includes("^overview")) {
      noOverviewGroup++;
      issues.push(`[low] ${entry.id}: 그룹인데 ^overview 없음`);
    }
  }

  console.log(`=== 문서 품질 리포트 ===\n`);
  console.log(`총 approved: ${total}건`);
  console.log(`^purpose:    ${withPurpose}/${total} (${Math.round(withPurpose / total * 100)}%)`);
  console.log(`links 있음:  ${withLinks}/${total} (${Math.round(withLinks / total * 100)}%)`);
  console.log(`tags 있음:   ${withTags}/${total} (${Math.round(withTags / total * 100)}%)`);
  console.log(`purpose 짧음: ${shortPurpose}건`);
  console.log(`그룹 ^overview 없음: ${noOverviewGroup}건`);

  if (issues.length > 0) {
    console.log(`\n=== 이슈 ${issues.length}건 ===`);
    const high = issues.filter(i => i.startsWith("[high]"));
    const medium = issues.filter(i => i.startsWith("[medium]"));
    const low = issues.filter(i => i.startsWith("[low]"));

    if (high.length > 0) {
      console.log(`\n[high] ${high.length}건`);
      high.slice(0, 5).forEach(i => console.log(`  ${i}`));
      if (high.length > 5) console.log(`  ... 외 ${high.length - 5}건`);
    }
    if (medium.length > 0) {
      console.log(`\n[medium] ${medium.length}건`);
      medium.slice(0, 10).forEach(i => console.log(`  ${i}`));
      if (medium.length > 10) console.log(`  ... 외 ${medium.length - 10}건`);
    }
    if (low.length > 0) {
      console.log(`\n[low] ${low.length}건`);
      low.slice(0, 5).forEach(i => console.log(`  ${i}`));
    }
  }
}

export async function cliDefValidate(): Promise<void> {
  const result = await scan();
  const validation = validateGraph(result.registry);

  if (validation.passed) {
    console.log(`✓ 검증 통과 (경고 ${validation.warnings}건)`);
  } else {
    console.log(`✗ 검증 실패 — 에러 ${validation.errors}건, 경고 ${validation.warnings}건`);
  }

  if (validation.issues.length > 0) {
    const errors = validation.issues.filter(i => i.severity === "error");
    const warnings = validation.issues.filter(i => i.severity === "warning");

    if (errors.length > 0) {
      console.log(`\n[error] ${errors.length}건:`);
      errors.slice(0, 10).forEach(i => console.log(`  ${i.docId}: ${i.message}`));
      if (errors.length > 10) console.log(`  ... 외 ${errors.length - 10}건`);
    }
    if (warnings.length > 0) {
      console.log(`\n[warning] ${warnings.length}건:`);
      warnings.slice(0, 5).forEach(i => console.log(`  ${i.docId}: ${i.message}`));
      if (warnings.length > 5) console.log(`  ... 외 ${warnings.length - 5}건`);
    }
  }
}

export async function cliDefStats(): Promise<void> {
  const result = await scan();
  const reg = result.registry;
  const all = reg.all();

  const approved = all.filter(e => e.lifecycle === "approved");
  const deprecated = all.filter(e => e.lifecycle === "deprecated");

  const byScope: Record<string, number> = {};
  const byDepth: Record<string, number> = {};
  const byAspect: Record<string, number> = {};
  const groups: string[] = [];

  for (const e of approved) {
    byScope[e.scope] = (byScope[e.scope] || 0) + 1;
    byDepth[e.depth] = (byDepth[e.depth] || 0) + 1;
    byAspect[e.aspect] = (byAspect[e.aspect] || 0) + 1;

    const outgoing = reg.getLinks(e.id, "outgoing");
    if (outgoing.some(l => l.linkType === "contains")) groups.push(e.id);
  }

  console.log(`=== 문서 통계 ===\n`);
  console.log(`총: ${all.length}건 (approved: ${approved.length}, deprecated: ${deprecated.length})`);
  console.log(`그룹: ${groups.length}건\n`);

  console.log(`scope 분포:`);
  Object.entries(byScope).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log(`\ndepth 분포:`);
  Object.entries(byDepth).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log(`\naspect 상위 10:`);
  Object.entries(byAspect).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log(`\n그룹 목록:`);
  groups.forEach(g => {
    const members = reg.getLinks(g, "outgoing").filter(l => l.linkType === "contains").length;
    console.log(`  ${g} (${members} members)`);
  });
}

export async function cliDefRead(docId: string): Promise<void> {
  const root = getRootDir();
  const result = await scan();
  const entry = result.registry.get(docId);
  if (!entry || !entry.ref) {
    console.log(`문서 "${docId}"를 찾을 수 없습니다.`);
    return;
  }

  const content = await readFile(join(root, entry.ref), "utf-8");
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  if (!fmMatch) { console.log("frontmatter 파싱 실패"); return; }

  // 마커 제거하고 본문 출력
  const body = fmMatch[1].replace(/\s*\^[a-z][a-z0-9-]*\s*$/gm, "");
  console.log(body);
}

export async function cliDefSync(serviceUrl: string, docId: string): Promise<void> {
  // 1. OpenAPI JSON fetch
  const openapiUrl = serviceUrl.replace(/\/$/, "") + "/openapi.json";
  console.log(`OpenAPI 스펙 가져오기: ${openapiUrl}`);

  let spec: any;
  try {
    const resp = await fetch(openapiUrl, { signal: AbortSignal.timeout(5_000) });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    spec = await resp.json();
  } catch (e) {
    // 서버가 안 떠있으면 로컬 파일에서 시도
    const localPath = join(getRootDir(), serviceUrl);
    try {
      spec = JSON.parse(await readFile(localPath, "utf-8"));
      console.log(`로컬 파일에서 로드: ${localPath}`);
    } catch {
      console.log(`OpenAPI 스펙을 가져올 수 없습니다: ${(e as Error).message}`);
      console.log(`서버 URL 또는 로컬 JSON 경로를 확인하세요.`);
      return;
    }
  }

  // 2. 엔드포인트 추출
  const paths = spec.paths || {};
  const endpoints: string[] = [];

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, detail] of Object.entries(methods as Record<string, any>)) {
      if (["get", "post", "put", "delete", "patch"].includes(method)) {
        const summary = detail.summary || "";
        const line = `${method.toUpperCase()} ${path}` + (summary ? ` — ${summary}` : "");
        endpoints.push(line);
      }
    }
  }

  console.log(`\n${endpoints.length}개 엔드포인트 추출됨:\n`);
  endpoints.forEach(e => console.log(`  ${e}`));

  // 3. 대상 문서 찾기
  const root = getRootDir();
  const result = await scan();
  const entry = result.registry.get(docId);
  if (!entry || !entry.ref) {
    console.log(`\n문서 "${docId}"를 찾을 수 없습니다.`);
    return;
  }

  const docPath = join(root, entry.ref);
  const content = await readFile(docPath, "utf-8");

  // 4. ^endpoints 섹션 생성
  const endpointSection = `## 엔드포인트 ^endpoints\n\n<!-- auto-generated from OpenAPI: ${spec.info?.title || "unknown"} v${spec.info?.version || "?"} -->\n\n${endpoints.map(e => `- ${e}`).join("\n")}\n`;

  // 5. 기존 ^endpoints 교체 또는 추가
  const { writeFile } = await import("node:fs/promises");
  let updated: string;

  if (content.includes("^endpoints")) {
    // 기존 섹션 교체
    const lines = content.split("\n");
    const newLines: string[] = [];
    let skipping = false;

    for (const line of lines) {
      if (/^## .*\^endpoints/.test(line)) {
        skipping = true;
        newLines.push(endpointSection);
        continue;
      }
      if (skipping && /^## /.test(line)) {
        skipping = false;
      }
      if (!skipping) {
        newLines.push(line);
      }
    }
    updated = newLines.join("\n");
  } else {
    // 문서 끝에 추가
    updated = content.trimEnd() + "\n\n" + endpointSection;
  }

  await writeFile(docPath, updated, "utf-8");
  console.log(`\n✓ ${entry.ref}에 ^endpoints 섹션 갱신 (${endpoints.length}개)`);
}

// ── 라우터 ────────────────────────────────────────────

export async function cliDef(args: string[]): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  switch (sub) {
    case "scan":
      return cliDefScan();
    case "topdown":
      if (!rest[0]) { console.log("Usage: qa-sdk def topdown <그룹ID> [--overview]"); return; }
      return cliDefTopdown(rest[0], rest.includes("--overview") ? "overview" : "purpose");
    case "bottomup":
      if (!rest[0]) { console.log("Usage: qa-sdk def bottomup <문서ID>"); return; }
      return cliDefBottomup(rest[0]);
    case "context":
      if (!rest[0]) { console.log("Usage: qa-sdk def context <문서ID>"); return; }
      return cliDefContext(rest[0]);
    case "audit":
      return cliDefAudit();
    case "validate":
      return cliDefValidate();
    case "stats":
      return cliDefStats();
    case "sync":
      if (rest.length < 2) { console.log("Usage: qa-sdk def sync <openapi-url-or-file> <문서ID>"); return; }
      return cliDefSync(rest[0], rest[1]);
    case "read":
      if (!rest[0]) { console.log("Usage: qa-sdk def read <문서ID>"); return; }
      return cliDefRead(rest[0]);
    default:
      console.log(`qa-sdk def — 문서 관리

사용법:
  qa-sdk def scan                  스캔 (문서/링크 수)
  qa-sdk def topdown <그룹ID>      탑다운 조립
  qa-sdk def bottomup <문서ID>     영향 역추적
  qa-sdk def context <문서ID>      작업 전 컨텍스트
  qa-sdk def audit                 품질 리포트
  qa-sdk def validate              깨진 링크/순환 검증
  qa-sdk def stats                 분포 통계
  qa-sdk def read <문서ID>         문서 전문 읽기
  qa-sdk def sync <url|file> <ID>  OpenAPI → 문서 ^endpoints 갱신`);
  }
}
