// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  LINK_TYPE_RULES,
  deriveAllDomainRoots,
  getAspectFamily,
  type DefDataSource,
  type DefDoc,
} from 'definition-catalog';
import {
  formatLinkRef,
  getRootDir,
  parseCsvFlag,
} from './shared.js';
import { buildDomainRootRegistry } from './domain-registry.js';
import { collectDomainRelations, resolveDocId } from './graph-queries.js';
import { printDefinitionNextPage, printDefinitionPageSummary, printDefinitionRows } from './read-renderer.js';
// ── DataSource 기반 커맨드 ────────────────────────────

// 소스 파일 확장자로 구분되는 문서 유형. 예: `--type=rule` → `*.rule.md` 필터.
// frontmatter `doc.type` 이 "spec" 으로 통일되어 있으므로 CLI 측에서 ext 필터로 매핑한다.
const EXT_TYPE_FLAGS = new Set(['rule', 'cases', 'test', 'todo', 'plan', 'memo']);

export async function cmdList(source: DefDataSource, flags: Record<string, string>) {
  const limit = flags['limit'] ? Number(flags['limit']) : 50;
  const offset = flags['offset'] ? Number(flags['offset']) : 0;
  const domainRootFilter = flags['domain-root'];
  const includeChildren = flags['include-children'] === 'true';

  // --type 이 확장자 패턴이면 ext 필터로 매핑. 그 외에는 기존 doc_type 필터 유지.
  const typeFlag = flags['type'];
  const extFromType = typeFlag && EXT_TYPE_FLAGS.has(typeFlag) ? typeFlag : undefined;
  const ext = flags['ext'] ?? extFromType;

  const filter = {
    ...(typeFlag && !extFromType ? { type: typeFlag } : {}),
    knowledgeKind: flags['knowledge-kind'],
    scope: flags['scope'],
    aspect: flags['aspect'],
    depth: flags['depth'],
    lifecycle: flags['lifecycle'],
    layer: flags['layer'],
    level: flags['level'],
    svc: flags['svc'],
    tag: flags['tag'],
    ...(ext ? { ext } : {}),
    q: flags['q'],
    limit,
    offset,
  };

  // --domain-root 필터는 파생 결과 기반이므로 server list에서 처리 불가 → 클라이언트 측 필터링
  if (domainRootFilter) {
    return await cmdListByDomainRoot(source, filter, domainRootFilter, limit, offset);
  }

  // --include-children: aspect family (self + descendants) 전체 문서 집계.
  // DefListFilter 는 단일 aspect 만 받으므로 client 측에서 family 기반으로 필터링한다.
  // Phase C-2 (aspect-schema-hierarchy RFC).
  if (includeChildren) {
    if (!filter.aspect) {
      console.log(`[${source.mode}] --include-children 은 --aspect 가 함께 지정되어야 합니다.`);
      return;
    }
    return await cmdListWithAspectFamily(source, filter, limit, offset);
  }

  // 전체 건수 조회 (같은 필터, limit 없이)
  const total = (await source.list({ ...filter, limit: 100000, offset: 0 })).length;
  const docs = await source.list(filter);

  const to = printDefinitionPageSummary(source.mode, total, offset, docs.length);
  printDefinitionRows(docs);
  if (total - to > 0) printDefinitionNextPage(to, limit);
}

async function cmdListWithAspectFamily(
  source: DefDataSource,
  baseFilter: Record<string, unknown>,
  limit: number,
  offset: number,
): Promise<void> {
  const parentAspect = baseFilter['aspect'] as string;
  const family = getAspectFamily(parentAspect);

  // aspect 1 개씩 server/local 조회 후 merge. 서버 API 가 아직 multi-aspect 필터를 지원하지 않으므로
  // 클라이언트 측 집계로 구현한다. 조회 비용은 family 크기 (최대 8) 이므로 경미하다.
  const { aspect: _aspect, limit: _l, offset: _o, ...rest } = baseFilter;
  const seen = new Set<string>();
  const all: DefDoc[] = [];
  for (const aspect of family) {
    const docs = await source.list({ ...rest, aspect, limit: 100000, offset: 0 });
    for (const doc of docs) {
      if (seen.has(doc.docId)) continue;
      seen.add(doc.docId);
      all.push(doc);
    }
  }

  // 안정 정렬: aspect (family 순서) → docId
  const familyOrder = new Map(family.map((a, idx) => [a, idx]));
  all.sort((a, b) => {
    const ai = familyOrder.get(a.aspect ?? '') ?? Number.MAX_SAFE_INTEGER;
    const bi = familyOrder.get(b.aspect ?? '') ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.docId.localeCompare(b.docId);
  });

  const total = all.length;
  const page = all.slice(offset, offset + limit);
  console.log(
    `[${source.mode}] aspect=${parentAspect} (+${family.length - 1} children: ${family.slice(1).join(', ') || '없음'})`,
  );
  const to = printDefinitionPageSummary(undefined, total, offset, page.length, '  ');
  printDefinitionRows(page);
  if (total - to > 0) {
    printDefinitionNextPage(to, limit, ` --aspect=${parentAspect} --include-children`);
  }
}

