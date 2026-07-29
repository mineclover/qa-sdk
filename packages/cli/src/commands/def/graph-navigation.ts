// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { DefDataSource } from 'definition-catalog';
import { collectDomainMembers, collectDomainRelations, resolveDocId } from './graph-queries.js';
import { collectFeedbackMatches } from './feedback-trace.js';
import { formatLinkRef } from './shared.js';

const BOUNDARY_LEVELS = new Set(['group', 'module']);

export async function cmdTopdown(
  source: DefDataSource,
  groupId: string,
  level: 'purpose' | 'overview' = 'purpose',
  options: { readonly includeConsumers?: boolean } = {},
) {
  const group = await source.get(groupId);
  if (!group) {
    console.log(`문서 "${groupId}" 없음`);
    return;
  }

  console.log(`# ${group.title ?? group.docId}\n`);
  if (group.purpose) console.log(`${group.purpose}\n`);
  const tags =
    group.tags.length > 0
      ? `concerns: ${group.tags.filter((t) => t !== 'structural' && t !== 'entry-point' && t !== 'generated').join(', ')}`
      : '';
  if (tags) console.log(`${tags}\n`);

  const relations = await collectDomainRelations(source, groupId);
  const members = relations.members;
  const consumers = relations.consumers;

  if (members.length === 0 && consumers.length === 0) {
    console.log('(멤버 없음 — contains/refs/refines 링크 부재)');
    return;
  }

  if (members.length === 0) {
    console.log('(구조 멤버 없음 — 아래는 이 문서를 소비하는 incoming depends_on 문서)');
  }

  for (const relation of members) {
    const child = relation.doc;
    const prefix = child.level && BOUNDARY_LEVELS.has(child.level) ? `[${child.level}] ` : '';
    const scopeTag = `[${(child.scope ?? '?').split('/')[0]}]`;
    console.log(`## ${scopeTag} ${prefix}${child.title ?? child.docId}`);
    console.log(`via: ${relation.via}`);
    if (level === 'purpose' && child.purpose) {
      console.log(child.purpose);
    } else if (level === 'overview') {
      if (child.purpose) console.log(child.purpose);
      // overview 레벨에서는 하위 members 도 간략히 표시
      const grandchildren = await collectDomainMembers(source, child.docId);
      if (grandchildren.length > 0) {
        for (const gc of grandchildren) {
          console.log(`  - ${gc.docId}: ${gc.purpose?.slice(0, 100) ?? '(purpose 없음)'}`);
        }
      }
    }
    console.log();
  }

  if (options.includeConsumers && consumers.length > 0) {
    console.log('## 관련 소비자/의존자 (incoming depends_on)');
    for (const relation of consumers) {
      const doc = relation.doc;
      console.log(
        `- [${relation.via}] ${doc.docId}  ${doc.scope ?? '?'}/${doc.aspect ?? '?'}  ${doc.lifecycle}`,
      );
      if (doc.purpose) console.log(`  ${doc.purpose.slice(0, 120)}`);
    }
    console.log();
  }
}
// ── bottomup (DefDataSource 기반) ─────────────────────

export async function cmdBottomup(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) {
    console.log(`문서 "${docId}" 없음`);
    return;
  }

  // BFS로 영향 범위 역추적
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number; via: string }> = [
    { id: docId, depth: 0, via: '' },
  ];
  const affected: Array<{ id: string; depth: number; via: string }> = [];
  const groups = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.depth > 0) affected.push(current);

    const incoming = await source.getIncomingLinks(current.id);
    for (const link of incoming) {
      if (visited.has(link.source)) continue;
      const srcDoc = await source.get(link.source);
      if (srcDoc && srcDoc.level && BOUNDARY_LEVELS.has(srcDoc.level)) {
        groups.add(link.source);
      }
      queue.push({ id: link.source, depth: current.depth + 1, via: `${link.type} ↑` });
    }
  }

  console.log(`# 영향 분석: ${docId}\n`);
  console.log(`blast radius: ${affected.length}건`);

  if (groups.size > 0) {
    console.log(`\n## 그룹 영향`);
    for (const g of groups) console.log(`- ${g}`);
  }

  if (affected.length > 0) {
    console.log(`\n## 영향받는 문서`);
    const sorted = affected.toSorted((a, b) => a.depth - b.depth);
    for (const a of sorted) {
      console.log(`- [${a.via}] ${a.id} (depth ${a.depth})`);
    }
  }

  const feedbackMatches = await collectFeedbackMatches(source, [
    docId,
    ...affected.map((item) => item.id),
  ]);
  if (feedbackMatches.length > 0) {
    console.log(`\n## Feedback Trace`);
    for (const match of feedbackMatches.slice(0, 10)) {
      const model = match.request.targetModel ? ` [${match.request.targetModel}]` : '';
      console.log(`- ${match.request.id}${model} ← ${match.anchorDocId}`);
      console.log(`  ${match.request.purpose}`);
    }
    if (feedbackMatches.length > 10) {
      console.log(`  ... 외 ${feedbackMatches.length - 10}건`);
    }
  }
}

// ── boundary (DefDataSource 기반) ─────────────────────

