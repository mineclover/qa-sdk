// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk def — definition-catalog 문서 관리 CLI.
 *
 * 데이터 소스: SQLite 직접 접근(기본) 또는 definition-service HTTP.
 *   --local:  SQLite DB 직접 (서버 불필요)
 *   --server: definition-service API (기본: localhost:3700)
 *   --scan:   docs/ frontmatter 직접 스캔 (read-only degraded mode)
 *   생략:     DB 파일 있으면 local, 없으면 server, 둘 다 없으면 scan 시도
 *
 * 모든 조회/분석 명령은 DefDataSource 기반. scan만 파일 직접 스캔.
 */

import { dirname, join, resolve, relative } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { execa } from 'execa';
import {
  CONCERN_TAGS,
  scanAndBuild,
  LINK_TYPE_RULES,
  readDefConfig,
  detectDrift,
  extractByLevel,
  hashFrontmatter,
  computeDistribution,
  createInstance,
  createHarnessRegistry,
  deriveDocLifecycle,
  deriveSpecImplState,
  deriveConventionState,
  deriveSyncState,
  extractByMarker,
  extractFrontmatter,
  validateGraph,
  collectCodeLinkCoverage,
  collectCodeReferences,
  deriveAllDomainRoots,
  deriveDomainRoot,
  detectOwnerRootMismatch,
  deriveAspectParent,
  getAspectFamily,
  ASPECT_PARENTS,
  ROOT_ASPECTS,
  DEF_ASPECT,
  type DefDataSource,
  type DefDoc,
  type DefFeedbackRequestSummary,
  type StateMachineInstance,
  type DomainRootRegistry,
  type DefinitionEntry,
  type DefinitionLink,
} from 'definition-catalog';
import {
  createDataSource,
  syncDocsToLocalDb,
  type DataSourceOptions,
} from 'definition-data-source';
import {
  analyzeDrift,
  extractDeclarations,
  scanImplementations,
  type DriftReport,
} from 'spec-analyzer';
import type { VerificationDefinitionBinding, VerificationSummary } from 'spec-tracker';
import { formatHelpSections, type CommandHelpSectionSpec } from '../command-spec.js';
import { cmdTierClassify } from '../lib/def-tier-classify.cmd.js';
import {
  writeVerificationBindingsFile,
  resolveVerificationReadModel,
  writeVerificationArtifactFile,
  type VerificationReadModel,
} from '../lib/spec-definition-verification.js';
import {
  createDefinitionTaskHandoff,
  buildBoundedDefinitionContext,
  executeDefinitionTaskDecompositionWithDiscovery,
  type DefinitionChildExecutionResult,
} from '../lib/context-runtime/definition-document-context.js';
import { JsonTaskHandoffStore } from '../lib/context-runtime/task-handoff-store.js';
import {
  loadProviderTokenCounter,
  loadProviderTokenCounterFromRegistry,
  readProviderUsageEvent,
} from '../lib/context-runtime/provider-usage-adapters.js';
import {
  createContextUsageLedger,
  type ContextStopPolicy,
  type ContextUsageSummary,
  type DiscoveryTaskDecomposition,
} from 'context-runtime';

// ── 유틸 ──────────────────────────────────────────────

function getRootDir(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml')) && existsSync(join(current, 'docs'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

type FeedbackTraceMatch = {
  anchorDocId: string;
  request: DefFeedbackRequestSummary;
};

interface DefinitionDiscoveryResultsInput {
  readonly results: Map<string, DefinitionChildExecutionResult>;
  readonly unresolvedQuestions: readonly string[];
}

const CONCERN_TAG_SET = new Set<string>(CONCERN_TAGS);
const BOUNDARY_LEVELS = new Set(['group', 'module']);

function extractConcernTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => CONCERN_TAG_SET.has(tag));
}

function formatLinkRef(id: string, address?: string): string {
  return address ? `${id} <${address}>` : id;
}

function hasFlag(flags: Record<string, string>, name: string): boolean {
  return flags[name] === 'true';
}