/** Levenshtein 거리(간소화) — 비슷한 root id 추천용 */
function simpleDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  const m = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

async function cmdListByDomainRoot(
  source: DefDataSource,
  baseFilter: Record<string, unknown>,
  rootId: string,
  limit: number,
  offset: number,
): Promise<void> {
  const registry = await buildDomainRootRegistry(source);
  const allRoots = deriveAllDomainRoots(registry);

  // root 존재 여부 검사: 실제 파생 결과에 rootId가 한 번이라도 등장해야 valid
  const rootSet = new Set(allRoots.values());
  if (!rootSet.has(rootId)) {
    const suggestions = [...rootSet]
      .map((id) => ({ id, dist: simpleDistance(rootId, id) }))
      .toSorted((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .map((s) => s.id);
    console.log(`[${source.mode}] 도메인 루트 "${rootId}" 를 찾을 수 없습니다.`);
    if (suggestions.length > 0) {
      console.log(`  비슷한 루트 후보: ${suggestions.join(', ')}`);
    }
    console.log(`  전체 루트 목록: qa-sdk def audit --by-domain`);
    return;
  }

  // 기존 필터를 서버에 먼저 적용 (limit 없이 전체)
  const { limit: _l, offset: _o, ...filterRest } = baseFilter;
  const candidates = await source.list({ ...filterRest, limit: 100000, offset: 0 });

  // domain_root 일치 필터 + id 정렬
  const filtered = candidates
    .filter((d) => (allRoots.get(d.docId) ?? d.docId) === rootId)
    .toSorted((a, b) => a.docId.localeCompare(b.docId));

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);
  const to = printDefinitionPageSummary(
    undefined,
    total,
    offset,
    page.length,
    `[${source.mode}] domain-root=${rootId}  `,
  );
  printDefinitionRows(page);
  if (total - to > 0) {
    printDefinitionNextPage(to, limit, ` --domain-root=${rootId}`);
  }
}

export async function cmdGet(source: DefDataSource, docId?: string, address?: string) {
  const doc = address ? await source.getByAddress(address) : docId ? await source.get(docId) : null;
  const lookup = address ? `address "${address}"` : `문서 "${docId}"`;
  if (!doc) {
    console.log(`${lookup} 없음`);
    return;
  }
  console.log(`[${source.mode}] ${doc.docId}`);
  if (doc.level && doc.level !== 'leaf') console.log(`  level:     ${doc.level}`);
  console.log(`  scope:     ${doc.scope}/${doc.aspect}`);
  console.log(`  depth:     ${doc.depth}`);
  console.log(`  lifecycle: ${doc.lifecycle}`);
  if (doc.layer) console.log(`  layer:     ${doc.layer}`);
  if (doc.svc) console.log(`  svc:       ${doc.svc}`);
  if (doc.address) console.log(`  address:   ${doc.address}`);
  if (doc.tags.length > 0) console.log(`  tags:      ${doc.tags.join(', ')}`);
  const containsLinks = doc.links.filter((l) => l.type === 'contains');
  const otherLinks = doc.links.filter((l) => l.type !== 'contains');
  if (containsLinks.length > 0) {
    console.log(`  children (${containsLinks.length}):`);
    for (const l of containsLinks) console.log(`    ├── ${l.target}`);
  }
  if (otherLinks.length > 0) {
    console.log(`  links:`);
    for (const l of otherLinks) console.log(`    → ${l.target} (${l.type})`);
  }
  if (doc.purpose) console.log(`\n  purpose: ${doc.purpose.slice(0, 200)}`);

  const requests = await source.getFeedbackRequestsByDocId(doc.docId, 5);
  if (requests.length > 0) {
    console.log(`\n  feedback requests:`);
    for (const request of requests) {
      const model = request.targetModel ? ` [${request.targetModel}]` : '';
      console.log(`    - ${request.id}${model}: ${request.purpose}`);
    }
  }
}

export async function cmdBody(source: DefDataSource, docId: string, flags: Record<string, string>) {
  const result = await source.getBody(docId);
  if (!result) {
    console.log(`문서 "${docId}" 없음`);
    return;
  }
  if (flags['json'] === 'true') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`[${source.mode}] ${result.docId}`);
  if (result.docVersion) console.log(`  docVersion: ${result.docVersion}`);
  if (result.revision !== undefined) console.log(`  revision:   ${result.revision}`);
  if (result.bodyHash) console.log(`  bodyHash:   ${result.bodyHash}`);
  if (result.sourcePath) console.log(`  sourcePath: ${result.sourcePath}`);
  console.log('');
  process.stdout.write(result.body);
  if (!result.body.endsWith('\n')) process.stdout.write('\n');
}

