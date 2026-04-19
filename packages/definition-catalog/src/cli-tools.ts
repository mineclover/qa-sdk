// @def.doc definition-catalog-spec

/**
 * CLI 도구 — 탑다운 조립, 바텀업 역추적, 컨텍스트 조회
 *
 * 스킬(def-topdown, def-bottomup, def-context)이 내부적으로 사용하는 유틸.
 * scanAndBuild로 registry를 구성한 뒤, 이 함수들로 조회한다.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MemoryDefinitionRegistry } from "./registry.js";
import { scanAndBuild, extractFrontmatter } from "./frontmatter.js";
import { extractByLevel, extractByMarker } from "./extract.js";
import { assembleBoundary, assembleFeature } from "./assemble.js";
import { analyzeImpact, selectImpactContext } from "./impact.js";
import { computeEffectiveConcerns, selectConcernContext } from "./concern.js";

/** 문서 본문 캐시 구성 — 모든 frontmatter 문서의 body를 로드 */
async function loadBodies(
  registry: MemoryDefinitionRegistry,
  rootDir: string,
): Promise<Map<string, string>> {
  const bodies = new Map<string, string>();

  // 1차: registry에서 ref 경로로 로드
  for (const entry of registry.all()) {
    if (!entry.ref) continue;
    try {
      const content = await readFile(join(rootDir, entry.ref), "utf-8");
      const fm = extractFrontmatter(content);
      if (fm && fm.body.trim().length > 0) bodies.set(entry.id, fm.body);
    } catch { /* skip */ }
  }

  // 2차: body가 비어있는 entry에 대해 재시도 (deprecated가 아닌 파일에서)
  for (const entry of registry.all()) {
    if (bodies.get(entry.id)?.includes("^purpose")) continue;
    if (!entry.ref) continue;
    try {
      const content = await readFile(join(rootDir, entry.ref), "utf-8");
      const fm = extractFrontmatter(content);
      if (fm && fm.body.includes("^purpose")) {
        bodies.set(entry.id, fm.body);
      }
    } catch { /* skip */ }
  }

  return bodies;
}

/** 탑다운 조립 결과 (텍스트) */
export async function topdown(
  rootDir: string,
  groupId: string,
  level: "purpose" | "overview" = "purpose",
): Promise<string> {
  const result = await scanAndBuild(rootDir, [join(rootDir, "docs")]);
  const bodies = await loadBodies(result.registry, rootDir);

  const assembled = assembleFeature(
    groupId,
    id => result.registry.get(id),
    (id, dir) => result.registry.getLinks(id, dir),
    id => bodies.get(id),
    level,
  );

  if (!assembled) return `그룹 문서 "${groupId}"를 찾을 수 없습니다.`;
  return assembled.text;
}

/** 바텀업 역추적 결과 (텍스트) */
export async function bottomup(
  rootDir: string,
  docId: string,
): Promise<string> {
  const result = await scanAndBuild(rootDir, [join(rootDir, "docs")]);
  const impact = analyzeImpact(
    docId,
    id => result.registry.get(id),
    (id, dir) => result.registry.getLinks(id, dir),
  );

  if (impact.blastRadius === 0) {
    return `# 영향 분석: ${docId}\n\nblast radius: 0건 (영향받는 문서 없음)`;
  }

  const lines = [`# 영향 분석: ${docId}`, ``, `blast radius: ${impact.blastRadius}건`, ``];

  if (impact.affectedGroups.length > 0) {
    lines.push(`## 그룹 영향`);
    for (const g of impact.affectedGroups) lines.push(`- ${g}`);
    lines.push(``);
  }

  lines.push(`## 영향받는 문서`);
  for (const i of impact.impacted) {
    const dir = i.direction === "upstream" ? "↑" : "↓";
    lines.push(`- [${i.via} ${dir}] ${i.id} (depth ${i.depth})`);
  }

  return lines.join("\n");
}

