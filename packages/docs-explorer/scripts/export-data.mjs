/**
 * 문서 그래프를 정적 JSON으로 내보낸다.
 *
 * 실행: node scripts/export-data.mjs
 * 출력: public/data.json
 */

import { scanAndBuild, extractFrontmatter, extractByLevel } from "definition-catalog";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");

const result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
const reg = result.registry;

const bodies = new Map();
for (const entry of reg.all()) {
  if (!entry.ref) continue;
  try {
    const content = await readFile(join(ROOT, entry.ref), "utf-8");
    const fm = extractFrontmatter(content);
    if (fm) bodies.set(entry.id, fm.body);
  } catch { /* skip */ }
}

const nodes = [];
for (const entry of reg.all()) {
  if (entry.lifecycle === "deprecated") continue;

  const body = bodies.get(entry.id);
  let purpose = "", overview = "", fullBody = "";

  if (body) {
    purpose = extractByLevel(body, "purpose").text;
    overview = extractByLevel(body, "overview").sections
      .filter(s => s.marker === "overview").map(s => s.body).join("\n");
    fullBody = extractByLevel(body, "full").text;
  }

  const outgoing = reg.getLinks(entry.id, "outgoing");
  const incoming = reg.getLinks(entry.id, "incoming");

  nodes.push({
    id: entry.id,
    title: entry.title,
    scope: entry.scope,
    aspect: entry.aspect,
    depth: entry.depth,
    lifecycle: entry.lifecycle,
    tags: entry.tags || [],
    serviceId: entry.serviceId || null,
    ref: entry.ref || null,
    purpose, overview, body: fullBody,
    isGroup: outgoing.some(l => l.linkType === "contains"),
    contains: outgoing.filter(l => l.linkType === "contains").map(l => l.targetId),
    parents: incoming.filter(l => l.linkType === "contains").map(l => l.sourceId),
    links: outgoing.filter(l => l.linkType !== "contains").map(l => ({ target: l.targetId, type: l.linkType })),
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

const outPath = join(__dirname, "../public/data.json");
await writeFile(outPath, JSON.stringify(output));
console.log(`${nodes.length}건 → ${outPath} (${(JSON.stringify(output).length / 1024).toFixed(0)}KB)`);
