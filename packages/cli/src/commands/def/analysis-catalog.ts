// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { type DefDataSource, type DefDoc } from 'definition-catalog';

const SERVICE_EXEMPT_DOC_IDS = new Set([
  'architecture-decisions',
  'automation-skill-group',
  'claude-skill-group',
  'cli-command-group',
  'coding-conventions',
  'decision-definition-bridge',
  'definition-mgmt-consistency-rules',
  'definition-mgmt-graph-links',
  'definition-mgmt-state-tracking',
  'dkg-harness-bridge',
  'dkg-skill-group',
  'error-handling-convention',
  'gate-tracker-spec',
  'harness-model-spec',
  'motion-workspace-system',
  'ralph-tui-skill-group',
  'skill-catalog-system',
  'spec-convention',
  'spec-verification-system',
  'system-packages',
]);

function isServiceExempt(doc: DefDoc): boolean {
  if (SERVICE_EXEMPT_DOC_IDS.has(doc.docId)) return true;
  if (doc.docId.startsWith('definition-mgmt-')) return true;
  if (doc.docId.startsWith('skill-')) return true;
  return false;
}
export async function cmdSearch(source: DefDataSource, query: string) {
  const docs = await source.list({ q: query, limit: 20 });
  console.log(`[${source.mode}] "${query}" → ${docs.length}건`);
  for (const d of docs) {
    const preview = d.purpose?.slice(0, 80) ?? '';
    console.log(`  ${d.docId}  ${d.scope}/${d.aspect}  ${preview}`);
  }
}

export async function cmdConcepts(source: DefDataSource, flags: Record<string, string>) {
  const limit = flags['limit'] ? Number(flags['limit']) : 200;
  const docs = await source.list({
    type: 'knowledge',
    knowledgeKind: 'concept',
    ...(flags['q'] ? { q: flags['q'] } : {}),
    ...(flags['tag'] ? { tag: flags['tag'] } : {}),
    limit,
  });

  console.log(`[${source.mode}] concept 문서 ${docs.length}건`);
  for (const doc of docs) {
    const tags = doc.tags.length > 0 ? ` [${doc.tags.join(',')}]` : '';
    console.log(`  ${doc.docId}  ${doc.scope}/${doc.aspect}  ${doc.lifecycle}${tags}`);
    if (doc.purpose) console.log(`    ${doc.purpose.slice(0, 120)}`);
  }
}

