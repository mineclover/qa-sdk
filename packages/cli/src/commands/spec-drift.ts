// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk spec drift — 문서↔코드 drift 분석
 */
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { extractDeclarations, scanImplementations, analyzeDrift } from "spec-analyzer";
import { scanAndBuild } from "definition-catalog";

export async function cliSpecDrift(args: string[]): Promise<void> {
  const root = process.cwd();
  const svcFilter = args.find(a => a.startsWith("--svc="))?.slice(6);
  const specFilter = args.find(a => a.startsWith("--spec="))?.slice(7);

  // 1. 문서 스캔
  const result = await scanAndBuild(root, [join(root, "docs")]);
  const entries = result.registry.all().filter(e => {
    if (e.lifecycle === "deprecated") return false;
    if (!e.serviceId) return false;
    if (svcFilter && e.serviceId !== svcFilter) return false;
    if (specFilter && e.id !== specFilter) return false;
    return true;
  });

  if (entries.length === 0) {
    console.log("svc 필드가 있는 문서가 없습니다.");
    return;
  }

  // 2. svc별 그룹핑
  const bySvc = new Map<string, typeof entries>();
  for (const e of entries) {
    const svcId = e.serviceId as string; // filter에서 !e.serviceId 제거됨
    const group = bySvc.get(svcId) ?? [];
    group.push(e);
    bySvc.set(svcId, group);
  }

  let totalDeclared = 0;
  let totalMissing = 0;
  let totalSpecs = 0;

  for (const [svc, docs] of bySvc) {
    // 패키지 디렉토리 매핑
    const pkgDir = join(root, "packages", svc);
    let implementations;
    try {
      implementations = await scanImplementations(pkgDir);
    } catch {
      continue; // 패키지 디렉토리 없으면 스킵
    }

    for (const doc of docs) {
      if (!doc.ref) continue;
      try {
        const content = readFileSync(join(root, doc.ref), "utf-8");
        const declarations = extractDeclarations(content, doc.id);
        if (declarations.length === 0) continue;

        const report = analyzeDrift(doc.id, svc, declarations, implementations);
        totalSpecs++;
        totalDeclared += report.declared.length;
        totalMissing += report.missing.length;

        if (report.missing.length > 0) {
          console.log(`\n[${svc}] ${doc.id} — coverage ${(report.coverage * 100).toFixed(0)}%`);
          for (const m of report.missing) {
            console.log(`  MISSING ${m.kind}: ${m.name}`);
          }
        }
      } catch { /* skip */ }
    }
  }

  console.log(`\n=== drift 분석 결과 ===`);
  console.log(`스펙 ${totalSpecs}건 | 선언 ${totalDeclared}건 | 누락 ${totalMissing}건 | coverage ${totalDeclared > 0 ? ((1 - totalMissing / totalDeclared) * 100).toFixed(0) : 100}%`);
}
