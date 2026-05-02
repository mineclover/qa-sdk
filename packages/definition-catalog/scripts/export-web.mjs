/**
 * 문서 그래프를 웹 탐색기용 정적 JSON으로 내보낸다.
 *
 * 실행: node packages/definition-catalog/scripts/export-web.mjs
 * 출력: packages/platform-demo/public/def-catalog-data.json
 */

import { scanAndBuild, extractFrontmatter, extractByLevel } from "definition-catalog";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
const reg = result.registry;

// body 로드
const bodies = new Map();
for (const entry of reg.all()) {
  if (!entry.ref) continue;
  try {
    const content = await readFile(join(ROOT, entry.ref), "utf-8");
    const fm = extractFrontmatter(content);
    if (fm) bodies.set(entry.id, fm.body);
  } catch { /* skip */ }
}

// 노드 생성
const nodes = [];
for (const entry of reg.all()) {
  if (entry.lifecycle === "deprecated") continue;

  const body = bodies.get(entry.id);
  let purpose = "";
  let overview = "";
  let fullBody = "";

  if (body) {
    const p = extractByLevel(body, "purpose");
    purpose = p.text;
    const o = extractByLevel(body, "overview");
    overview = o.sections.filter(s => s.marker === "overview").map(s => s.body).join("\n");
    fullBody = extractByLevel(body, "full").text;
  }

  const outgoing = reg.getLinks(entry.id, "outgoing");
  const incoming = reg.getLinks(entry.id, "incoming");
  const containsMembers = outgoing.filter(l => l.linkType === "contains").map(l => l.targetId);
  const parentGroups = incoming.filter(l => l.linkType === "contains").map(l => l.sourceId);

  nodes.push({
    id: entry.id,
    title: entry.title,
    scope: entry.scope,
    aspect: entry.aspect,
    depth: entry.depth,
    lifecycle: entry.lifecycle,
    tags: entry.tags || [],
    serviceId: entry.serviceId || null,
    purpose,
    overview,
    body: fullBody,
    isGroup: containsMembers.length > 0,
    contains: containsMembers,
    parents: parentGroups,
    links: outgoing.filter(l => l.linkType !== "contains").map(l => ({
      target: l.targetId,
      type: l.linkType,
    })),
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  stats: {
    total: nodes.length,
    groups: nodes.filter(n => n.isGroup).length,
    scopes: [...new Set(nodes.map(n => n.scope))],
  },
  nodes,
};

const outPath = join(ROOT, "packages/platform-demo/public/def-catalog-data.json");
await writeFile(outPath, JSON.stringify(output, null, 2));
console.log(`${nodes.length}건 → ${outPath}`);