export async function cmdStats(source: DefDataSource) {
  const all = await source.list({ limit: 1000 });
  const approved = all.filter((d) => d.lifecycle === 'approved');
  const deprecated = all.filter((d) => d.lifecycle === 'deprecated');

  const byScope: Record<string, number> = {};
  const byLayer: Record<string, number> = {};
  for (const d of approved) {
    const scope = d.scope ?? '(none)';
    byScope[scope] = (byScope[scope] || 0) + 1;
    if (d.layer) byLayer[d.layer] = (byLayer[d.layer] || 0) + 1;
  }

  console.log(
    `[${source.mode}] 총 ${all.length}건 (approved ${approved.length}, deprecated ${deprecated.length})\n`,
  );
  console.log('scope:');
  Object.entries(byScope)
    .toSorted((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('\nlayer:');
  Object.entries(byLayer)
    .toSorted((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

export async function cmdOverview(source: DefDataSource) {
  const all = await source.list({ limit: 10000 });
  const approved = all.filter((d) => d.lifecycle === 'approved');
  const deprecated = all.filter((d) => d.lifecycle === 'deprecated');

  // scope×aspect 매트릭스
  const matrix: Record<string, Record<string, number>> = {};
  for (const d of approved) {
    const scope = d.scope ?? '(none)';
    const aspect = d.aspect ?? '(none)';
    if (!matrix[scope]) matrix[scope] = {};
    matrix[scope][aspect] = (matrix[scope][aspect] || 0) + 1;
  }

  // svc별 문서 수 + scope 커버리지
  const bySvc: Record<string, { count: number; scopes: Set<string> }> = {};
  for (const d of approved) {
    const svc = d.svc || '(라이브러리)';
    if (!bySvc[svc]) bySvc[svc] = { count: 0, scopes: new Set() };
    bySvc[svc].count++;
    bySvc[svc].scopes.add(d.scope ?? '(none)');
  }

  // links 통계
  let totalOutgoing = 0;
  let docsWithoutOutgoing = 0;
  for (const d of approved) {
    const out = await source.getOutgoingLinks(d.docId);
    totalOutgoing += out.length;
    if (out.length === 0) docsWithoutOutgoing++;
  }

  console.log(`[${source.mode}] === 시스템 전체 개요 ===`);
  console.log(`총 ${all.length}건 (approved ${approved.length}, deprecated ${deprecated.length})`);
  console.log(`edges: ${totalOutgoing}, outgoing 없는 문서: ${docsWithoutOutgoing}건`);
  console.log();

  // scope×aspect 매트릭스
  console.log('scope×aspect 분포:');
  for (const [scope, aspects] of Object.entries(matrix).toSorted(
    (a, b) =>
      Object.values(b[1]).reduce((s, v) => s + v, 0) -
      Object.values(a[1]).reduce((s, v) => s + v, 0),
  )) {
    const total = Object.values(aspects).reduce((s, v) => s + v, 0);
    const detail = Object.entries(aspects)
      .toSorted((a, b) => b[1] - a[1])
      .map(([a, c]) => `${a}(${c})`)
      .join(', ');
    console.log(`  ${scope}: ${total} — ${detail}`);
  }
  console.log();

  // svc 커버리지
  console.log('서비스별 (scope 커버리지):');
  const svcEntries = Object.entries(bySvc).toSorted((a, b) => b[1].count - a[1].count);
  for (const [svc, { count, scopes }] of svcEntries.slice(0, 15)) {
    const scopeList = [...scopes].toSorted().join(',');
    console.log(`  ${svc.padEnd(25)} ${String(count).padStart(3)}건  scopes: ${scopeList}`);
  }
  if (svcEntries.length > 15) console.log(`  ... 외 ${svcEntries.length - 15}건`);
}

export async function cmdAuditDb(source: DefDataSource) {
  const all = await source.list({ lifecycle: 'approved', limit: 1000 });
  const issues: string[] = [];

  let noPurpose = 0,
    shortPurpose = 0,
    noLinks = 0,
    noSvc = 0;

  for (const d of all) {
    if (!d.purpose) {
      noPurpose++;
      issues.push(`[high] ${d.docId}: purpose 없음`);
    } else if (d.purpose.length < 30) {
      shortPurpose++;
      issues.push(`[medium] ${d.docId}: purpose 짧음 (${d.purpose.length}자)`);
    }

    const outgoing = await source.getOutgoingLinks(d.docId);
    const incoming = await source.getIncomingLinks(d.docId);
    // prefix_schema 리프는 contains 1건만 있어도 정상
    const isLeafPrefix =
      d.aspect === 'prefix_schema' && !d.docId.endsWith('-group') && !d.docId.endsWith('-system');
    // Layout/pack의 구성원은 부모 layout에서 incoming `refs` 하나만 가져도
    // 유효한 배치 연결을 가진다. `refs`를 고립으로 세면 layout 규칙과
    // audit-db가 서로 모순되어 정상적인 조망 문서군에 false positive가 난다.
    const hasLayoutReference = incoming.some((link) => link.type === 'refs');
    if (!isLeafPrefix && !hasLayoutReference && outgoing.length === 0 && incoming.length <= 1) {
      noLinks++;
      issues.push(`[medium] ${d.docId}: 고립 — outgoing 0, incoming ≤1`);
    }

    if (!d.svc && d.scope !== 'data' && d.aspect !== 'prefix_schema' && !isServiceExempt(d)) {
      // 라이브러리/prefix 문서 제외
      if (!['user_scenario', 'process_flow'].includes(d.aspect ?? '')) {
        noSvc++;
      }
    }
  }

  console.log(`[${source.mode}] === DB 품질 감사 ===`);
  console.log(
    `approved ${all.length}건 | purpose 없음 ${noPurpose} | 짧음 ${shortPurpose} | 고립 ${noLinks}`,
  );
  if (noSvc > 0) {
    console.log(`info | svc 미부여 ${noSvc}건 (참고 지표 — 현재는 fail 조건 아님)`);
  }

  if (issues.length > 0) {
    const high = issues.filter((i) => i.startsWith('[high]'));
    const medium = issues.filter((i) => i.startsWith('[medium]'));
    if (high.length > 0) {
      console.log(`\n[high] ${high.length}건`);
      high.slice(0, 5).forEach((i) => console.log(`  ${i}`));
    }
    if (medium.length > 0) {
      console.log(`\n[medium] ${medium.length}건`);
      medium.slice(0, 10).forEach((i) => console.log(`  ${i}`));
    }
  } else {
    console.log('\n✓ 이슈 없음');
  }
}