function parseNonNegativeIntegerFlag(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

async function collectFeedbackMatches(
  source: DefDataSource,
  docIds: readonly string[],
): Promise<FeedbackTraceMatch[]> {
  const seen = new Set<string>();
  const matches: FeedbackTraceMatch[] = [];

  for (const docId of docIds) {
    const requests = await source.getFeedbackRequestsByDocId(docId, 20);
    for (const request of requests) {
      const key = `${docId}:${request.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ anchorDocId: docId, request });
    }
  }

  return matches.toSorted((left, right) =>
    right.request.createdAt.localeCompare(left.request.createdAt),
  );
}

function parseFlags(args: string[]): {
  positional: string[];
  options: DataSourceOptions;
  flags: Record<string, string>;
} {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let mode: DataSourceOptions['mode'];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--local') {
      mode = 'local';
      continue;
    }
    if (arg === '--server') {
      mode = 'server';
      continue;
    }
    if (arg === '--scan') {
      mode = 'scan';
      continue;
    }
    if (arg.startsWith('--')) {
      const [k, inline] = arg.slice(2).split('=', 2);
      const next = args[index + 1];
      if (inline !== undefined) {
        flags[k] = inline;
      } else if (next && !next.startsWith('--')) {
        flags[k] = next;
        index += 1;
      } else {
        flags[k] = 'true';
      }
      continue;
    }
    positional.push(arg);
  }

  const dbPath = flags['db'] ?? flags['db-path'];
  const serverUrl = flags['server-url'];
  const docsDir = flags['docs'];

  return {
    positional,
    options: {
      ...(mode ? { mode } : {}),
      ...(dbPath ? { dbPath } : {}),
      ...(serverUrl ? { serverUrl } : {}),
      ...(docsDir ? { docsDir } : {}),
    },
    flags,
  };
}

function parseCsvFlag(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseContextStopPolicy(flags: Record<string, string>): ContextStopPolicy | undefined {
  const routeKeys = parseCsvFlag(flags['stop-routes']);
  const factKeys = parseCsvFlag(flags['stop-facts']);
  const evidenceKeys = parseCsvFlag(flags['stop-evidence']);
  const hasStopFlags =
    flags['stop-routes'] !== undefined ||
    flags['stop-facts'] !== undefined ||
    flags['stop-evidence'] !== undefined ||
    flags['no-progress-limit'] !== undefined;
  if (!hasStopFlags) return undefined;
  if (flags['no-progress-limit'] === 'true') {
    throw new Error('--no-progress-limit에는 양의 정수가 필요합니다');
  }

  const obligations = [
    ...routeKeys.map((key) => ({ kind: 'route' as const, key })),
    ...factKeys.map((key) => ({ kind: 'fact' as const, key })),
    ...evidenceKeys.map((key) => ({ kind: 'evidence' as const, key })),
  ];
  if (obligations.length === 0) {
    throw new Error(
      '--stop-routes/--stop-facts/--stop-evidence 중 하나 이상의 obligation이 필요합니다',
    );
  }

  const noProgressLimit = flags['no-progress-limit']
    ? parseNonNegativeIntegerFlag(flags['no-progress-limit'], 'no-progress-limit')
    : undefined;
  if (noProgressLimit !== undefined && noProgressLimit < 1) {
    throw new Error('--no-progress-limit must be a positive integer');
  }
  return Object.freeze({
    obligations: Object.freeze(obligations),
    ...(noProgressLimit !== undefined ? { noProgressLimit } : {}),
  });
}

async function getSource(options: DataSourceOptions): Promise<DefDataSource> {
  return createDataSource(options);
}

function closeDataSource(source: DefDataSource | undefined): void {
  if (!source) return;
  if ('close' in source && typeof (source as { close?: () => void }).close === 'function') {
    (source as { close: () => void }).close();
  }
}

// ── DataSource 기반 커맨드 ────────────────────────────

// 소스 파일 확장자로 구분되는 문서 유형. 예: `--type=rule` → `*.rule.md` 필터.
// frontmatter `doc.type` 이 "spec" 으로 통일되어 있으므로 CLI 측에서 ext 필터로 매핑한다.
const EXT_TYPE_FLAGS = new Set(['rule', 'cases', 'test', 'todo', 'plan', 'memo']);

async function cmdList(source: DefDataSource, flags: Record<string, string>) {
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

  const from = offset + 1;
  const to = offset + docs.length;
  const remaining = total - to;

  console.log(
    `[${source.mode}] ${from}-${to} / ${total}건${remaining > 0 ? ` (미표시 ${remaining}건)` : ''}`,
  );
  for (const d of docs) {
    const levelBadge = d.level && d.level !== 'leaf' ? `[${d.level}] ` : '';
    const tags = d.tags.length > 0 ? ` [${d.tags.join(',')}]` : '';
    console.log(`  ${levelBadge}${d.docId}  ${d.scope}/${d.aspect}  ${d.lifecycle}${tags}`);
    if (d.purpose) {
      console.log(`    ${d.purpose.slice(0, 100)}`);
    }
  }

  if (remaining > 0) {
    console.log(`\n  다음 페이지: --offset=${to} --limit=${limit}`);
  }
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
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + page.length;
  const remaining = total - to;

  console.log(
    `[${source.mode}] aspect=${parentAspect} (+${family.length - 1} children: ${family.slice(1).join(', ') || '없음'})`,
  );
  console.log(`  ${from}-${to} / ${total}건${remaining > 0 ? ` (미표시 ${remaining}건)` : ''}`);
  for (const d of page) {
    const levelBadge = d.level && d.level !== 'leaf' ? `[${d.level}] ` : '';
    const tags = d.tags.length > 0 ? ` [${d.tags.join(',')}]` : '';
    console.log(`  ${levelBadge}${d.docId}  ${d.scope}/${d.aspect}  ${d.lifecycle}${tags}`);
    if (d.purpose) {
      console.log(`    ${d.purpose.slice(0, 100)}`);
    }
  }

  if (remaining > 0) {
    console.log(
      `\n  다음 페이지: --offset=${to} --limit=${limit} --aspect=${parentAspect} --include-children`,
    );
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
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + page.length;
  const remaining = total - to;

  console.log(
    `[${source.mode}] domain-root=${rootId}  ${from}-${to} / ${total}건${remaining > 0 ? ` (미표시 ${remaining}건)` : ''}`,
  );
  for (const d of page) {
    const levelBadge = d.level && d.level !== 'leaf' ? `[${d.level}] ` : '';
    const tags = d.tags.length > 0 ? ` [${d.tags.join(',')}]` : '';
    console.log(`  ${levelBadge}${d.docId}  ${d.scope}/${d.aspect}  ${d.lifecycle}${tags}`);
    if (d.purpose) {
      console.log(`    ${d.purpose.slice(0, 100)}`);
    }
  }

  if (remaining > 0) {
    console.log(`\n  다음 페이지: --offset=${to} --limit=${limit} --domain-root=${rootId}`);
  }
}

async function cmdGet(source: DefDataSource, docId?: string, address?: string) {
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

async function cmdBody(source: DefDataSource, docId: string, flags: Record<string, string>) {
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

async function cmdChildren(source: DefDataSource, docId: string) {
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

async function cmdParent(source: DefDataSource, docId: string) {
  const parent = await source.getParent(docId);
  if (parent) console.log(`[${source.mode}] ${docId} ← ${parent.docId}`);
  else console.log(`[${source.mode}] ${docId}: 부모 없음`);
}

async function resolveDocId(
  source: DefDataSource,
  docId?: string,
  address?: string,
): Promise<string | null> {
  if (address) {
    const doc = await source.getByAddress(address);
    return doc?.docId ?? null;
  }
  return docId ?? null;
}

async function cmdIncoming(source: DefDataSource, docId?: string, address?: string) {
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

async function cmdOutgoing(source: DefDataSource, docId?: string, address?: string) {
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

async function cmdValidate(source: DefDataSource, flags: Record<string, string> = {}) {
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

// ── 영향 분석 + 변경 경고 ─────────────────────────────

const CHANGE_THRESHOLD = 3; // depends_on 이 수 이상이면 대규모 변경 경고

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

async function cmdImpact(source: DefDataSource, docId?: string, address?: string) {
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

async function cmdCheck(source: DefDataSource, docId: string) {
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

async function cmdSearch(source: DefDataSource, query: string) {
  const docs = await source.list({ q: query, limit: 20 });
  console.log(`[${source.mode}] "${query}" → ${docs.length}건`);
  for (const d of docs) {
    const preview = d.purpose?.slice(0, 80) ?? '';
    console.log(`  ${d.docId}  ${d.scope}/${d.aspect}  ${preview}`);
  }
}

async function cmdConcepts(source: DefDataSource, flags: Record<string, string>) {
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

async function cmdStats(source: DefDataSource) {
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

async function cmdOverview(source: DefDataSource) {
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

async function cmdAuditDb(source: DefDataSource) {
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

// ── topdown (DefDataSource 기반) ──────────────────────

type DomainRelationVia = 'contains' | 'refs' | 'refines←' | 'depends_on←';

interface DomainRelation {
  readonly doc: DefDoc;
  readonly via: DomainRelationVia;
}

interface DomainRelations {
  readonly members: readonly DomainRelation[];
  readonly consumers: readonly DomainRelation[];
}

/**
 * 도메인 관계 조회 — Phase 3b Option B 데이터 모델을 반영하되,
 * 구조 멤버와 소비자를 분리한다.
 *
 * - contains 순방향: 전통적인 group → member 선언 (system-infra 등 레거시 레이아웃).
 * - refs 순방향: Layout/Pack 이 독립 System/Interface 를 조망.
 * - refines 역방향: 추상 → 구체 관계로 파생 문서를 포함.
 * - depends_on 역방향: 이 문서를 소비하는 dependents. 구조 멤버처럼 출력하지 않는다.
 *
 * Option B 이후 incoming depends_on 이 membership 처럼 쓰인 케이스가 있었지만,
 * 일반 의존자도 같은 경로에 걸리므로 UX 에서는 별도 consumer 섹션으로 분리한다.
 */
async function collectDomainRelations(
  source: DefDataSource,
  parentId: string,
): Promise<DomainRelations> {
  const seenMembers = new Set<string>();
  const seenConsumers = new Set<string>();
  const members: DomainRelation[] = [];
  const consumers: DomainRelation[] = [];

  const appendMember = (doc: DefDoc | null | undefined, via: DomainRelationVia) => {
    if (!doc) return;
    if (doc.docId === parentId) return;
    if (seenMembers.has(doc.docId)) return;
    seenMembers.add(doc.docId);
    members.push({ doc, via });
  };

  const appendConsumer = (doc: DefDoc | null | undefined, via: DomainRelationVia) => {
    if (!doc) return;
    if (doc.docId === parentId) return;
    if (seenMembers.has(doc.docId) || seenConsumers.has(doc.docId)) return;
    seenConsumers.add(doc.docId);
    consumers.push({ doc, via });
  };

  // 1. contains 순방향 — 전통적 group 선언
  for (const child of await source.getChildren(parentId)) {
    appendMember(child, 'contains');
  }

  // 2. refs 순방향 — Layout/Pack 조망
  const parent = await source.get(parentId);
  for (const link of parent?.links ?? []) {
    if (link.type !== 'refs') continue;
    appendMember(await source.get(link.target), 'refs');
  }

  // 3. refines 역방향은 구조적 상세화, depends_on 역방향은 소비자로 분리
  const incoming = await source.getIncomingLinks(parentId);
  for (const link of incoming) {
    if (link.type === 'refines') appendMember(await source.get(link.source), 'refines←');
    if (link.type === 'depends_on') appendConsumer(await source.get(link.source), 'depends_on←');
  }

  const compare = (a: DomainRelation, b: DomainRelation) =>
    (a.doc.scope ?? '').localeCompare(b.doc.scope ?? '') || a.doc.docId.localeCompare(b.doc.docId);

  return {
    members: members.toSorted(compare),
    consumers: consumers.toSorted(compare),
  };
}

async function collectDomainMembers(source: DefDataSource, parentId: string): Promise<DefDoc[]> {
  const relations = await collectDomainRelations(source, parentId);
  return relations.members
    .map((relation) => relation.doc)
    .toSorted(
      (a, b) => (a.scope ?? '').localeCompare(b.scope ?? '') || a.docId.localeCompare(b.docId),
    );
}

async function cmdTopdown(
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

async function cmdBottomup(source: DefDataSource, docId: string) {
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

// ── context (DefDataSource 기반) ──────────────────────

async function cmdContext(
  source: DefDataSource,
  docId: string,
  flags: Record<string, string> = {},
) {
  const doc = await source.get(docId);
  if (!doc) {
    console.log(`문서 "${docId}" 없음`);
    return;
  }

  if (flags['bounded'] === 'true') {
    if (flags['initial-usage'] && flags['provider-usage']) {
      throw new Error('--initial-usage와 --provider-usage는 동시에 사용할 수 없습니다');
    }
    const providerUsage = flags['provider-usage']
      ? createContextUsageLedger([
          readProviderUsageEvent(
            flags['provider-usage'],
            flags['provider'],
            flags['provider-phase'],
          ),
        ]).snapshot()
      : undefined;
    if (flags['tokenizer-module'] && flags['tokenizer-registry']) {
      throw new Error('--tokenizer-module과 --tokenizer-registry는 동시에 사용할 수 없습니다');
    }
    if (
      !flags['tokenizer-module'] &&
      !flags['tokenizer-registry'] &&
      (flags['tokenizer-provider'] !== undefined || flags['tokenizer-model'] !== undefined)
    ) {
      throw new Error(
        '--tokenizer-provider/--tokenizer-model은 --tokenizer-module 또는 --tokenizer-registry와 함께 사용해야 합니다',
      );
    }
    const tokenizerSelection = {
      ...(flags['tokenizer-provider'] ? { provider: flags['tokenizer-provider'] } : {}),
      ...(flags['tokenizer-model'] ? { model: flags['tokenizer-model'] } : {}),
    };
    const stopPolicy = parseContextStopPolicy(flags);
    const tokenCounter = flags['tokenizer-module']
      ? await loadProviderTokenCounter(flags['tokenizer-module'], tokenizerSelection)
      : flags['tokenizer-registry']
        ? await loadProviderTokenCounterFromRegistry(
            flags['tokenizer-registry'],
            tokenizerSelection,
          )
        : undefined;
    const bounded = await buildBoundedDefinitionContext({
      source,
      docId,
      document: doc,
      ...(flags['initial-usage']
        ? { initialUsage: readInitialUsageSummary(flags['initial-usage']) }
        : {}),
      ...(providerUsage ? { initialUsage: providerUsage } : {}),
      ...(tokenCounter ? { tokenCounter } : {}),
      ...(flags['used-tokens']
        ? { usedTokens: parseNonNegativeIntegerFlag(flags['used-tokens'], 'used-tokens') }
        : {}),
      ...(!flags['used-tokens'] && tokenCounter
        ? { usedTokensMeasurement: 'measured' as const }
        : {}),
      ...(stopPolicy ? { stopPolicy } : {}),
    });
    const persistedHandoff = flags['handoff-out']
      ? await persistDefinitionTaskHandoff(bounded, flags)
      : undefined;
    const boundedOutput = persistedHandoff
      ? { ...bounded, handoff: persistedHandoff.handoff }
      : bounded;
    if (flags['json'] === 'true') {
      console.log(JSON.stringify(boundedOutput, null, 2));
      return;
    }
    console.log(`# bounded 컨텍스트: ${doc.title ?? doc.docId}\n`);
    console.log(`discovery: ${bounded.discovery.status}`);
    console.log(`selected routes: ${bounded.discovery.selectedRouteKeys.join(', ') || '(없음)'}`);
    console.log(`working: ${bounded.workingContext.status}`);
    if (bounded.stopDecision) {
      console.log(`stop: ${bounded.stopDecision.reason} → ${bounded.stopDecision.action}`);
    }
    if (bounded.discovery.decomposition) {
      console.log(
        `decomposition: ${bounded.discovery.decomposition.children.length} child task(s) [${bounded.discovery.decomposition.reason}]`,
      );
    }
    console.log(
      `facts: ${bounded.workingContext.facts.map((fact) => fact.factKey).join(', ') || '(없음)'}`,
    );
    console.log(
      `manifest: ${bounded.manifest?.digest ?? '(not created — working context blocked)'}`,
    );
    if (persistedHandoff) console.log(`handoff: ${persistedHandoff.path}`);
    console.log(`observation: ${bounded.observation.eventName}`);
    return;
  }

  const parent = await source.getParent(docId);
  const outgoing = await source.getOutgoingLinks(docId);
  const incoming = await source.getIncomingLinks(docId);

  console.log(`# 컨텍스트: ${doc.title ?? doc.docId}\n`);
  const typeLabel =
    doc.type === 'knowledge' && doc.knowledgeKind
      ? `type: knowledge/${doc.knowledgeKind}`
      : doc.type
        ? `type: ${doc.type}`
        : '';
  console.log(
    `scope: ${doc.scope}/${doc.aspect}  depth: ${doc.depth}  lifecycle: ${doc.lifecycle}`,
  );
  if (typeLabel) console.log(typeLabel);
  if (doc.layer) console.log(`layer: ${doc.layer}`);
  if (doc.svc) console.log(`svc: ${doc.svc}`);
  if (doc.address) console.log(`address: ${doc.address}`);

  // domain_root 파생 — fail-open
  try {
    const registry = await buildDomainRootRegistry(source);
    const entry = registry.get(docId);
    if (entry) {
      const derivedRoot = deriveDomainRoot(entry, registry);
      if (derivedRoot === docId) {
        console.log(`도메인 루트: self`);
      } else {
        console.log(`도메인 루트: ${derivedRoot}`);
      }
      const mismatch = detectOwnerRootMismatch(entry, derivedRoot, registry);
      if (mismatch === 'mismatch' && entry.owner_system) {
        console.log(`⚠ owner_system (${entry.owner_system}) 과 파생 root (${derivedRoot}) 불일치`);
      }
    }
  } catch {
    // 파생 실패 시 조용히 스킵 (context의 나머지 출력은 계속)
  }

  // 목적
  if (doc.purpose) {
    console.log(`\n## 이 문서의 목적`);
    console.log(doc.purpose);
  }

  // 소속 (부모 그룹)
  if (parent) {
    console.log(`\n## 소속`);
    console.log(`- ${parent.docId}: ${parent.purpose?.slice(0, 120) ?? ''}`);
  }

  // 적용되는 제약
  const outgoingConstraints = outgoing.filter((l) => l.type === 'constrains');
  const implementedContracts = outgoing.filter((l) => l.type === 'implements');
  const constraintIncoming = incoming.filter((l) => l.type === 'constrains');
  if (
    outgoingConstraints.length > 0 ||
    implementedContracts.length > 0 ||
    constraintIncoming.length > 0
  ) {
    console.log(`\n## 적용되는 제약`);
    for (const c of constraintIncoming) {
      const cDoc = await source.get(c.source);
      console.log(
        `- [${formatLinkRef(c.source, c.sourceAddress)}]: ${cDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
    for (const c of outgoingConstraints) {
      const cDoc = await source.get(c.target);
      console.log(
        `- [constrains → ${formatLinkRef(c.target, c.targetAddress)}]: ${cDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
    for (const c of implementedContracts) {
      const cDoc = await source.get(c.target);
      console.log(
        `- [implements → ${formatLinkRef(c.target, c.targetAddress)}]: ${cDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
  }

  // 의존 대상
  const deps = outgoing.filter(
    (l) => l.type === 'depends_on' || l.type === 'implements' || l.type === 'refines',
  );
  if (deps.length > 0) {
    console.log(`\n## 의존 대상`);
    for (const d of deps) {
      const dDoc = await source.get(d.target);
      console.log(
        `- [${d.type}] ${formatLinkRef(d.target, d.targetAddress)}: ${dDoc?.purpose?.slice(0, 100) ?? ''}`,
      );
    }
  }

  // concerns (태그 기반 — 직접 + 상속)
  const directConcerns = extractConcernTags(doc.tags);
  const inheritedConcerns: string[] = [];
  for (const link of [...deps, ...(parent ? [{ target: parent.docId, type: 'contains' }] : [])]) {
    const target = await source.get(link.target);
    if (!target) continue;
    const tConcerns = extractConcernTags(target.tags);
    for (const c of tConcerns) {
      inheritedConcerns.push(`${c} from ${link.target} via ${link.type}`);
    }
  }
  if (directConcerns.length > 0 || inheritedConcerns.length > 0) {
    console.log(`\n## concerns`);
    if (directConcerns.length > 0) console.log(`직접: ${directConcerns.join(', ')}`);
    if (inheritedConcerns.length > 0) {
      for (const ic of new Set(inheritedConcerns)) {
        console.log(`상속: ${ic}`);
      }
    }
  }

  // 영향 범위
  const blastRadius = incoming.filter((l) => l.type !== 'contains');
  console.log(`\n## 영향 범위`);
  console.log(`blast radius: ${blastRadius.length}건`);
  for (const b of blastRadius.slice(0, 10)) {
    console.log(`- [${b.type}] ${formatLinkRef(b.source, b.sourceAddress)}`);
  }
  if (blastRadius.length > 10) console.log(`  ... 외 ${blastRadius.length - 10}건`);

  const requests = await source.getFeedbackRequestsByDocId(docId, 5);
  if (requests.length > 0) {
    console.log(`\n## 최근 Feedback Requests`);
    for (const request of requests) {
      const model = request.targetModel ? ` [${request.targetModel}]` : '';
      console.log(`- ${request.id}${model}: ${request.purpose}`);
    }
  }
}

async function cmdHandoff(rest: readonly string[], flags: Record<string, string>): Promise<void> {
  const storePath = rest[0] ?? flags['store'];
  const taskKey = rest[1] ?? flags['task-key'];
  if (!storePath || storePath === 'true' || !taskKey || taskKey === 'true') {
    console.log('Usage: qa-sdk def handoff <store-path> <task-key> [--json]');
    return;
  }

  const handoffs = await new JsonTaskHandoffStore(resolve(getRootDir(), storePath)).findByTaskKey(
    taskKey,
  );
  if (flags['json'] === 'true') {
    console.log(JSON.stringify(handoffs, null, 2));
    return;
  }

  console.log(`# Typed Handoff: ${taskKey}\n`);
  console.log(`records: ${handoffs.length}`);
  for (const handoff of handoffs) {
    console.log(`- result: ${handoff.resultRevision}`);
    console.log(`  source: ${handoff.sourceRevision}`);
    console.log(`  manifest: ${handoff.manifestDigest}`);
  }
}

/**
 * Aggregate exactly one completed child Handoff per decomposition slice.
 * The decomposition is accepted either directly or from a bounded context
 * JSON result's `discovery.decomposition` field.
 */
async function cmdHandoffAggregate(
  rest: readonly string[],
  flags: Record<string, string>,
): Promise<void> {
  const storePath = rest[0] ?? flags['store'];
  const decompositionPath = rest[1] ?? flags['decomposition'];
  const sourceRevision = flags['source-revision'];
  const resultRevision = flags['result-revision'];
  if (
    !storePath ||
    storePath === 'true' ||
    !decompositionPath ||
    decompositionPath === 'true' ||
    !sourceRevision ||
    sourceRevision === 'true' ||
    !resultRevision ||
    resultRevision === 'true'
  ) {
    console.log(
      'Usage: qa-sdk def handoff-aggregate <store-path> <decomposition.json> --source-revision <REV> --result-revision <REV> [--discovery-results <path>] [--unresolved-questions <csv>] [--json]',
    );
    return;
  }
  if (flags['unresolved-questions'] === 'true') {
    throw new Error('--unresolved-questions에는 csv 값이 필요합니다');
  }

  const nextTaskKey = flags['next-task-key'];
  const nextTaskObjective = flags['next-task-objective'];
  if (nextTaskKey === 'true' || nextTaskObjective === 'true') {
    throw new Error('--next-task-key와 --next-task-objective에는 값이 필요합니다');
  }
  if (Boolean(nextTaskKey) !== Boolean(nextTaskObjective)) {
    throw new Error('--next-task-key와 --next-task-objective는 함께 지정해야 합니다');
  }

  const decomposition = readDiscoveryDecomposition(decompositionPath);
  const store = new JsonTaskHandoffStore(resolve(getRootDir(), storePath));
  const discoveryInput = flags['discovery-results']
    ? readDefinitionDiscoveryResults(flags['discovery-results'])
    : { results: new Map<string, DefinitionChildExecutionResult>(), unresolvedQuestions: [] };
  const discoveryResults = discoveryInput.results;
  const decompositionTaskKeys = new Set(decomposition.children.map((child) => child.taskKey));
  for (const taskKey of discoveryResults.keys()) {
    if (!decompositionTaskKeys.has(taskKey)) {
      throw new Error(
        `discovery result가 decomposition에 없는 child Task를 가리킵니다: ${taskKey}`,
      );
    }
  }

  const execution = await executeDefinitionTaskDecompositionWithDiscovery({
    decomposition,
    executeChild: async (child) => {
      const discovery = discoveryResults.get(child.taskKey);
      if (discovery) return discovery;

      const history = await store.findByTaskKey(child.taskKey);
      if (history.length !== 1) {
        throw new Error(
          `child Task ${child.taskKey}는 정확히 하나의 Handoff가 필요합니다 (현재 ${history.length}건)`,
        );
      }
      return {
        taskKey: child.taskKey,
        kind: 'handoff',
        routeKeys: child.routeKeys,
        unresolvedQuestions: history[0]!.unresolvedQuestions,
        handoff: history[0]!,
      };
    },
    sourceRevision,
    resultRevision,
    unresolvedQuestions: [
      ...parseCsvFlag(flags['unresolved-questions']),
      ...discoveryInput.unresolvedQuestions,
    ],
    ...(nextTaskKey && nextTaskObjective
      ? { nextTask: { taskKey: nextTaskKey, objective: nextTaskObjective } }
      : {}),
  });
  if (!execution.handoff) {
    const failed = execution.execution.children.find((child) => child.status === 'failed');
    throw new Error(
      `parent Handoff를 만들 수 없습니다: ${failed?.error ?? execution.execution.status}`,
    );
  }

  const handoff = execution.handoff;
  await store.save(handoff);

  if (flags['json'] === 'true') {
    const output =
      execution.discoveryRefs.length > 0
        ? {
            handoff,
            discoveryRefs: execution.discoveryRefs,
            unresolvedQuestions: execution.unresolvedQuestions,
          }
        : handoff;
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log(`# Parent Typed Handoff: ${handoff.taskKey}\n`);
  console.log(`children: ${handoff.childTaskKeys?.length ?? 0}`);
  console.log(`discovery refs: ${execution.discoveryRefs.length}`);
  console.log(`result: ${handoff.resultRevision}`);
  console.log(`manifest: ${handoff.manifestDigest}`);
}

function readDiscoveryDecomposition(pathValue: string): DiscoveryTaskDecomposition {
  const path = resolve(getRootDir(), pathValue);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`decomposition JSON을 읽을 수 없습니다: ${path}`, { cause: error });
  }

  const candidate =
    isRecord(parsed) && isRecord(parsed.discovery) ? parsed.discovery.decomposition : parsed;
  if (!isRecord(candidate) || !Array.isArray(candidate.children)) {
    throw new Error('decomposition JSON은 children 배열을 포함해야 합니다');
  }
  return candidate as unknown as DiscoveryTaskDecomposition;
}

function readDefinitionDiscoveryResults(pathValue: string): DefinitionDiscoveryResultsInput {
  if (pathValue === 'true') {
    throw new Error('--discovery-results에는 discovery result JSON 파일 경로가 필요합니다');
  }

  const path = resolve(getRootDir(), pathValue);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`discovery result JSON을 읽을 수 없습니다: ${path}`, { cause: error });
  }

  const wrapperUnresolvedQuestions =
    isRecord(parsed) && parsed.unresolvedQuestions !== undefined ? parsed.unresolvedQuestions : [];
  if (!isStringArray(wrapperUnresolvedQuestions)) {
    throw new Error('discovery result JSON의 unresolvedQuestions는 문자열 배열이어야 합니다');
  }
  if (wrapperUnresolvedQuestions.some((question) => !question.trim())) {
    throw new Error('discovery result JSON의 unresolvedQuestions에는 빈 값이 있을 수 없습니다');
  }

  const values =
    isRecord(parsed) && Array.isArray(parsed.discoveryRefs) ? parsed.discoveryRefs : parsed;
  if (!Array.isArray(values)) {
    throw new Error('discovery result JSON은 배열 또는 discoveryRefs 배열을 포함해야 합니다');
  }

  const results = new Map<string, DefinitionChildExecutionResult>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      throw new Error(`discovery result[${index}]가 객체가 아닙니다`);
    }
    const taskKey = value.taskKey;
    const routeKeys = value.routeKeys;
    const sourceRefs = value.sourceRefs ?? [];
    const unresolvedQuestions = value.unresolvedQuestions ?? [];
    if (typeof taskKey !== 'string' || taskKey.trim().length === 0) {
      throw new Error(`discovery result[${index}].taskKey가 필요합니다`);
    }
    if (!isStringArray(routeKeys)) {
      throw new Error(`discovery result[${index}].routeKeys는 문자열 배열이어야 합니다`);
    }
    if (!isStringArray(sourceRefs)) {
      throw new Error(`discovery result[${index}].sourceRefs는 문자열 배열이어야 합니다`);
    }
    if (!isStringArray(unresolvedQuestions)) {
      throw new Error(`discovery result[${index}].unresolvedQuestions는 문자열 배열이어야 합니다`);
    }
    if (results.has(taskKey)) {
      throw new Error(`discovery result에 중복된 taskKey가 있습니다: ${taskKey}`);
    }
    results.set(taskKey, {
      taskKey,
      kind: 'discovery',
      routeKeys,
      sourceRefs,
      unresolvedQuestions,
    });
  }
  return { results, unresolvedQuestions: [...new Set(wrapperUnresolvedQuestions)].sort() };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readInitialUsageSummary(value: string): ContextUsageSummary {
  if (value === 'true') {
    throw new Error('--initial-usage에는 usage summary JSON 파일 경로가 필요합니다');
  }

  const path = resolve(getRootDir(), value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`initial usage summary를 읽을 수 없습니다: ${path}`, { cause: error });
  }
  return parsed as ContextUsageSummary;
}

async function persistDefinitionTaskHandoff(
  bounded: Awaited<ReturnType<typeof buildBoundedDefinitionContext>>,
  flags: Record<string, string>,
): Promise<{ handoff: ReturnType<typeof createDefinitionTaskHandoff>; path: string }> {
  const outputPath = flags['handoff-out'];
  if (!outputPath || outputPath === 'true') {
    throw new Error('--handoff-out에는 저장할 JSON 파일 경로가 필요합니다');
  }
  const resultRevision = flags['result-revision'];
  if (!resultRevision || resultRevision === 'true') {
    throw new Error('--handoff-out 사용 시 --result-revision이 필요합니다');
  }

  const sourceRevision = flags['source-revision'];
  if (sourceRevision === 'true') {
    throw new Error('--source-revision에는 revision 값이 필요합니다');
  }
  if (flags['unresolved-questions'] === 'true') {
    throw new Error('--unresolved-questions에는 csv 값이 필요합니다');
  }
  const nextTaskKey = flags['next-task-key'];
  const nextTaskObjective = flags['next-task-objective'];
  if (nextTaskKey === 'true' || nextTaskObjective === 'true') {
    throw new Error('--next-task-key와 --next-task-objective에는 값이 필요합니다');
  }
  if (Boolean(nextTaskKey) !== Boolean(nextTaskObjective)) {
    throw new Error('--next-task-key와 --next-task-objective는 함께 지정해야 합니다');
  }

  const handoff = createDefinitionTaskHandoff({
    boundedContext: bounded,
    resultRevision,
    ...(sourceRevision ? { sourceRevision } : {}),
    unresolvedQuestions: parseCsvFlag(flags['unresolved-questions']),
    ...(nextTaskKey && nextTaskObjective
      ? { nextTask: { taskKey: nextTaskKey, objective: nextTaskObjective } }
      : {}),
  });
  const path = resolve(getRootDir(), outputPath);
  await new JsonTaskHandoffStore(path).save(handoff);
  return { handoff, path };
}

// ── boundary (DefDataSource 기반) ─────────────────────

async function cmdBoundary(
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

async function cmdBoundaryContext(
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

// ── audit (DefDataSource 기반, 레거시 통합) ───────────

/** DefDataSource의 문서를 DomainRootRegistry로 변환한다 (domain_root 파생용). */
async function buildDomainRootRegistry(source: DefDataSource): Promise<DomainRootRegistry> {
  const docs = await source.list({ limit: 10000 });
  const entries = new Map<string, DefinitionEntry>();
  const outgoingLinks = new Map<string, DefinitionLink[]>();
  const incomingLinks = new Map<string, DefinitionLink[]>();

  for (const d of docs) {
    const entry: DefinitionEntry = {
      id: d.docId,
      title: d.title ?? d.docId,
      tier: d.tier as DefinitionEntry['tier'],
      scope: d.scope as DefinitionEntry['scope'],
      aspect: d.aspect as DefinitionEntry['aspect'],
      depth: d.depth as DefinitionEntry['depth'],
      layer: d.layer as DefinitionEntry['layer'],
      lifecycle: d.lifecycle as DefinitionEntry['lifecycle'],
      owner_system: d.ownerSystem,
      createdAt: '',
      updatedAt: '',
    };
    entries.set(d.docId, entry);
  }

  for (const d of docs) {
    for (const link of d.links) {
      const l: DefinitionLink = {
        sourceId: d.docId,
        targetId: link.target,
        linkType: link.type as DefinitionLink['linkType'],
      };
      const out = outgoingLinks.get(d.docId) ?? [];
      out.push(l);
      outgoingLinks.set(d.docId, out);
      const inc = incomingLinks.get(link.target) ?? [];
      inc.push(l);
      incomingLinks.set(link.target, inc);
    }
  }

  return {
    all: () => [...entries.values()],
    get: (id: string) => entries.get(id),
    getLinks: (id: string, direction: 'outgoing' | 'incoming' | 'both' = 'both') => {
      if (direction === 'outgoing') return outgoingLinks.get(id) ?? [];
      if (direction === 'incoming') return incomingLinks.get(id) ?? [];
      return [...(outgoingLinks.get(id) ?? []), ...(incomingLinks.get(id) ?? [])];
    },
  };
}

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

async function cmdAudit(source: DefDataSource, flags: Record<string, string> = {}) {
  if (flags['by-domain'] === 'true' || flags['by-domain'] === '') {
    return cmdAuditByDomain(source);
  }
  if (flags['rollup-aspect'] === 'true' || flags['rollup-aspect'] === '') {
    return cmdAuditRollupAspect(source);
  }

  const all = await source.list({ limit: 2000 });
  const active = all.filter((d) => d.lifecycle !== 'deprecated' && d.lifecycle !== 'archived');

  let withPurpose = 0,
    withTags = 0;
  // links 카운트: DefDoc.links 필드에 이미 outgoing links가 포함됨
  let withLinks = 0;
  for (const d of active) {
    if (d.purpose && d.purpose.length > 0) withPurpose++;
    if (d.links.some((l) => l.type !== 'contains')) withLinks++;
    if (d.tags.length > 0) withTags++;
  }

  // level 분포
  const byLevel: Record<string, number> = {};
  for (const d of active) {
    const level = d.level ?? 'leaf';
    byLevel[level] = (byLevel[level] || 0) + 1;
  }

  console.log(`=== 품질 리포트 ===`);
  console.log(
    `문서 ${active.length}건 | purpose ${withPurpose} | links ${withLinks} | tags ${withTags}`,
  );
  console.log(
    `level: ${Object.entries(byLevel)
      .toSorted((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}(${v})`)
      .join(' ')}`,
  );

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
  const noPurpose = active.filter((d) => !d.purpose || d.purpose.length === 0);
  if (noPurpose.length > 0) {
    console.log(`\n=== purpose 이슈 ${noPurpose.length}건 ===`);
    noPurpose.slice(0, 10).forEach((d) => console.log(`  [high] ${d.docId}: ^purpose 없음`));
    if (noPurpose.length > 10) console.log(`  ... 외 ${noPurpose.length - 10}건`);
  }
}

// ── scan (파일 스캔 유틸) ──────────────────────────────

/** 파일 시스템에서 docs/ 하위 .md를 스캔하여 ScanResult 반환 */
async function scan(flags: Record<string, string> = {}) {
  const root = getRootDir();
  const docsDir = flags['docs'] ?? 'docs';
  return scanAndBuild(root, [join(root, docsDir)]);
}

async function cmdScanAudit(flags: Record<string, string>) {
  const root = getRootDir();
  const result = await scan(flags);
  const active = result.registry
    .all()
    .filter((entry) => entry.lifecycle !== 'deprecated' && entry.lifecycle !== 'archived');

  let withPurpose = 0;
  let withTags = 0;
  let withLinks = 0;
  const byLevel: Record<string, number> = {};

  for (const entry of active) {
    const level = entry.level ?? 'leaf';
    byLevel[level] = (byLevel[level] || 0) + 1;
    if ((entry.tags?.length ?? 0) > 0) withTags++;
    if (
      result.registry.getLinks(entry.id, 'outgoing').some((link) => link.linkType !== 'contains')
    ) {
      withLinks++;
    }

    if (entry.ref) {
      try {
        const content = readFileSync(join(root, entry.ref), 'utf8');
        const fm = extractFrontmatter(content);
        const body = fm?.body ?? content;
        const purpose =
          extractByMarker(body, 'purpose').text || extractByLevel(body, 'purpose').text;
        if (purpose.trim().length > 0) {
          withPurpose++;
        }
      } catch {
        // scan error는 별도 섹션에서 보고한다.
      }
    }
  }

  console.log('=== scan 감사 ===');
  console.log(
    `문서 ${active.length}건 | purpose ${withPurpose} | links ${withLinks} | tags ${withTags}`,
  );
  console.log(`registered: ${result.registered} | linked: ${result.linked}`);
  console.log(`scan errors: ${result.errors.length} | link errors: ${result.linkErrors.length}`);
  console.log(
    `level: ${Object.entries(byLevel)
      .toSorted((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}(${v})`)
      .join(' ')}`,
  );

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

async function cmdSync(flags: Record<string, string>) {
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

async function cmdCodeLinkGaps(flags: Record<string, string>) {
  const root = getRootDir();
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

/**
 * Execute the externally-owned spec-management platform without importing its
 * parser, store or taxonomy implementation into qa-sdk. The executable is
 * supplied by the published `@spec-platform/qa-sdk-adapter` package; a local
 * development path can be supplied explicitly through --platform-bin.
 */
export function createPlatformVerifyInvocation(
  root: string,
  flags: Record<string, string>,
): { readonly command: string; readonly args: readonly string[] } {
  const executable = flags['platform-bin'] ?? process.env.QA_SPEC_PLATFORM_BIN ?? 'qa-spec-platform';
  const args = ['verify', root];
  if (flags.store) args.push('--store', flags.store);
  if (flags['include-tests'] === 'true') args.push('--include-tests');
  if (flags.json === 'true') args.push('--json');
  if (executable.endsWith('.js')) return { command: process.execPath, args: [executable, ...args] };
  return { command: executable, args };
}

async function cmdPlatformVerify(flags: Record<string, string>) {
  const root = getRootDir();
  const invocation = createPlatformVerifyInvocation(root, flags);
  try {
    const result = await execa(invocation.command, invocation.args, {
      cwd: root,
      reject: false,
      stdio: 'inherit',
    });
    if (result.exitCode) process.exitCode = result.exitCode;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `spec-management platform 실행 실패: ${detail}\n` +
        'Install @spec-platform/qa-sdk-adapter or pass --platform-bin=<qa-spec-platform path>.',
    );
    process.exitCode = 1;
  }
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
  let linkCount = 0;
  for (const doc of docs) linkCount += doc.links.length;
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

function runDoctorCoverage(): DoctorCheck {
  const root = getRootDir();
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
): Promise<{ deprecated: DoctorCheck; valid: DoctorCheck }> {
  const root = getRootDir();
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

async function cmdDoctor(flags: Record<string, string>, options: DataSourceOptions): Promise<void> {
  let source: DefDataSource;
  try {
    source = await getSource(options);
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
    checks.push(runDoctorCoverage());
    checks.push(runDoctorAspectHierarchy());
    checks.push(runDoctorAspectCompleteness());
    const annotations = await runDoctorAnnotations(source);
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

const DEF_HELP_SECTIONS = [
  {
    title: '시작하기',
    lines: [
      'help                        이 도움말',
      'doctor                      통합 헬스체크 (validate + sync + coverage + aspect + annotations)',
      'guide                       시스템 전체 구조 안내',
      'guide concepts              핵심 개념 (좌표, prefix, 축)',
      'guide classification        문서 분류 체계 (scope, level, layer)',
      'guide authoring             핵심 작성 규칙 + 코드 매핑 규칙',
      'guide management            definition 관리 흐름',
      'guide services              서비스 구조',
      'guide philosophy            시스템 철학',
      'concepts                    concept 문서 목록',
    ],
  },
  {
    title: '조회',
    lines: [
      'list [--scope=X] [--aspect=A] [--level=Z] [--layer=Y] [--tag=T] [--q=검색어] [--domain-root=<rootId>] [--include-children] [--type=rule|cases|test|...] [--ext=rule]',
      'get <ID> | --address=<ADDR>  단건 조회',
      'body <ID>           최신 본문 조회 (--json 가능)',
      'read <ID>           body의 별칭',
      'children <ID>       구조 멤버(contains/refs/refines←)와 소비자(depends_on←) 분리 조회',
      'parent <ID>         부모 문서',
      'incoming <ID> | --address=<ADDR>  역링크',
      'outgoing <ID> | --address=<ADDR>  순방향 링크',
      'search <검색어>     전문 검색',
      'concepts            knowledge/concept 문서 조회',
      'find-by-file <경로[:symbol]> code_references 기준 boundary 해석',
    ],
  },
  {
    title: '분석',
    lines: [
      'scan-audit          raw frontmatter/link 감사 (DB 미사용)',
      'context <ID> [--bounded] [--used-tokens N] [--initial-usage <path>] [--provider-usage <path> --provider openai|anthropic|generic] [--provider-phase discovery|working] [--tokenizer-module <path>|--tokenizer-registry <path> [--tokenizer-provider openai|anthropic|generic] [--tokenizer-model <id>]] [--stop-routes <csv>] [--stop-facts <csv>] [--stop-evidence <csv>] [--no-progress-limit N] [--json]  작업 전 컨텍스트 (소속/의존/영향)',
      'context <ID> --bounded --handoff-out <path> --result-revision <REV> [--source-revision <REV>] [--unresolved-questions <csv>] [--next-task-key <KEY> --next-task-objective <TEXT>]  Typed Handoff 저장',
      'handoff <store-path> <task-key> [--json]  저장된 Typed Handoff 조회',
      'handoff-aggregate <store-path> <decomposition.json> --source-revision <REV> --result-revision <REV> [--discovery-results <path>] [--json]  discovery child는 refs로, resolution child는 parent Handoff로 집계',
      'boundary <ID> | --address=<ADDR>       바운더리 구조 + direct coupling (--level, --json 가능)',
      'boundary-context <ID> | --address=<ADDR> 바운더리 + concerns + impact + feedback (--level, --mode, --json 가능)',
      'impact <ID> | --address=<ADDR>  변경 영향 분석',
      'topdown <ID>        탑다운 조립 (기본=구조 멤버만, --with-consumers 시 의존자 포함)',
      'bottomup <ID>       영향 역추적',
    ],
  },
  {
    title: '품질',
    lines: [
      'sync                docs → local DB 동기화',
      'audit               품질 리포트 + 그래프 검증',
      'audit --rollup-aspect  aspect family 별 문서 rollup 집계',
      'audit --by-domain   도메인 루트 기준 리포트',
      'validate            DB 기준 그래프 + code reference 검증',
      'code-link-gaps      explicit 문서 연결 없는 코드 목록',
      'platform-verify     외부 spec-management platform으로 문서/코드 evidence 검증',
      'stats               분포 통계',
      'check <ID>          문서 정합성 점검',
      'link-rules          LinkType 사용 규칙',
    ],
  },
  {
    title: '상태',
    lines: [
      'state               전체 머신 상태 분포',
      'state <머신ID>      특정 머신 분포',
      'state <문서ID>      문서별 상태',
      'state [--verification-artifact=<path>] [--verification-drift] [--json]  검증 read model 조합',
      'state --deps        머신 간 의존 관계',
    ],
  },
  {
    title: '유틸',
    lines: [
      'verification-bindings  --spec-ids=<id1,id2> --out=<bindings.json> --captured-at=<ISO> [--json]',
      'verification-artifact  --summary=<VerificationSummary.json> --out=<artifact.json> --run-started-at=<ISO> --run-completed-at=<ISO> [--bindings=<bindings.json>]',
      'audit-db            DB 검증/정리',
      'overview            전체 그룹 구조 조회',
      'tier classify       Phase 1.B 자동 분류 실행기',
    ],
  },
] as const satisfies readonly CommandHelpSectionSpec[];

function printDefHelp() {
  const body = formatHelpSections(DEF_HELP_SECTIONS);
  console.log(`qa-sdk def — 문서 관리\n\n${body}`);
}

// ── 라우터 ────────────────────────────────────────────

export async function cliDef(args: string[]): Promise<void> {
  const { positional, options, flags } = parseFlags(args);
  const sub = positional[0];
  const rest = positional.slice(1);

  if (!sub || sub === 'help') {
    printDefHelp();
    return;
  }

  if (sub === 'scan') return cmdSync(flags); // scan = sync alias (하위호환)
  if (sub === 'scan-audit') return cmdScanAudit(flags);
  if (sub === 'sync') return cmdSync(flags);
  if (sub === 'code-link-gaps') return cmdCodeLinkGaps(flags);
  if (sub === 'platform-verify') return cmdPlatformVerify(flags);
  if (sub === 'doctor') return cmdDoctor(flags, options);
  if (sub === 'link-rules') return cmdLinkRules();
  if (sub === 'verification-bindings') return cmdVerificationBindings(flags, options);
  if (sub === 'verification-artifact') return cmdVerificationArtifact(flags);
  if (sub === 'state') return cmdState(rest, flags, options);
  if (sub === 'handoff') return cmdHandoff(rest, flags);
  if (sub === 'handoff-aggregate') return cmdHandoffAggregate(rest, flags);

  // DefDataSource 기반 커맨드 (전체 통합)
  const dsCommands = new Set([
    'list',
    'get',
    'body',
    'read',
    'children',
    'parent',
    'incoming',
    'outgoing',
    'validate',
    'search',
    'stats',
    'impact',
    'check',
    'audit',
    'audit-db',
    'overview',
    'tier',
    'find-by-file',
    'guide',
    'concepts',
    'topdown',
    'bottomup',
    'context',
    'boundary',
    'boundary-context',
  ]);
  if (dsCommands.has(sub)) {
    let source: DefDataSource;
    try {
      source = await getSource(options);
    } catch (e) {
      console.log((e as Error).message);
      return;
    }

    try {
      switch (sub) {
        case 'list':
          return await cmdList(source, flags);
        case 'get':
          return await cmdGet(source, rest[0], flags['address']);
        case 'body':
        case 'read':
          if (!rest[0]) {
            console.log('Usage: qa-sdk def body|read <문서ID> [--json]');
            return;
          }
          return await cmdBody(source, rest[0], flags);
        case 'children':
          return await cmdChildren(source, rest[0]);
        case 'parent':
          return await cmdParent(source, rest[0]);
        case 'incoming':
          return await cmdIncoming(source, rest[0], flags['address']);
        case 'outgoing':
          return await cmdOutgoing(source, rest[0], flags['address']);
        case 'validate':
          return await cmdValidate(source, flags);
        case 'search':
          return await cmdSearch(source, rest[0] ?? flags['q'] ?? '');
        case 'concepts':
          return await cmdConcepts(source, flags);
        case 'stats':
          return await cmdStats(source);
        case 'impact':
          return await cmdImpact(source, rest[0], flags['address']);
        case 'check':
          return await cmdCheck(source, rest[0]);
        case 'audit':
          return await cmdAudit(source, flags);
        case 'audit-db':
          return await cmdAuditDb(source);
        case 'overview':
          return await cmdOverview(source);
        case 'tier':
          if (rest[0] === 'classify') {
            return await cmdTierClassify(source, rest.slice(1), flags);
          }
          console.log('Usage: qa-sdk def tier classify');
          return;
        case 'find-by-file':
          return await cmdFindByFile(source, rest[0] ?? '');
        case 'guide':
          return await cmdGuide(source, rest[0]);
        case 'topdown':
          if (!rest[0]) {
            console.log('Usage: qa-sdk def topdown <그룹ID> [--overview] [--with-consumers]');
            return;
          }
          return await cmdTopdown(
            source,
            rest[0],
            hasFlag(flags, 'overview') ? 'overview' : 'purpose',
            { includeConsumers: hasFlag(flags, 'with-consumers') },
          );
        case 'bottomup':
          if (!rest[0]) {
            console.log('Usage: qa-sdk def bottomup <문서ID>');
            return;
          }
          return await cmdBottomup(source, rest[0]);
        case 'context':
          if (!rest[0]) {
            console.log('Usage: qa-sdk def context <문서ID>');
            return;
          }
          return await cmdContext(source, rest[0], flags);
        case 'boundary':
          if (!rest[0] && !flags['address']) {
            console.log(
              'Usage: qa-sdk def boundary <문서ID> [--address=<ADDR>] [--level purpose|overview] [--json]',
            );
            return;
          }
          return await cmdBoundary(source, rest[0], flags);
        case 'boundary-context':
          if (!rest[0] && !flags['address']) {
            console.log(
              'Usage: qa-sdk def boundary-context <문서ID> [--address=<ADDR>] [--level purpose|overview] [--mode direct|transitive] [--json]',
            );
            return;
          }
          return await cmdBoundaryContext(source, rest[0], flags);
      }
    } finally {
      if ('close' in source && typeof source.close === 'function')
        (source as { close(): void }).close();
    }
    return;
  }

  printDefHelp();
}

async function cmdFindByFile(source: DefDataSource, filePath: string) {
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

async function cmdGuide(source: DefDataSource, topic?: string) {
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

function cmdLinkRules() {
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

// ── verification artifact (CI/CLI 파일 producer) ─────────────

/**
 * 테스트 실행 직전에 definition snapshot을 캡처한다.
 * 생성된 bindings 파일은 실행 종료 후 verification-artifact producer에 전달한다.
 */
async function cmdVerificationBindings(
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
): Promise<void> {
  const specIds = parseCsvFlag(flags['spec-ids'] ?? flags['spec-id']);
  const outPath = flags['out'];
  const capturedAt = flags['captured-at'] ?? flags['run-started-at'];
  if (specIds.length === 0 || !outPath || !capturedAt) {
    console.log(
      'Usage: qa-sdk def verification-bindings --spec-ids=<id1,id2> --out=<bindings.json> --captured-at=<ISO> [--json]',
    );
    process.exitCode = 1;
    return;
  }

  let source: DefDataSource;
  try {
    source = await getSource(sourceOptions);
  } catch (error) {
    console.log(`[verification-bindings] ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const bindings = await writeVerificationBindingsFile(
      resolve(getRootDir(), outPath),
      source,
      specIds,
      { capturedAt },
    );
    const output = { out: resolve(getRootDir(), outPath), bindings };
    if (flags['json'] === 'true' || flags['json'] === '') {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`검증 binding 캡처: ${output.out}`);
      console.log(`bindings: ${bindings.length}`);
    }
  } catch (error) {
    console.log(`[verification-bindings] ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    if ('close' in source && typeof (source as { close?: () => void }).close === 'function') {
      (source as { close: () => void }).close();
    }
  }
}

/**
 * 검증 runner가 만든 VerificationSummary와 run-start definition binding을
 * 불변 wire artifact로 패키징한다. 이 명령은 DB를 읽거나 쓰지 않는다.
 */
async function cmdVerificationArtifact(flags: Record<string, string>): Promise<void> {
  const summaryPath = flags['summary'];
  const outPath = flags['out'];
  const runStartedAt = flags['run-started-at'];
  const runCompletedAt = flags['run-completed-at'];
  if (!summaryPath || !outPath || !runStartedAt || !runCompletedAt) {
    console.log(
      'Usage: qa-sdk def verification-artifact --summary=<VerificationSummary.json> --out=<artifact.json> --run-started-at=<ISO> --run-completed-at=<ISO> [--bindings=<bindings.json>] [--json]',
    );
    process.exitCode = 1;
    return;
  }

  const root = getRootDir();
  const readJson = (filePath: string): unknown =>
    JSON.parse(readFileSync(resolve(root, filePath), 'utf8')) as unknown;

  try {
    const summaryInput = readJson(summaryPath);
    if (
      typeof summaryInput !== 'object' ||
      summaryInput === null ||
      Array.isArray(summaryInput) ||
      !Array.isArray((summaryInput as { reports?: unknown }).reports)
    ) {
      throw new Error('summary must be an object with a reports array');
    }

    let bindings: Map<string, VerificationDefinitionBinding> | undefined;
    const bindingsPath = flags['bindings'];
    if (bindingsPath) {
      const bindingsInput = readJson(bindingsPath);
      if (!Array.isArray(bindingsInput)) {
        throw new Error('bindings must be an array');
      }
      bindings = new Map();
      for (const [index, item] of bindingsInput.entries()) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          throw new Error(`bindings[${index}] must be an object`);
        }
        const binding = item as VerificationDefinitionBinding;
        if (typeof binding.specId !== 'string' || binding.specId.trim().length === 0) {
          throw new Error(`bindings[${index}].specId must be non-empty`);
        }
        if (bindings.has(binding.specId)) {
          throw new Error(`duplicate binding specId: ${binding.specId}`);
        }
        bindings.set(binding.specId, binding);
      }
    }

    const artifact = await writeVerificationArtifactFile(resolve(root, outPath), {
      runStartedAt,
      runCompletedAt,
      summary: summaryInput as VerificationSummary,
      ...(bindings ? { bindings } : {}),
    });
    if (flags['json'] === 'true' || flags['json'] === '') {
      console.log(JSON.stringify({ out: resolve(root, outPath), artifact }, null, 2));
    } else {
      console.log(`검증 아티팩트 생성: ${resolve(root, outPath)}`);
      console.log(`reports: ${artifact.reports.length}`);
    }
  } catch (error) {
    console.log(`[verification-artifact] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

// ── def state — 하네스 상태 분포 ───────────────────────

interface HarnessDocState {
  readonly id: string;
  readonly lifecycle: string;
  readonly specImpl: string;
  readonly convention: string;
  readonly verification?: VerificationReadModel;
}

async function cmdState(
  rest: string[],
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions = {},
) {
  const sourceHolder: { current?: DefDataSource } = {};
  try {
    return await cmdStateImpl(rest, flags, sourceOptions, sourceHolder);
  } finally {
    closeDataSource(sourceHolder.current);
  }
}

async function cmdStateImpl(
  rest: string[],
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions = {},
  sourceHolder: { current?: DefDataSource } = {},
) {
  const root = getRootDir();
  const registry = createHarnessRegistry();

  // --deps: 의존 관계만 출력
  if (flags['deps']) {
    printDeps(registry);
    return;
  }

  // 문서 스캔 + config 로드
  const scanResult = await scan();
  const config = await readDefConfig(root);
  const configExists = config.lastSyncedAt !== '';

  // checksum 비교 — drift 감지
  const currentChecksums: Record<string, string> = {};
  for (const entry of scanResult.registry.all()) {
    const id = entry.id;
    currentChecksums[id] = hashFrontmatter(
      `${entry.scope}:${entry.aspect}:${entry.depth}:${entry.level ?? 'leaf'}:${entry.lifecycle}`,
    );
  }
  const drift = detectDrift(config, currentChecksums);
  const checksumMatch = drift.length === 0;

  // 전역 sync 상태
  const syncState = deriveSyncState({
    configExists,
    configCount: config.documentCount,
    scanCount: scanResult.registered,
    checksumMatch,
  });

  let verificationArtifact: unknown | undefined;
  let verificationSource: DefDataSource | undefined;
  const artifactPath = flags['verification-artifact'];
  const driftEnabled = flags['verification-drift'] === 'true' || flags['verification-drift'] === '';
  if (artifactPath || driftEnabled) {
    const now = new Date().toISOString();
    try {
      verificationArtifact = artifactPath
        ? (JSON.parse(readFileSync(resolve(root, artifactPath), 'utf8')) as unknown)
        : {
            schemaVersion: 1,
            runStartedAt: now,
            runCompletedAt: now,
            reports: [],
          };
    } catch {
      // Adapter가 invalid artifact로 진단하도록 빈 object를 전달한다.
      verificationArtifact = {};
    }

    try {
      verificationSource = await getSource(sourceOptions);
      sourceHolder.current = verificationSource;
    } catch (error) {
      console.log(`verification artifact source unavailable: ${(error as Error).message}`);
    }
  }

  const driftReports = new Map<string, DriftReport>();
  const implementationsByService = new Map<
    string,
    Awaited<ReturnType<typeof scanImplementations>>
  >();
  if (driftEnabled && verificationSource) {
    for (const entry of scanResult.registry.all()) {
      if (!entry.serviceId) continue;
      try {
        const body = await verificationSource.getBody(entry.id);
        if (!body) continue;
        const declared = extractDeclarations(body.body, entry.id);
        let implemented = implementationsByService.get(entry.serviceId);
        if (!implemented) {
          implemented = await scanImplementations(join(root, 'packages', entry.serviceId));
          implementationsByService.set(entry.serviceId, implemented);
        }
        driftReports.set(entry.id, analyzeDrift(entry.id, entry.serviceId, declared, implemented));
      } catch {
        // Static drift is optional sidecar evidence; runtime state remains available.
      }
    }
  }

  // 각 문서별 상태 파생
  const docStates: HarnessDocState[] = [];
  for (const entry of scanResult.registry.all()) {
    const id = entry.id;
    const lifecycle = deriveDocLifecycle(entry.lifecycle);

    const hasSvc = !!entry.serviceId;
    const svcDir = entry.serviceId ? join(root, 'packages', entry.serviceId) : null;
    let hasCode = false;
    let hasTests = false;
    if (svcDir) {
      try {
        const { readdirSync } = await import('node:fs');
        const srcDir = join(svcDir, 'src');
        hasCode = existsSync(srcDir) && readdirSync(srcDir).some((f) => f.endsWith('.ts'));
        hasTests = existsSync(srcDir) && readdirSync(srcDir).some((f) => f.endsWith('.test.ts'));
      } catch {
        /* 디렉토리 없음 */
      }
    }

    const specImpl = deriveSpecImplState({
      hasSvc,
      hasCode,
      hasTests,
      testsPass: null,
      isSourceReferenced: entry.depth === 'implementation' || entry.depth === 'validation',
    });

    let verification: VerificationReadModel | undefined;
    if (verificationArtifact !== undefined && verificationSource) {
      verification = await resolveVerificationReadModel(
        verificationSource,
        verificationArtifact,
        id,
        driftReports.get(id),
      );
    }

    // artifact가 없거나 binding이 현재 definition snapshot과 연결되지 않을 때만 unverified 유지
    const convention =
      verification?.convention ??
      deriveConventionState({
        evidenceCount: 0,
        coverage: 0,
        hasFailures: false,
      });

    docStates.push({
      id,
      lifecycle,
      specImpl,
      convention,
      ...(verification ? { verification } : {}),
    });
  }

  const target = rest[0];
  const jsonOutput = flags['json'] === 'true' || flags['json'] === '';

  // 특정 머신 분포
  if (target && registry.machines.has(target)) {
    printMachineDistribution(target, docStates, syncState);
    return;
  }

  // 특정 문서 상태
  if (target) {
    const doc = docStates.find((d) => d.id === target);
    if (!doc) {
      console.log(`문서 "${target}" 없음`);
      return;
    }
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            id: doc.id,
            'doc-lifecycle': doc.lifecycle,
            'spec-impl': doc.specImpl,
            'convention-compliance': doc.convention,
            'db-sync': syncState,
            ...(doc.verification ? { verification: doc.verification } : {}),
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`${doc.id}`);
    console.log(`  doc-lifecycle:          ${doc.lifecycle}`);
    console.log(`  spec-impl:              ${doc.specImpl}`);
    console.log(`  convention-compliance:   ${doc.convention}`);
    console.log(`  db-sync:                ${syncState}`);
    if (doc.verification) printVerificationReadModel(doc.verification);
    return;
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ documents: docStates, 'db-sync': syncState }, null, 2));
    return;
  }

  // 전체 분포
  console.log(`── 문서 계층 (${docStates.length}건) ──────────────────────`);
  printDistributionLine(
    'doc-lifecycle',
    docStates.map((d) => d.lifecycle),
  );
  printDistributionLine(
    'spec-impl',
    docStates.map((d) => d.specImpl),
  );
  printDistributionLine(
    'convention',
    docStates.map((d) => d.convention),
  );
  if (verificationArtifact !== undefined) {
    printDistributionLine(
      'verification-report',
      docStates.map((d) => d.verification?.reportStatus ?? 'not-evaluated'),
    );
    printDistributionLine(
      'verification-binding',
      docStates.map((d) => d.verification?.bindingStatus ?? 'not-evaluated'),
    );
    if (driftEnabled) {
      printDistributionLine(
        'verification-drift',
        docStates.map((d) => (d.verification?.driftReport ? 'available' : 'not-available')),
      );
    }
  }
  console.log(`db-sync              ${syncState}`);

  console.log(`\n── 시스템 계층 ────────────────────────`);
  console.log(`address-state        (외부 서비스 연결 필요)`);
  console.log(`version-lifecycle    (외부 서비스 연결 필요)`);
  console.log(`service-status       (외부 서비스 연결 필요)`);
  console.log(`event-status         (외부 서비스 연결 필요)`);
  console.log(`metric-health        (외부 서비스 연결 필요)`);

  console.log(`\n── 프로세스 계층 ──────────────────────`);
  console.log(`decision-flow        (외부 서비스 연결 필요)`);
  console.log(`policy-candidate     (외부 서비스 연결 필요)`);
}

function printDistributionLine(label: string, states: string[]) {
  const counts = new Map<string, number>();
  for (const s of states) {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .map(([state, count]) => `${state}(${count})`);
  console.log(`${label.padEnd(21)}${parts.join(' ')}`);
}

function printVerificationReadModel(model: VerificationReadModel): void {
  console.log(`  verification-report:    ${model.reportStatus}`);
  console.log(`  verification-binding:   ${model.bindingStatus ?? 'none'}`);
  if (model.definitionAddress) console.log(`  definition-address:     ${model.definitionAddress}`);
  if (model.currentDocId) console.log(`  current-doc-id:         ${model.currentDocId}`);
  if (model.driftReport) {
    console.log(`  drift-coverage:         ${model.driftReport.coverage}`);
    console.log(`  drift-missing:          ${model.driftReport.missing.length}`);
    console.log(`  drift-undocumented:     ${model.driftReport.undocumented.length}`);
  }
  for (const diagnostic of model.diagnostics) {
    console.log(`  verification-diagnostic: ${diagnostic.code} — ${diagnostic.message}`);
  }
}

function printMachineDistribution(
  machineId: string,
  docStates: HarnessDocState[],
  syncState: string,
) {
  const docMachineField: Record<string, keyof (typeof docStates)[0]> = {
    'doc-lifecycle': 'lifecycle',
    'spec-impl': 'specImpl',
    'convention-compliance': 'convention',
  };

  const field = docMachineField[machineId];
  if (field) {
    const values = docStates.map((d) => String(d[field]));
    printDistributionLine(machineId, values);
    console.log(`\n상세:`);
    for (const d of docStates) {
      console.log(`  ${d.id.padEnd(40)} ${d[field]}`);
    }
    return;
  }

  if (machineId === 'db-sync') {
    console.log(`db-sync: ${syncState}`);
    return;
  }

  console.log(`${machineId}: 외부 서비스 연결 필요`);
}

function printDeps(registry: ReturnType<typeof createHarnessRegistry>) {
  const cascade = registry.dependencies.filter((d) => d.kind === 'cascade');
  const guard = registry.dependencies.filter((d) => d.kind === 'guard');
  const notify = registry.dependencies.filter((d) => d.kind === 'notify');

  if (cascade.length > 0) {
    console.log('cascade:');
    for (const d of cascade) {
      console.log(
        `  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`,
      );
    }
  }
  if (guard.length > 0) {
    console.log('guard:');
    for (const d of guard) {
      console.log(
        `  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`,
      );
    }
  }
  if (notify.length > 0) {
    console.log('notify:');
    for (const d of notify) {
      console.log(
        `  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`,
      );
    }
  }
}