export async function cmdBoundary(
  source: DefDataSource,
  docId: string | undefined,
  flags: Record<string, string>,
) {
  const level = flags['level'] === 'purpose' ? 'purpose' : 'overview';
  const resolvedDocId = await resolveDocId(source, docId, flags['address']);
  if (!resolvedDocId) {
    const lookup = flags['address'] ? `address "${flags['address']}"` : `문서 "${docId}"`;
    console.log(`${lookup} 없음`);
    return;
  }
  const boundaryData = await source.getBoundary(resolvedDocId, level);
  if (!boundaryData) {
    console.log(`문서 "${resolvedDocId}" 없음`);
    return;
  }

  if (flags['json'] === 'true') {
    console.log(JSON.stringify(boundaryData, null, 2));
    return;
  }

  console.log(`# 바운더리: ${boundaryData.boundary.title}\n`);
  console.log(
    `scope: ${boundaryData.boundary.scope}/${boundaryData.boundary.aspect}  depth: ${boundaryData.boundary.depth}  lifecycle: ${boundaryData.boundary.lifecycle}`,
  );
  if (boundaryData.boundary.layer) console.log(`layer: ${boundaryData.boundary.layer}`);
  if (boundaryData.boundary.svc) console.log(`svc: ${boundaryData.boundary.svc}`);

  if (boundaryData.boundary.purpose) {
    console.log(`\n## 목적`);
    console.log(boundaryData.boundary.purpose);
  }

  if (level === 'overview' && boundaryData.boundary.overview) {
    console.log(`\n## 개요`);
    console.log(`- ${boundaryData.boundary.overview.split('\n')[0]?.trim() || '(요약 없음)'}`);
  }

  console.log(`\n## 구조`);
  if (boundaryData.members.length === 0) {
    console.log(`- (contains 멤버 없음)`);
  } else {
    for (const child of boundaryData.members) {
      console.log(`- [${child.scope}/${child.aspect}] ${child.docId}: ${child.summary}`);
    }
  }

  console.log(`\n## 직접 결합`);
  console.log(`### outgoing`);
  if (boundaryData.couplings.outgoing.length === 0) {
    console.log(`- (없음)`);
  } else {
    for (const link of boundaryData.couplings.outgoing) {
      console.log(`- [${link.type}] ${link.target}: ${link.summary}`);
    }
  }

  console.log(`\n### incoming`);
  if (boundaryData.couplings.incoming.length === 0) {
    console.log(`- (없음)`);
  } else {
    for (const link of boundaryData.couplings.incoming) {
      console.log(`- [${link.type}] ${link.source}: ${link.summary}`);
    }
  }
}

export async function cmdBoundaryContext(
  source: DefDataSource,
  docId: string | undefined,
  flags: Record<string, string>,
) {
  const level = flags['level'] === 'purpose' ? 'purpose' : 'overview';
  const mode = flags['mode'] === 'direct' ? 'direct' : 'transitive';
  const resolvedDocId = await resolveDocId(source, docId, flags['address']);
  if (!resolvedDocId) {
    const lookup = flags['address'] ? `address "${flags['address']}"` : `문서 "${docId}"`;
    console.log(`${lookup} 없음`);
    return;
  }
  const result = await source.getBoundaryContext(resolvedDocId, level, mode);
  if (!result) {
    console.log(`문서 "${resolvedDocId}" 없음`);
    return;
  }

  if (flags['json'] === 'true') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const boundary = result.boundary.boundary;

  console.log(`# 바운더리 컨텍스트: ${boundary.title}\n`);
  console.log(
    `scope: ${boundary.scope}/${boundary.aspect}  depth: ${boundary.depth}  lifecycle: ${boundary.lifecycle}`,
  );
  console.log(`mode: ${result.mode}`);
  if (boundary.layer) console.log(`layer: ${boundary.layer}`);
  if (boundary.svc) console.log(`svc: ${boundary.svc}`);

  if (boundary.purpose) {
    console.log(`\n## 목적`);
    console.log(boundary.purpose);
  }

  if (level === 'overview' && boundary.overview) {
    console.log(`\n## 개요`);
    console.log(`- ${boundary.overview.split('\n')[0]?.trim() || '(요약 없음)'}`);
  }

  console.log(`\n## 구조`);
  if (result.boundary.members.length === 0) console.log(`- (contains 멤버 없음)`);
  else
    for (const member of result.boundary.members) {
      console.log(`- [${member.scope}/${member.aspect}] ${member.docId}: ${member.summary}`);
    }

  console.log(`\n## 직접 결합`);
  console.log(`### outgoing`);
  if (result.boundary.couplings.outgoing.length === 0) console.log(`- (없음)`);
  else
    for (const link of result.boundary.couplings.outgoing) {
      console.log(`- [${link.type}] ${link.target}: ${link.summary}`);
    }

  console.log(`\n### incoming`);
  if (result.boundary.couplings.incoming.length === 0) console.log(`- (없음)`);
  else
    for (const link of result.boundary.couplings.incoming) {
      console.log(`- [${link.type}] ${link.source}: ${link.summary}`);
    }

  console.log(`\n## concerns`);
  console.log(
    `직접: ${result.concerns.direct.length > 0 ? result.concerns.direct.join(', ') : '(없음)'}`,
  );
  if (result.concerns.inherited.length === 0) console.log(`상속: (없음)`);
  else
    for (const item of result.concerns.inherited) {
      console.log(`상속: ${item.tag} from ${item.source} via ${item.via}`);
    }

  console.log(`\n## impact`);
  console.log(`blast radius: ${result.impact.blastRadius}건`);
  if (result.impact.sourceAddress) {
    console.log(`source address: ${result.impact.sourceAddress}`);
  }
  if (result.impact.affectedGroups.length > 0) {
    console.log(`groups: ${result.impact.affectedGroups.join(', ')}`);
  }
  for (const item of result.impact.impacted.slice(0, 10)) {
    console.log(
      `- [${item.via}] ${formatLinkRef(item.docId, item.address)} (${item.direction}, depth ${item.distance})`,
    );
  }

  if (result.feedbackTrace.length > 0) {
    console.log(`\n## feedback trace`);
    for (const item of result.feedbackTrace.slice(0, 10)) {
      const model = item.targetModel ? ` [${item.targetModel}]` : '';
      console.log(`- ${item.id}${model}: ${item.purpose}`);
    }
  }
}