export async function cmdChildren(source: DefDataSource, docId: string) {
  const relations = await collectDomainRelations(source, docId);
  console.log(
    `[${source.mode}] ${docId} → ${relations.members.length} members, ${relations.consumers.length} consumers`,
  );
  if (relations.members.length > 0) console.log(`  members:`);
  for (const relation of relations.members) {
    const c = relation.doc;
    const levelBadge = c.level && c.level !== 'leaf' ? `[${c.level}] ` : '';
    console.log(
      `    ${levelBadge}${c.docId}  ${c.scope ?? '?'}/${c.aspect ?? '?'}  ${c.lifecycle}  (${relation.via})`,
    );
    if (c.purpose) console.log(`    ${c.purpose.slice(0, 90)}`);
  }
  if (relations.consumers.length > 0) console.log(`  consumers (incoming depends_on):`);
  for (const relation of relations.consumers) {
    const c = relation.doc;
    console.log(
      `    ${c.docId}  ${c.scope ?? '?'}/${c.aspect ?? '?'}  ${c.lifecycle}  (${relation.via})`,
    );
    if (c.purpose) console.log(`    ${c.purpose.slice(0, 90)}`);
  }
}

export async function cmdParent(source: DefDataSource, docId: string) {
  const parent = await source.getParent(docId);
  if (parent) console.log(`[${source.mode}] ${docId} ← ${parent.docId}`);
  else console.log(`[${source.mode}] ${docId}: 부모 없음`);
}

export async function cmdIncoming(source: DefDataSource, docId?: string, address?: string) {
  const resolvedDocId = await resolveDocId(source, docId, address);
  if (!resolvedDocId) {
    const lookup = address ? `address "${address}"` : `문서 "${docId}"`;
    console.log(`${lookup} 없음`);
    return;
  }
  const links = await source.getIncomingLinks(resolvedDocId);
  console.log(`[${source.mode}] ${resolvedDocId} ← ${links.length} incoming`);
  for (const l of links) console.log(`  ${formatLinkRef(l.source, l.sourceAddress)} (${l.type})`);

  const syntheticIncoming = await source.getSyntheticIncomingLinks(resolvedDocId);
  if (syntheticIncoming.length > 0) {
    console.log(`\n  feedback_request:`);
    for (const link of syntheticIncoming) {
      const model = link.targetModel ? ` [${link.targetModel}]` : '';
      console.log(`  ${link.source}${model} (${link.type})`);
    }
  }
}

export async function cmdOutgoing(source: DefDataSource, docId?: string, address?: string) {
  const resolvedDocId = await resolveDocId(source, docId, address);
  if (!resolvedDocId) {
    const lookup = address ? `address "${address}"` : `문서 "${docId}"`;
    console.log(`${lookup} 없음`);
    return;
  }
  const links = await source.getOutgoingLinks(resolvedDocId);
  console.log(`[${source.mode}] ${resolvedDocId} → ${links.length} outgoing`);
  for (const l of links) console.log(`  ${formatLinkRef(l.target, l.targetAddress)} (${l.type})`);
}