/** 노드 컨텍스트 조회 결과 (텍스트) */
export async function context(
  rootDir: string,
  docId: string,
): Promise<string> {
  const result = await scanAndBuild(rootDir, [join(rootDir, "docs")]);
  const reg = result.registry;
  const bodies = await loadBodies(reg, rootDir);

  const entry = reg.get(docId);
  if (!entry) return `문서 "${docId}"를 찾을 수 없습니다.`;

  const body = bodies.get(docId);
  const purpose = body ? extractByLevel(body, "purpose").text : "(purpose 없음)";

  const lines = [
    `# 컨텍스트: ${entry.title}`,
    ``,
    `scope: ${entry.scope}/${entry.aspect}  depth: ${entry.depth}  lifecycle: ${entry.lifecycle}`,
    ``,
    `## 이 문서의 목적`,
    purpose,
    ``,
  ];

  // 소속 그룹
  const containsIncoming = reg.getLinks(docId, "incoming").filter(l => l.linkType === "contains");
  if (containsIncoming.length > 0) {
    lines.push(`## 소속`);
    for (const l of containsIncoming) {
      const _group = reg.get(l.sourceId);
      const groupBody = bodies.get(l.sourceId);
      const groupPurpose = groupBody ? extractByLevel(groupBody, "purpose").text : "";
      lines.push(`- ${l.sourceId}: ${groupPurpose.split("\n")[0] || "(purpose 없음)"}`);
    }
    lines.push(``);
  }

  // 적용되는 제약
  const constrainsIncoming = reg.getLinks(docId, "incoming").filter(l => l.linkType === "constrains");
  if (constrainsIncoming.length > 0) {
    lines.push(`## 적용되는 제약`);
    for (const l of constrainsIncoming) {
      const constraintBody = bodies.get(l.sourceId);
      if (constraintBody) {
        const constraints = extractByMarker(constraintBody, "constraint");
        if (constraints.text) {
          lines.push(`- [${l.sourceId}]:`);
          lines.push(constraints.text);
        } else {
          const p = extractByLevel(constraintBody, "purpose").text;
          lines.push(`- [${l.sourceId}]: ${p.split("\n")[0]}`);
        }
      }
    }
    lines.push(``);
  }

  // 의존 대상
  const outgoing = reg.getLinks(docId, "outgoing");
  const deps = outgoing.filter(l => l.linkType === "depends_on" || l.linkType === "implements" || l.linkType === "refines");
  if (deps.length > 0) {
    lines.push(`## 의존 대상`);
    for (const l of deps) {
      const depBody = bodies.get(l.targetId);
      const depPurpose = depBody ? extractByLevel(depBody, "purpose").text.split("\n")[0] : "(purpose 없음)";
      lines.push(`- [${l.linkType}] ${l.targetId}: ${depPurpose}`);
    }
    lines.push(``);
  }

  // concerns
  const concerns = computeEffectiveConcerns(docId, id => reg.get(id), (id, dir) => reg.getLinks(id, dir));
  if (concerns.all.length > 0) {
    lines.push(`## concerns`);
    if (concerns.direct.length > 0) lines.push(`직접: ${concerns.direct.join(", ")}`);
    for (const i of concerns.inherited) {
      lines.push(`상속: ${i.concern} from ${i.from} via ${i.via}`);
    }
    lines.push(``);
  }

  // 영향 범위
  const impact = analyzeImpact(docId, id => reg.get(id), (id, dir) => reg.getLinks(id, dir));
  lines.push(`## 영향 범위`);
  lines.push(`blast radius: ${impact.blastRadius}건`);
  if (impact.impacted.length > 0) {
    const top3 = impact.impacted.slice(0, 5);
    for (const i of top3) lines.push(`- [${i.via}] ${i.id}`);
  }

  return lines.join("\n");
}

/** 바운더리 단위 조회 결과 (텍스트) */
export async function boundary(
  rootDir: string,
  docId: string,
  level: "purpose" | "overview" = "overview",
): Promise<string> {
  const result = await scanAndBuild(rootDir, [join(rootDir, "docs")]);
  const bodies = await loadBodies(result.registry, rootDir);

  const assembled = assembleBoundary(
    docId,
    id => result.registry.get(id),
    (id, dir) => result.registry.getLinks(id, dir),
    id => bodies.get(id),
    level,
  );

  if (!assembled) return `바운더리 문서 "${docId}"를 찾을 수 없습니다.`;
  return assembled.text;
}

/** 바운더리 컨텍스트 조회 결과 (텍스트) */
export async function boundaryContext(
  rootDir: string,
  docId: string,
  level: "purpose" | "overview" = "overview",
  mode: "direct" | "transitive" = "transitive",
): Promise<string> {
  const result = await scanAndBuild(rootDir, [join(rootDir, "docs")]);
  const reg = result.registry;
  const bodies = await loadBodies(reg, rootDir);

  const assembled = assembleBoundary(
    docId,
    id => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
    id => bodies.get(id),
    level,
  );
  if (!assembled) return `바운더리 문서 "${docId}"를 찾을 수 없습니다.`;

  const concerns = selectConcernContext(computeEffectiveConcerns(
    docId,
    (id) => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
  ), mode);
  const impact = selectImpactContext(analyzeImpact(
    docId,
    (id) => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
  ), mode);

  const lines: string[] = [];
  lines.push(assembled.text);
  lines.push("");
  lines.push(`mode: ${mode}`);

  lines.push("");
  lines.push("## concerns");
  lines.push(`직접: ${concerns.direct.length > 0 ? concerns.direct.join(", ") : "(없음)"}`);
  if (concerns.inherited.length === 0) {
    lines.push("상속: (없음)");
  } else {
    for (const item of concerns.inherited) {
      lines.push(`상속: ${item.concern} from ${item.from} via ${item.via}`);
    }
  }

  lines.push("");
  lines.push("## impact");
  lines.push(`blast radius: ${impact.blastRadius}건`);
  if (impact.affectedGroups.length > 0) {
    lines.push(`groups: ${impact.affectedGroups.join(", ")}`);
  }
  for (const item of impact.impacted.slice(0, 10)) {
    lines.push(
      `- [${item.via}] ${item.id} (${item.direction}, depth ${item.depth})`,
    );
  }

  return lines.join("\n");
}
