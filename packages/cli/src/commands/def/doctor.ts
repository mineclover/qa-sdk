// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASPECT_PARENTS,
  DEF_ASPECT,
  ROOT_ASPECTS,
  collectCodeLinkCoverage,
  collectCodeReferences,
  deriveAllDomainRoots,
  deriveSpecImplState,
  deriveConventionState,
  deriveDocLifecycle,
  type DefDataSource,
} from 'definition-catalog';
import type { DataSourceOptions } from 'definition-data-source';
import { buildDomainRootRegistry } from './domain-registry.js';
import { countQualityLinks, type QualityDocumentSnapshot } from './quality-model.js';
import { closeDataSource } from './shared.js';

type SourceFactory = (options: DataSourceOptions) => Promise<DefDataSource>;

export interface DoctorCommandDependencies {
  readonly root: string;
  readonly createSource: SourceFactory;
}
// ── doctor (통합 헬스체크) ──────────────────────────────────

/**
 * `def doctor` — 단일 헬스체크.
 *
 * validator, audit, coverage, aspect hierarchy 불변식, deprecated annotation 을
 * 한 번에 실행하여 스크린 1 개 분량의 구조화된 요약을 낸다. 신규 기여자가 가장 먼저
 * 실행해야 할 명령이며, 각 섹션은 실제 데이터에 기반한 metric 만 출력한다.
 *
 * 섹션:
 *   Core        — validate, sync 통계
 *   Domains     — by-domain roots, code-link coverage
 *   Aspects     — ASPECT_PARENTS/ROOT_ASPECTS 완결성 불변식
 *   Annotations — deprecated boundary/doc 타깃 점검
 *   Summary     — 총 errors / warnings + follow-up 명령 안내
 *
 * Exit code:
 *   0 — errors 0 && warnings 0 (clean)
 *   2 — errors 0 && warnings > 0 (운영 가능, 후속 관찰 필요)
 *   1 — errors > 0 (즉시 수정 필요)
 */

interface DoctorCheck {
  readonly category: 'Core' | 'Domains' | 'Aspects' | 'Annotations';
  readonly label: string;
  readonly status: 'ok' | 'warn' | 'fail';
  readonly metric: string;
  readonly errors: number;
  readonly warnings: number;
}

function statusGlyph(status: DoctorCheck['status']): string {
  if (status === 'ok') return '✓';
  if (status === 'warn') return '⚠';
  return '✗';
}

async function runDoctorValidate(source: DefDataSource): Promise<DoctorCheck> {
  const result = await source.validate();
  const status: DoctorCheck['status'] =
    result.errors > 0 ? 'fail' : result.warnings > 0 ? 'warn' : 'ok';
  return {
    category: 'Core',
    label: 'validate',
    status,
    metric: `${result.errors} error${result.errors === 1 ? '' : 's'}, ${result.warnings} warning${result.warnings === 1 ? '' : 's'}`,
    errors: result.errors,
    warnings: result.warnings,
  };
}

async function runDoctorSyncStats(source: DefDataSource): Promise<DoctorCheck> {
  const docs = await source.list({ limit: 100000 });
  const linkCount = countQualityLinks(
    docs.map((doc) => ({
      id: doc.docId,
      lifecycle: doc.lifecycle,
      level: doc.level,
      purpose: doc.purpose,
      tags: doc.tags,
      linkTypes: doc.links.map((link) => link.type),
    } satisfies QualityDocumentSnapshot)),
  );
  return {
    category: 'Core',
    label: 'sync',
    status: docs.length > 0 ? 'ok' : 'fail',
    metric: `${docs.length} docs, ${linkCount} links`,
    errors: docs.length > 0 ? 0 : 1,
    warnings: 0,
  };
}

async function runDoctorByDomain(
  source: DefDataSource,
): Promise<{ check: DoctorCheck; topRoots: string[] }> {
  const registry = await buildDomainRootRegistry(source);
  const rootMap = deriveAllDomainRoots(registry);
  const active = registry
    .all()
    .filter((d) => d.lifecycle !== 'deprecated' && d.lifecycle !== 'archived');

  const byRoot = new Map<string, number>();
  for (const d of active) {
    const root = rootMap.get(d.id) ?? d.id;
    byRoot.set(root, (byRoot.get(root) ?? 0) + 1);
  }
  const sorted = [...byRoot.entries()].toSorted((a, b) => b[1] - a[1]);
  const topRoots = sorted.slice(0, 5).map(([root]) => root);
  return {
    check: {
      category: 'Domains',
      label: 'by-domain',
      status: byRoot.size > 0 ? 'ok' : 'fail',
      metric: `${byRoot.size} roots`,
      errors: byRoot.size > 0 ? 0 : 1,
      warnings: 0,
    },
    topRoots,
  };
}