export async function cmdValidate(source: DefDataSource, flags: Record<string, string> = {}) {
  // coordinate-storage.rule 자동 검출 — 기본 활성화 (server 모드는 무시).
  // --no-code-checks=true 또는 --no-code-checks 로 비활성화.
  const skipCodeChecks = flags['no-code-checks'] === 'true' || flags['no-code-checks'] === '';
  const result = await source.validate({
    includeCoordStorageCheck: !skipCodeChecks,
    repoRoot: process.cwd(),
  });
  if (result.passed) {
    console.log(`[${source.mode}] ✓ 검증 통과 (경고 ${result.warnings}건)`);
  } else {
    console.log(`[${source.mode}] ✗ 에러 ${result.errors}건, 경고 ${result.warnings}건`);
  }
  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  if (errors.length > 0) {
    console.log(`\n[error]`);
    errors.slice(0, 10).forEach((i) => console.log(`  ${i.docId}: ${i.message}`));
    if (errors.length > 10) console.log(`  ... 외 ${errors.length - 10}건`);
  }
  if (warnings.length > 0) {
    console.log(`\n[warning]`);
    const warningLimit = process.env.QA_DEF_VALIDATE_VERBOSE ? warnings.length : 5;
    const tag = process.env.QA_DEF_VALIDATE_VERBOSE
      ? (i: { type: string; docId: string; message: string }) =>
          `  [${i.type}] ${i.docId}: ${i.message}`
      : (i: { type: string; docId: string; message: string }) => `  ${i.docId}: ${i.message}`;
    warnings.slice(0, warningLimit).forEach((i) => console.log(tag(i)));
    if (warnings.length > warningLimit) console.log(`  ... 외 ${warnings.length - warningLimit}건`);
  }
}


