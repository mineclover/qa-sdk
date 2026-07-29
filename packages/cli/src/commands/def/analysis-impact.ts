// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { DefDataSource } from 'definition-catalog';
import { collectFeedbackMatches } from './feedback-trace.js';
import { formatLinkRef } from './shared.js';

const CHANGE_THRESHOLD = 3; // depends_on 이 수 이상이면 대규모 변경 경고

export async function cmdImpact(source: DefDataSource, docId?: string, address?: string) {
  const doc = address ? await source.getByAddress(address) : docId ? await source.get(docId) : null;
  const lookup = address ? `address "${address}"` : `문서 "${docId}"`;
  if (!doc) {
    console.log(`${lookup} 없음`);
    return;
  }

  const incoming = await source.getIncomingLinks(doc.docId);
  const outgoing = await source.getOutgoingLinks(doc.docId);
  const parent = await source.getParent(doc.docId);
  const _children = await source.getChildren(doc.docId);

  // 주 기능 의존자 = depends_on으로 이 노드를 참조하는 문서
  const primary = incoming.filter((l) => l.type === 'depends_on' || l.type === 'implements');
  // 제약 = constrains로 이 노드를 제한하는 문서
  const constraints = incoming.filter((l) => l.type === 'constrains');
  // 구조 = contains (부모/자식)
  const _structural = incoming.filter((l) => l.type === 'contains');
  // 추적 = traces_to
  const traces = incoming.filter((l) => l.type === 'traces_to' || l.type === 'refines');

  console.log(`[${source.mode}] ${doc.docId} 영향 분석`);
  console.log(
    `  scope: ${doc.scope}/${doc.aspect}  layer: ${doc.layer ?? '-'}  svc: ${doc.svc ?? '-'}`,
  );
  if (doc.address) console.log(`  address: ${doc.address}`);
  if (doc.purpose) console.log(`  purpose: ${doc.purpose.slice(0, 120)}`);
  console.log();

  // 주 기능
  console.log(`  주 기능 (outgoing depends_on):`);
  const outDeps = outgoing.filter((l) => l.type === 'depends_on');
  if (outDeps.length === 0) console.log('    (없음 — 독립 노드)');
  for (const l of outDeps) console.log(`    → ${formatLinkRef(l.target, l.targetAddress)}`);

  // 경유 수신
  console.log(`\n  이 노드를 의존하는 문서 (blast radius):`);
  if (primary.length === 0) console.log('    (없음 — 리프)');
  for (const l of primary)
    console.log(`    ← ${formatLinkRef(l.source, l.sourceAddress)} (${l.type})`);

  if (constraints.length > 0) {
    console.log(`\n  제약 (constrains):`);
    for (const l of constraints) console.log(`    ⚠ ${formatLinkRef(l.source, l.sourceAddress)}`);
  }

  if (traces.length > 0) {
    console.log(`\n  추적/구체화 (traces_to/refines):`);
    for (const l of traces)
      console.log(`    ↗ ${formatLinkRef(l.source, l.sourceAddress)} (${l.type})`);
  }

  // 변경 규모 판단
  console.log();
  const depCount = primary.length;
  if (depCount === 0) {
    console.log('  판단: 리프 노드 — 변경 영향 없음');
  } else if (depCount < CHANGE_THRESHOLD) {
    console.log(`  판단: 소규모 변경 (의존자 ${depCount}건) — 개별 확인으로 충분`);
  } else {
    console.log(`  ⚠ 판단: 대규모 변경 (의존자 ${depCount}건) — scope 내 일괄 검토 필요`);
    if (parent) {
      const siblings = await source.getChildren(parent.docId);
      console.log(`  scope: ${parent.docId} (${siblings.length} members)`);
      for (const s of siblings) {
        const mark = s.docId === docId ? ' ← 변경 대상' : '';
        console.log(`    ${s.docId}  ${s.scope}/${s.aspect}${mark}`);
      }
    }
  }

  if (constraints.length > 0) {
    console.log(`\n  ⚠ 제약 ${constraints.length}건 존재 — 위반 여부 확인 필수`);
  }

  const feedbackMatches = await collectFeedbackMatches(source, [
    doc.docId,
    ...primary.map((link) => link.source),
  ]);
  if (feedbackMatches.length > 0) {
    console.log(`\n  ── Feedback Trace ──`);
    for (const match of feedbackMatches.slice(0, 10)) {
      const model = match.request.targetModel ? ` [${match.request.targetModel}]` : '';
      console.log(`    ${match.request.id}${model} ← ${match.anchorDocId}`);
      console.log(`      ${match.request.purpose}`);
    }
    if (feedbackMatches.length > 10) {
      console.log(`    ... 외 ${feedbackMatches.length - 10}건`);
    }
  }
}
export async function cmdCheck(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) {
    console.log(`문서 "${docId}" 없음`);
    return;
  }

  const incoming = await source.getIncomingLinks(docId);
  const primary = incoming.filter((l) => l.type === 'depends_on' || l.type === 'implements');
  const constraints = incoming.filter((l) => l.type === 'constrains');
  const depCount = primary.length;

  const warnings: string[] = [];
  const errors: string[] = [];

  // 의존자 수 체크
  if (depCount >= CHANGE_THRESHOLD) {
    warnings.push(
      `의존자 ${depCount}건 — 대규모 변경. 의사결정 기록 권장 (qa-sdk flow start scope-expansion)`,
    );
  }

  // 제약 존재 체크
  if (constraints.length > 0) {
    for (const c of constraints) {
      const constraintDoc = await source.get(c.source);
      warnings.push(
        `제약 "${c.source}" 위반 여부 확인: ${constraintDoc?.purpose?.slice(0, 80) ?? ''}`,
      );
    }
  }

  // purpose 없음
  if (!doc.purpose) {
    errors.push('purpose 누락 — 변경 전 목적을 먼저 기록하세요');
  }

  // links 없음
  if (doc.links.length === 0 && incoming.length <= 1) {
    warnings.push('고립 문서 — 다른 문서와 연결이 없습니다');
  }

  // 결과
  if (errors.length === 0 && warnings.length === 0) {
    console.log(
      `[${source.mode}] ✓ ${docId} — 변경 안전 (의존자 ${depCount}건, 제약 ${constraints.length}건)`,
    );
    return;
  }

  console.log(`[${source.mode}] ${docId} 변경 전 검토:`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