function runDoctorCoverage(root: string): DoctorCheck {
  const result = collectCodeLinkCoverage(root, { docsDir: 'docs' });
  const adjusted = result.adjusted.percentage;
  const raw = result.raw.percentage;
  // 80% 미만은 warning — CON-004 참고 (adjusted 기준, infra 제외)
  const status: DoctorCheck['status'] = adjusted < 80 ? 'warn' : 'ok';
  return {
    category: 'Domains',
    label: 'coverage',
    status,
    metric: `${adjusted}% adjusted (${result.adjusted.linked}/${result.adjusted.total}) — raw ${raw}% (${result.raw.linked}/${result.raw.total}), ${result.adjusted.excluded} infra excluded`,
    errors: 0,
    warnings: status === 'warn' ? 1 : 0,
  };
}

function runDoctorAspectHierarchy(): DoctorCheck {
  // 4 경로 불변식 체크 (aspect-parents.test.ts 와 동일 규율).
  const aspects = DEF_ASPECT.entries;
  const issues: string[] = [];

  for (const aspect of aspects) {
    const isRoot = ROOT_ASPECTS.has(aspect);
    const hasParent = aspect in ASPECT_PARENTS;
    if (!isRoot && !hasParent) issues.push(`${aspect}: neither root nor parented`);
    if (isRoot && hasParent) issues.push(`${aspect}: both root and parented`);
  }

  const entrySet = new Set<string>(aspects);
  for (const [child, parent] of Object.entries(ASPECT_PARENTS)) {
    if (!entrySet.has(parent))
      issues.push(`${child} → ${parent}: parent not in DEF_ASPECT.entries`);
  }
  for (const root of ROOT_ASPECTS) {
    if (!entrySet.has(root)) issues.push(`${root}: ROOT_ASPECTS entry not in DEF_ASPECT.entries`);
  }

  // cycle 탐지
  for (const startChild of Object.keys(ASPECT_PARENTS)) {
    const visited = new Set<string>();
    let current: string | undefined = startChild;
    while (current !== undefined && current in ASPECT_PARENTS) {
      if (visited.has(current)) {
        issues.push(`cycle detected from ${startChild}`);
        break;
      }
      visited.add(current);
      current = ASPECT_PARENTS[current];
    }
  }

  const roots = ROOT_ASPECTS.size;
  const parented = Object.keys(ASPECT_PARENTS).length;
  const status: DoctorCheck['status'] = issues.length > 0 ? 'fail' : 'ok';
  return {
    category: 'Aspects',
    label: 'hierarchy',
    status,
    metric: `${aspects.length} total (${roots} roots, ${parented} parented)${issues.length === 0 ? ', no drift' : `, ${issues.length} drift`}`,
    errors: issues.length,
    warnings: 0,
  };
}

function runDoctorAspectCompleteness(): DoctorCheck {
  // ROOT_ASPECTS ∪ ASPECT_PARENTS 가 DEF_ASPECT.entries 를 정확히 덮는가.
  const aspects = DEF_ASPECT.entries;
  const accounted = new Set<string>();
  for (const aspect of aspects) {
    if (ROOT_ASPECTS.has(aspect) || aspect in ASPECT_PARENTS) accounted.add(aspect);
  }
  const missing = aspects.filter((a) => !accounted.has(a));
  const status: DoctorCheck['status'] = missing.length > 0 ? 'fail' : 'ok';
  return {
    category: 'Aspects',
    label: 'ROOT_ASPECTS',
    status,
    metric:
      missing.length === 0
        ? 'complete (all DEF_ASPECT entries accounted for)'
        : `${missing.length} unaccounted: ${missing.slice(0, 3).join(',')}`,
    errors: missing.length,
    warnings: 0,
  };
}

async function runDoctorAnnotations(
  source: DefDataSource,
  root: string,
): Promise<{ deprecated: DoctorCheck; valid: DoctorCheck }> {
  const refs = collectCodeReferences(root, { docsDir: 'docs', codeDirs: ['packages'] });
  const commentRefs = refs.filter((r) => r.sourceKind === 'code_comment');

  // 타깃별로 deprecated 여부를 확인. 미존재 타깃은 validate 가 이미 잡으므로 여기서는 스킵.
  const uniqueDocIds = [...new Set(commentRefs.map((r) => r.docId))];
  const lifecycleByDocId = new Map<string, string | undefined>();
  for (const docId of uniqueDocIds) {
    try {
      const doc = await source.get(docId);
      lifecycleByDocId.set(docId, doc?.lifecycle);
    } catch {
      lifecycleByDocId.set(docId, undefined);
    }
  }

  let deprecatedRefs = 0;
  let brokenRefs = 0;
  const deprecatedTargets = new Set<string>();
  for (const ref of commentRefs) {
    const lifecycle = lifecycleByDocId.get(ref.docId);
    if (lifecycle === undefined) {
      brokenRefs += 1;
      continue;
    }
    if (lifecycle === 'deprecated' || lifecycle === 'archived') {
      deprecatedRefs += 1;
      deprecatedTargets.add(ref.docId);
    }
  }

  const deprecatedStatus: DoctorCheck['status'] = deprecatedRefs > 0 ? 'warn' : 'ok';
  const targetsPreview = [...deprecatedTargets].slice(0, 2).join(', ');
  const deprecated: DoctorCheck = {
    category: 'Annotations',
    label: 'deprecated',
    status: deprecatedStatus,
    metric:
      deprecatedRefs === 0
        ? 'no deprecated targets'
        : `${deprecatedRefs} @def.doc|boundary refs to deprecated doc(s)${targetsPreview ? ` (${targetsPreview})` : ''}`,
    errors: 0,
    warnings: deprecatedRefs > 0 ? 1 : 0,
  };

  // valid: broken 타깃이 있으면 warning — validate 가 error 로 이미 잡지만 doctor 에서도 표면화.
  const validStatus: DoctorCheck['status'] = brokenRefs > 0 ? 'warn' : 'ok';
  const valid: DoctorCheck = {
    category: 'Annotations',
    label: '@def.boundary',
    status: validStatus,
    metric: brokenRefs === 0 ? 'all targets valid' : `${brokenRefs} refs point to missing doc`,
    errors: 0,
    warnings: brokenRefs > 0 ? 1 : 0,
  };

  return { deprecated, valid };
}