export async function cmdFindByFile(source: DefDataSource, filePath: string) {
  const root = getRootDir();
  const absPath = resolve(root, filePath);
  const relPath = relative(root, absPath);

  // 1. packages/ 디렉토리에서 패키지 이름 추출
  const match = relPath.match(/^packages\/([^/]+)\//);
  if (!match) {
    console.log(`"${relPath}"는 packages/ 디렉토리에 속하지 않습니다.`);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- !match 검사 통과 후 캡처 그룹 [1] 존재 보장
  const pkgDir = match[1]!;
  const pkgJsonPath = join(root, 'packages', pkgDir, 'package.json');

  let pkgName = pkgDir;
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      pkgName = ((pkg.name as string) ?? pkgDir).replace(/^@qa-sdk\//, '');
    } catch {
      /* fallback to dir name */
    }
  }

  console.log(`파일: ${relPath}`);
  console.log(`패키지: ${pkgDir} (${pkgName})`);
  console.log('');

  if (source.mode === 'scan') {
    console.log('find-by-file는 DB-owned code reference가 필요합니다.');
    console.log('  → qa-sdk def sync 후 local/server datasource에서 다시 실행하세요.');
    return;
  }

  const mapping = await source.resolveByFile(relPath);

  if (mapping.kind === 'none') {
    console.log('구조적으로 증명 가능한 code↔doc mapping이 없습니다.');
    console.log(
      '  → 코드 주석에 `@def.boundary <doc-id>[#symbol]` 또는 `@def.doc <doc-id>[#symbol]`를 추가하세요.',
    );
    console.log(
      '  → 또는 문서 frontmatter top-level에 `source: packages/.../file.ts[:symbol]`를 추가하세요.',
    );
    console.log('  → 그런 뒤 `qa-sdk def sync`를 다시 실행하세요.');
    console.log('  → explicit source-map이 없으면 find-by-file는 결과를 주지 않습니다.');
    return;
  }

  if (mapping.kind === 'evidence-only') {
    console.log('source-map evidence는 있지만 authoritative boundary가 선언되지 않았습니다.');
    console.log(
      '  → `sources`와 `@def.doc`는 supporting evidence만 제공하므로 `@def.boundary <doc-id>`를 추가하세요.\n',
    );
    console.log(`source-map evidence (${mapping.supportingDocs.length}건):`);
    for (const doc of mapping.supportingDocs) {
      console.log(`  - ${formatLinkRef(doc.docId, doc.address)}`);
    }
    return;
  }

  if (mapping.kind === 'ambiguous') {
    console.log('explicit source-map이 둘 이상의 boundary anchor로 갈라집니다.');
    if (mapping.references.some((ref) => ref.symbol)) {
      console.log('  → symbol별 mapping이 있으면 `<경로:심볼>`로 다시 조회하세요.');
    }
    console.log(
      '  → 단일 authoritative boundary로 정리되기 전까지 find-by-file는 결과를 확정하지 않습니다.\n',
    );
    for (const item of mapping.candidates) {
      console.log(`- anchor: ${formatLinkRef(item.anchor.docId, item.anchor.address)}`);
      const docIds = new Set(item.supportingDocs.map((doc) => doc.docId));
      const symbols = [
        ...new Set(
          item.references
            .filter((ref) => docIds.has(ref.docId))
            .map((ref) => ref.symbol)
            .filter(Boolean),
        ),
      ];
      if (symbols.length > 0) {
        console.log(`  symbols: ${symbols.join(', ')}`);
      }
      for (const doc of item.supportingDocs) {
        console.log(`  - doc: ${formatLinkRef(doc.docId, doc.address)}`);
      }
    }
    return;
  }

  console.log(
    `authoritative boundary: ${formatLinkRef(mapping.anchor.docId, mapping.anchor.address)}`,
  );
  console.log(`  scope: ${mapping.anchor.scope}/${mapping.anchor.aspect}`);
  console.log(`  depth: ${mapping.anchor.depth}`);
  if (mapping.anchor.level) console.log(`  level: ${mapping.anchor.level}`);
  if (mapping.anchor.svc) console.log(`  svc: ${mapping.anchor.svc}`);
  if (mapping.anchor.purpose) {
    console.log(`  purpose: ${mapping.anchor.purpose.slice(0, 160)}`);
  }

  console.log(`\nsource-map support (${mapping.supportingDocs.length}건):`);
  for (const doc of mapping.supportingDocs) {
    const marker = doc.docId === mapping.anchor.docId ? '  *' : '  -';
    console.log(
      `${marker} ${formatLinkRef(doc.docId, doc.address)}  ${doc.scope}/${doc.aspect}  ${doc.depth}`,
    );
  }
}

export async function cmdGuide(source: DefDataSource, topic?: string) {
  switch (topic) {
    case 'authoring': {
      const doc = await source.get('definition-authoring-guide');
      console.log('=== 문서 작성 빠른 진입 ===\n');
      console.log(doc?.purpose ?? '(definition-authoring-guide 문서 없음)');
      console.log('\n핵심 체크:');
      console.log('  1. 책임/좌표 결정: E/C/I/S + L/P, tier/scope/aspect/depth + layer/lifecycle');
      console.log('  2. frontmatter: id, links, svc, tags');
      console.log('  3. 본문: ^purpose 필수, contains parent는 ^overview + contains');
      console.log(
        '  4. 코드 매핑: source: + @def.boundary/@def.doc → def sync → def find-by-file <경로[:symbol]>',
      );
      console.log('\n바로 보기:');
      console.log('  def body definition-authoring-guide');
      console.log('  def body definition-mgmt-coordinates');
      console.log('  def body definition-mgmt-verification-loop');
      return;
    }
    case 'management':
    case 'workflow': {
      const doc = await source.get('definition-management');
      const children = await source.getChildren('definition-management');
      console.log('=== definition 관리 흐름 ===\n');
      console.log(doc?.purpose ?? '(definition-management 문서 없음)');
      if (children.length > 0) {
        console.log('\n관리 단계:');
        for (const child of children.toSorted((a, b) => a.docId.localeCompare(b.docId))) {
          console.log(`  - ${child.docId}`);
          if (child.purpose) console.log(`    ${child.purpose.slice(0, 100)}`);
        }
      }
      console.log('\n바로 보기:');
      console.log('  def body definition-management');
      console.log('  def children definition-management');
      console.log('  def body definition-mgmt-coordinates');
      console.log('  def body definition-mgmt-verification-loop');
      return;
    }
    case 'concepts': {
      const doc = await source.get('system-concepts');
      console.log('=== 핵심 개념 ===\n');
      console.log(doc?.purpose ?? '(system-concepts 문서 없음)');
      console.log('\n더 알아보기:');
      console.log('  def get system-concepts');
      console.log('  def search "좌표"');
      console.log('  def search "prefix"');
      return;
    }
    case 'classification': {
      const _taxonomy = await source.get('definition-taxonomy');
      const _level = await source.get('definition-level');
      console.log('=== 문서 분류 체계 ===\n');
      console.log('분류 축:');
      console.log('  tier          — 구조 책임 (system/layout/component/entry)');
      console.log(
        '  scope (7종)  — 무엇에 대한 정의인가 (ui/feature/flow/state/constraint/data/interface)',
      );
      console.log('  aspect (22종) — 어떤 측면을 정의하는가 (scope별 2~5종)');
      console.log(
        '  depth (4종)  — 얼마나 상세한가 (overview/specification/implementation/validation)',
      );
      console.log('\n메타데이터:');
      console.log('  level (3종)  — contains 검증용 보조 메타데이터 (group/module/leaf)');
      console.log('  layer (4종)  — 왜 존재하는가 (domain/operation/mediation/experience)');
      console.log('  lifecycle    — 현재 상태 (draft/review/approved/deprecated/archived)');
      console.log('\n더 알아보기:');
      console.log('  def get definition-taxonomy   # 전체 분류 체계');
      console.log('  def get definition-level      # 분해 레벨 설계 근거');
      console.log('  def link-rules                # 관계 유형 규칙');
      console.log('  def stats                     # 현재 분포');
      return;
    }
    case 'services': {
      const children = await source.getChildren('system-infra');
      console.log('=== 인프라 서비스 ===\n');
      for (const c of children) {
        const levelBadge = c.level && c.level !== 'leaf' ? `[${c.level}] ` : '';
        console.log(`  ${levelBadge}${c.docId}`);
        if (c.purpose) console.log(`    ${c.purpose.slice(0, 90)}`);
      }
      const support = await source.getChildren('system-support');
      console.log('\n=== 보조 서비스 ===\n');
      for (const c of support) {
        const levelBadge = c.level && c.level !== 'leaf' ? `[${c.level}] ` : '';
        console.log(`  ${levelBadge}${c.docId}`);
        if (c.purpose) console.log(`    ${c.purpose.slice(0, 90)}`);
      }
      console.log('\n더 알아보기:');
      console.log('  def get <서비스ID>     # 서비스 상세');
      console.log('  def topdown <서비스ID> # 서비스 내부 조립');
      return;
    }
    case 'philosophy': {
      const doc = await source.get('definition-system-philosophy');
      console.log('=== 시스템 철학 ===\n');
      console.log(doc?.purpose ?? '(문서 없음)');
      console.log('\n더 알아보기:');
      console.log('  def get definition-system-philosophy');
      console.log('  def get dual-coordinate-system');
      console.log('  def search "철학"');
      return;
    }
    default: {
      // 전체 구조 안내
      const root = await source.get('system-root');
      const areas = await source.getChildren('system-root');
      const allDocs = await source.list({ limit: 100000 });
      const approved = allDocs.filter((d) => d.lifecycle === 'approved').length;
      const deprecated = allDocs.filter((d) => d.lifecycle === 'deprecated').length;

      const byLevel: Record<string, number> = {};
      for (const d of allDocs) byLevel[d.level ?? 'leaf'] = (byLevel[d.level ?? 'leaf'] ?? 0) + 1;

      console.log('=== qa-sdk 시스템 가이드 ===\n');
      console.log(root?.purpose ?? '');
      console.log(`\n문서 ${allDocs.length}건 (approved ${approved}, deprecated ${deprecated})`);
      console.log(
        `level: ${Object.entries(byLevel)
          .toSorted((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k}(${v})`)
          .join(' ')}`,
      );

      console.log('\n=== 영역 구조 ===\n');
      for (const a of areas) {
        const childCount = (await source.getChildren(a.docId)).length;
        console.log(`  [area] ${a.docId} (${childCount} children)`);
        if (a.purpose) console.log(`    ${a.purpose.slice(0, 80)}`);
      }

      console.log('\n=== 다음 단계 ===\n');
      console.log('  def guide concepts        핵심 개념 (좌표, prefix, 축)');
      console.log('  def guide classification  문서 분류 체계 (scope, level, layer)');
      console.log('  def guide authoring       핵심 작성 규칙');
      console.log('  def guide management      definition 관리 흐름');
      console.log('  def guide services        서비스 구조');
      console.log('  def guide philosophy      시스템 철학');
      console.log('  def children <area-id>    영역 내부 탐색');
      console.log('  def search <키워드>       개념 검색');
      return;
    }
  }
}

export function cmdLinkRules() {
  console.log('=== LinkType 사용 규칙 ===\n');
  for (const rule of LINK_TYPE_RULES) {
    console.log(`[${rule.id}] ${rule.name} — "A가 B를 ${rule.verb}"`);
    console.log(`  ${rule.description}`);
    console.log(
      `  순환: ${rule.allowCycle ? '허용' : '금지'} | 다중부모: ${rule.multiParent ? '허용' : '경고 (cross-scope 태그 시 허용)'}`,
    );
    console.log(`  사용: ${rule.when}`);
    console.log(`  주의: ${rule.notTo}`);
    console.log('');
  }
}
