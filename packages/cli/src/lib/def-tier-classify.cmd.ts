import type { DefDataSource } from "definition-catalog";
import { classifyTier } from "./def-tier-classify.js";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

export async function cmdTierClassify(source: DefDataSource, args: string[], flags: Record<string, string>) {
  if (source.mode === "scan") {
    console.error("tier classify는 local/server datasource가 필요합니다. def sync를 먼저 실행하세요.");
    process.exitCode = 1;
    return;
  }

  const allEntries = await source.list({ limit: 10000 });
  const results = [];
  
  console.log("자동 분류 분석 시작...");
  let count = 0;
  
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    
    // get outgoing links
    const outgoing = (await source.getOutgoingLinks(entry.docId)).map((link) => ({
      targetId: link.target,
      linkType: link.type,
    }));
    
    const suggestion = await classifyTier(source, entry.docId, entry, allEntries, outgoing);
    
    results.push({
      id: entry.docId,
      path: entry.sourcePath,
      currentType: entry.type || "spec",
      currentLevel: entry.level || "leaf",
      suggestion
    });
    
    count++;
    if (count % 100 === 0) console.log(`${count}건 분석 완료...`);
  }
  
  console.log(`\n분석 완료: 총 ${count}건`);
  
  const report = JSON.stringify(results, null, 2);
  
  if (flags["output"]) {
    const outPath = resolve(process.cwd(), flags["output"]);
    await writeFile(outPath, report, "utf8");
    console.log(`결과가 저장되었습니다: ${outPath}`);
  } else {
    console.log("\n[Sample 5 Results]");
    console.log(JSON.stringify(results.slice(0, 5), null, 2));
    console.log("\n전체 결과를 보려면 --output=evidence.json 옵션을 사용하세요.");
  }
  
  const grouped = {
    exempt: results.filter(r => r.suggestion.tier === "exempt").length,
    layout: results.filter(r => r.suggestion.tier === "layout").length,
    system: results.filter(r => r.suggestion.tier === "system").length,
    component: results.filter(r => r.suggestion.tier === "component").length,
    entry: results.filter(r => r.suggestion.tier === "entry").length,
    needsReview: results.filter(r => r.suggestion.needs_review).length,
  };
  
  console.log("\n[Tier 분포]");
  console.log(`Exempt: ${grouped.exempt}`);
  console.log(`Layout: ${grouped.layout}`);
  console.log(`System: ${grouped.system}`);
  console.log(`Component: ${grouped.component}`);
  console.log(`Entry: ${grouped.entry}`);
  console.log(`Needs Review: ${grouped.needsReview} (${Math.round((grouped.needsReview / count) * 100)}%)`);
}