function printDoctorSection(title: string, checks: DoctorCheck[]): void {
  if (checks.length === 0) return;
  console.log(title);
  const labelWidth = Math.max(...checks.map((c) => c.label.length));
  for (const check of checks) {
    const glyph = statusGlyph(check.status);
    console.log(`  ${glyph} ${check.label.padEnd(labelWidth)}  ${check.metric}`);
  }
  console.log();
}

export async function cmdDoctor(
  flags: Record<string, string>,
  options: DataSourceOptions,
  dependencies: DoctorCommandDependencies,
): Promise<void> {
  let source: DefDataSource;
  try {
    source = await dependencies.createSource(options);
  } catch (error) {
    console.log(`✗ DB 접근 실패: ${(error as Error).message}`);
    console.log(`→ run \`qa-sdk def sync\` to create the local DB first.`);
    process.exitCode = 1;
    return;
  }

  const checks: DoctorCheck[] = [];
  let topRoots: string[] = [];

  try {
    checks.push(await runDoctorValidate(source));
    checks.push(await runDoctorSyncStats(source));
    const byDomain = await runDoctorByDomain(source);
    checks.push(byDomain.check);
    topRoots = byDomain.topRoots;
    checks.push(runDoctorCoverage(dependencies.root));
    checks.push(runDoctorAspectHierarchy());
    checks.push(runDoctorAspectCompleteness());
    const annotations = await runDoctorAnnotations(source, dependencies.root);
    checks.push(annotations.deprecated);
    checks.push(annotations.valid);
  } finally {
    if ('close' in source && typeof (source as { close?: () => void }).close === 'function') {
      (source as { close: () => void }).close();
    }
  }

  const jsonMode = flags['json'] === 'true';
  const totalErrors = checks.reduce((sum, c) => sum + c.errors, 0);
  const totalWarnings = checks.reduce((sum, c) => sum + c.warnings, 0);

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          checks,
          summary: { errors: totalErrors, warnings: totalWarnings, topDomainRoots: topRoots },
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`$ qa-sdk def doctor`);
    console.log();
    printDoctorSection(
      'Core',
      checks.filter((c) => c.category === 'Core'),
    );
    const domains = checks.filter((c) => c.category === 'Domains');
    if (domains.length > 0) {
      console.log('Domains');
      const labelWidth = Math.max(...domains.map((c) => c.label.length));
      for (const check of domains) {
        const glyph = statusGlyph(check.status);
        console.log(`  ${glyph} ${check.label.padEnd(labelWidth)}  ${check.metric}`);
        if (check.label === 'by-domain' && topRoots.length > 0) {
          console.log(`      top: ${topRoots.join(', ')}`);
        }
      }
      console.log();
    }
    printDoctorSection(
      'Aspects',
      checks.filter((c) => c.category === 'Aspects'),
    );
    printDoctorSection(
      'Annotations',
      checks.filter((c) => c.category === 'Annotations'),
    );

    console.log('Summary');
    const errorGlyph = totalErrors > 0 ? '✗' : '✓';
    const warningGlyph = totalWarnings > 0 ? '⚠' : '✓';
    console.log(`  ${errorGlyph} ${totalErrors} errors`);
    console.log(`  ${warningGlyph} ${totalWarnings} warnings`);
    if (totalErrors > 0 || totalWarnings > 0) {
      console.log(`  → run \`qa-sdk def validate\` for warnings/errors detail`);
      console.log(`  → run \`qa-sdk def code-link-gaps\` for coverage detail`);
      console.log(`  → run \`qa-sdk def audit --by-domain\` for domain breakdown`);
    }
  }

  if (totalErrors > 0) {
    process.exitCode = 1;
  } else if (totalWarnings > 0) {
    process.exitCode = 2;
  }
}
