// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deriveAllDomainRoots,
  deriveAspectParent,
  extractByLevel,
  extractByMarker,
  extractFrontmatter,
  getAspectFamily,
  scanAndBuild,
  validateGraph,
  collectCodeLinkCoverage,
  type DefDataSource,
  type DefinitionEntry,
} from 'definition-catalog';
import { syncDocsToLocalDb } from 'definition-data-source';
import {
  formatQualityLevelSummary,
  summarizeQualityDocuments,
  type QualityDocumentSnapshot,
} from './quality-model.js';
import { buildDomainRootRegistry } from './domain-registry.js';
import { cmdPlatformQuery, hasExternalPlatform } from './platform.js';
import { getRootDir, parseCsvFlag } from './shared.js';
// ── audit (DefDataSource 기반, 레거시 통합) ───────────

async function cmdAuditByDomain(source: DefDataSource) {
  const registry = await buildDomainRootRegistry(source);
  const roots = deriveAllDomainRoots(registry);
  const all = registry.all();
  const active = all.filter((d) => d.lifecycle !== 'deprecated' && d.lifecycle !== 'archived');

  // domain_root별 문서 집계
  const byRoot = new Map<string, DefinitionEntry[]>();
  for (const d of active) {
    const root = roots.get(d.id) ?? d.id;
    const list = byRoot.get(root) ?? [];
    list.push(d);
    byRoot.set(root, list);
  }

  const sortedRoots = [...byRoot.entries()].toSorted((a, b) => b[1].length - a[1].length);

  console.log(`=== 도메인 루트별 리포트 (${byRoot.size}개 루트, 문서 ${active.length}건) ===`);
  for (const [rootId, docs] of sortedRoots) {
    const coordCounts = new Map<string, number>();
    for (const d of docs) {
      const key = `${d.tier || 'none'}:${d.scope}:${d.layer || 'none'}:${d.aspect}`;
      coordCounts.set(key, (coordCounts.get(key) ?? 0) + 1);
    }
    const topCoords = [...coordCounts.entries()].toSorted((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(`\n[${rootId}]  ${docs.length}건`);
    for (const [coord, count] of topCoords) {
      console.log(`  ${coord}: ${count}건`);
    }
  }
}

/**
 * aspect hierarchy 기반 rollup audit (Phase C-2, aspect-schema-hierarchy RFC).
 *
 * 모든 문서를 aspect 기준으로 그룹핑하되, 자식 aspect 의 문서는 부모 aspect 의 bucket 으로 집계.
 * 출력: root aspect (부모 없는 aspect) 별 문서 수 + 직속/후손 aspect breakdown.
 *
 * 용도: aspect family 별 문서 분포 (어떤 family 에 문서가 많이 쌓여있는가, rollup 대상 후보) 를 한눈에 본다.
 */
async function cmdAuditRollupAspect(source: DefDataSource): Promise<void> {
  const all = await source.list({ limit: 100000 });
  const active = all.filter((d) => d.lifecycle !== 'deprecated' && d.lifecycle !== 'archived');

  // 각 문서의 root aspect = parent chain 상단 (최상위 aspect). parent 없으면 자기 자신.
  function resolveRoot(aspect: string | undefined): string {
    if (!aspect) return '(unknown)';
    const visited = new Set<string>();
    let current = aspect;
    while (!visited.has(current)) {
      visited.add(current);
      const parent = deriveAspectParent(current);
      if (!parent) return current;
      current = parent;
    }
    return current; // cycle 방어
  }

  const byRoot = new Map<string, { total: number; byAspect: Map<string, number> }>();
  for (const doc of active) {
    const aspect = doc.aspect ?? '(none)';
    const root = resolveRoot(doc.aspect);
    const bucket = byRoot.get(root) ?? { total: 0, byAspect: new Map<string, number>() };
    bucket.total += 1;
    bucket.byAspect.set(aspect, (bucket.byAspect.get(aspect) ?? 0) + 1);
    byRoot.set(root, bucket);
  }

  const sorted = [...byRoot.entries()].toSorted((a, b) => b[1].total - a[1].total);

  console.log(
    `[${source.mode}] === aspect rollup 리포트 (${byRoot.size}개 root, ${active.length}건) ===`,
  );
  for (const [root, bucket] of sorted) {
    const family = getAspectFamily(root);
    const descendantCount = family.length - 1;
    console.log(
      `\n[${root}]  ${bucket.total}건  (family ${family.length}개: self + ${descendantCount} 후손)`,
    );
    const breakdown = [...bucket.byAspect.entries()].toSorted((a, b) => b[1] - a[1]);
    for (const [aspect, count] of breakdown) {
      const marker = aspect === root ? '■' : '└';
      console.log(`  ${marker} ${aspect}: ${count}건`);
    }
  }
}

export async function cmdAudit(source: DefDataSource, flags: Record<string, string> = {}) {
  if (flags['by-domain'] === 'true' || flags['by-domain'] === '') {
    return cmdAuditByDomain(source);
  }
  if (flags['rollup-aspect'] === 'true' || flags['rollup-aspect'] === '') {
    return cmdAuditRollupAspect(source);
  }

  const all = await source.list({ limit: 2000 });
  const summary = summarizeQualityDocuments(
    all.map((d) => ({
      id: d.docId,
      lifecycle: d.lifecycle,
      level: d.level,
      purpose: d.purpose,
      tags: d.tags,
      linkTypes: d.links.map((link) => link.type),
    } satisfies QualityDocumentSnapshot)),
  );

  console.log(`=== 품질 리포트 ===`);
  console.log(
    `문서 ${summary.active.length}건 | purpose ${summary.withPurpose} | links ${summary.withLinks} | tags ${summary.withTags}`,
  );
  console.log(`level: ${formatQualityLevelSummary(summary.byLevel)}`);

  // 그래프 검증
  const validation = await source.validate();
  if (validation.issues.length > 0) {
    const byType: Record<string, (typeof validation.issues)[number][]> = {};
    for (const i of validation.issues) (byType[i.type] ??= []).push(i);

    console.log(
      `\n=== 그래프 검증 (errors=${validation.errors} warnings=${validation.warnings}) ===`,
    );
    for (const [type, items] of Object.entries(byType).toSorted(
      (a, b) => b[1].length - a[1].length,
    )) {
      console.log(`\n[${items[0]!.severity}] ${type}: ${items.length}건`);
      for (const i of items) console.log(`  ${i.docId}: ${i.message}`);
    }
  } else {
    console.log(`\n그래프 검증 통과 (이슈 0건)`);
  }

  // purpose 이슈
  if (summary.noPurpose.length > 0) {
    console.log(`\n=== purpose 이슈 ${summary.noPurpose.length}건 ===`);
    summary.noPurpose
      .slice(0, 10)
      .forEach((document) => console.log(`  [high] ${document.id}: ^purpose 없음`));
    if (summary.noPurpose.length > 10) {
      console.log(`  ... 외 ${summary.noPurpose.length - 10}건`);
    }
  }
}

// ── scan (파일 스캔 유틸) ──────────────────────────────

/** 파일 시스템에서 docs/ 하위 .md를 스캔하여 ScanResult 반환 */
export async function scan(flags: Record<string, string> = {}) {
  const root = getRootDir();
  const docsDir = flags['docs'] ?? 'docs';
  return scanAndBuild(root, [join(root, docsDir)]);
}

export async function cmdScanAudit(flags: Record<string, string>) {
  const root = getRootDir();
  if (hasExternalPlatform(flags)) return cmdPlatformQuery('scan-audit', root, flags);
  const result = await scan(flags);
  const active = result.registry
    .all()
    .filter((entry) => entry.lifecycle !== 'deprecated' && entry.lifecycle !== 'archived');

  const qualityDocuments: QualityDocumentSnapshot[] = [];

  for (const entry of active) {
    let purpose: string | undefined;
    if (entry.ref) {
      try {
        const content = readFileSync(join(root, entry.ref), 'utf8');
        const fm = extractFrontmatter(content);
        const body = fm?.body ?? content;
        purpose =
          extractByMarker(body, 'purpose').text || extractByLevel(body, 'purpose').text;
      } catch {
        // scan error는 별도 섹션에서 보고한다.
      }
    }
    qualityDocuments.push({
      id: entry.id,
      lifecycle: entry.lifecycle,
      level: entry.level,
      purpose,
      tags: entry.tags ?? [],
      linkTypes: result.registry.getLinks(entry.id, 'outgoing').map((link) => link.linkType),
    });
  }
  const summary = summarizeQualityDocuments(qualityDocuments);

  console.log('=== scan 감사 ===');
  console.log(
    `문서 ${summary.active.length}건 | purpose ${summary.withPurpose} | links ${summary.withLinks} | tags ${summary.withTags}`,
  );
  console.log(`registered: ${result.registered} | linked: ${result.linked}`);
  console.log(`scan errors: ${result.errors.length} | link errors: ${result.linkErrors.length}`);
  console.log(`level: ${formatQualityLevelSummary(summary.byLevel)}`);

  if (result.errors.length > 0) {
    console.log(`\n=== 스캔 에러 ${result.errors.length}건 ===`);
    for (const issue of result.errors.slice(0, 10)) {
      console.log(`  ${issue.file}: ${issue.error}`);
    }
    if (result.errors.length > 10) console.log(`  ... 외 ${result.errors.length - 10}건`);
  }

  if (result.linkErrors.length > 0) {
    console.log(`\n=== 링크 에러 ${result.linkErrors.length}건 ===`);
    for (const issue of result.linkErrors.slice(0, 10)) {
      console.log(`  ${issue.source} -> ${issue.target}: ${issue.error}`);
    }
    if (result.linkErrors.length > 10) console.log(`  ... 외 ${result.linkErrors.length - 10}건`);
  }

  const validation = validateGraph(result.registry);
  if (validation.issues.length > 0) {
    const byType: Record<string, Array<(typeof validation.issues)[number]>> = {};
    for (const issue of validation.issues) (byType[issue.type] ??= []).push(issue);

    console.log(
      `\n=== 그래프 검증 (errors=${validation.errors} warnings=${validation.warnings}) ===`,
    );
    for (const [type, items] of Object.entries(byType).toSorted(
      (a, b) => b[1].length - a[1].length,
    )) {
      console.log(`\n[${items[0]!.severity}] ${type}: ${items.length}건`);
      for (const issue of items.slice(0, 10)) {
        console.log(`  ${issue.docId}: ${issue.message}`);
      }
      if (items.length > 10) console.log(`  ... 외 ${items.length - 10}건`);
    }
  } else {
    console.log(`\n그래프 검증 통과 (이슈 0건)`);
  }
}

export async function cmdSync(flags: Record<string, string>) {
  const root = getRootDir();
  const dbPath = flags['db'] ?? flags['db-path'];
  const docsDir = flags['docs'] ?? 'docs';
  const result = await syncDocsToLocalDb({
    rootDir: root,
    docsDir,
    ...(dbPath ? { dbPath } : {}),
  });
  console.log(`동기화 완료: ${result.synced}건 문서, ${result.links}건 링크`);
  console.log(`DB: ${result.dbPath}`);
}

export async function cmdCodeLinkGaps(flags: Record<string, string>) {
  const root = getRootDir();
  if (hasExternalPlatform(flags)) return cmdPlatformQuery('code-link-gaps', root, flags);
  const scopes = parseCsvFlag(flags['scope']);
  const codeDirs = parseCsvFlag(flags['code-dir']);
  const rawLimit = Number.parseInt(flags['limit'] ?? '50', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
  const result = collectCodeLinkCoverage(root, {
    docsDir: flags['docs'] ?? 'docs',
    ...(codeDirs.length > 0 ? { codeDirs } : {}),
    ...(scopes.length > 0 ? { scopes } : {}),
    includeTests: flags['include-tests'] === 'true',
    includeNonSrc: flags['include-non-src'] === 'true',
  });

  const listedFiles = result.files.slice(0, limit);
  const truncated =
    result.files.length > listedFiles.length ? result.files.length - listedFiles.length : 0;
  const coverageRate = result.adjusted.percentage;

  if (flags['json'] === 'true') {
    console.log(
      JSON.stringify(
        {
          scopes: result.scopes,
          totalFiles: result.totalFiles,
          linkedFiles: result.linkedFiles,
          unlinkedFiles: result.unlinkedFiles,
          coverageRate,
          raw: result.raw,
          adjusted: result.adjusted,
          excludedPackages: result.excludedPackages,
          listedFiles,
          truncated,
        },
        null,
        2,
      ),
    );
  } else {
    console.log('=== code link gaps ===');
    console.log(
      `total: ${result.totalFiles} | linked: ${result.linkedFiles} | unlinked: ${result.unlinkedFiles} | coverage: ${coverageRate}% (raw ${result.raw.percentage}%, ${result.adjusted.excluded} infra excluded)`,
    );
    console.log(
      `scopes: ${result.scopes.length > 0 ? result.scopes.join(', ') : '(전체 packages/*/src)'}`,
    );

    if (listedFiles.length === 0) {
      console.log('\n✓ explicit 문서 연결 없는 코드 없음');
    } else {
      console.log(`\n=== explicit 문서 연결 없는 코드 ${listedFiles.length}건 ===`);
      for (const filePath of listedFiles) {
        console.log(`  ${filePath}`);
      }
      if (truncated > 0) {
        console.log(`  ... 외 ${truncated}건`);
      }
    }
  }

  if (flags['strict'] === 'true' && result.unlinkedFiles > 0) {
    process.exitCode = 1;
  }
}
